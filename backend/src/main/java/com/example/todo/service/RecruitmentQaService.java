package com.example.todo.service;

import com.example.todo.dto.RecruitmentAnswerDto;
import com.example.todo.dto.RecruitmentAnswerRequest;
import com.example.todo.dto.RecruitmentQuestionDto;
import com.example.todo.dto.RecruitmentQuestionRequest;
import com.example.todo.dto.UserQaStatsDto;
import com.example.todo.entity.Recruitment;
import com.example.todo.entity.NotificationType;
import com.example.todo.entity.RecruitmentAnswer;
import com.example.todo.entity.RecruitmentQuestion;
import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.RecruitmentAnswerRepository;
import com.example.todo.repository.RecruitmentQuestionRepository;
import com.example.todo.repository.RecruitmentRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.util.GuestUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Recruitment Q&A 도메인 서비스.
 * - 공개 Q&A 탭: 모집글에 누구나 질문, 작성자만 답변
 * - 권한: 질문 등록은 non-guest + 본인 모집글 X / 답변·핀은 모집 작성자만
 * - 알림: RECRUITMENT_QUESTION_RECEIVED (작성자에게), RECRUITMENT_QUESTION_ANSWERED (질문자에게)
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecruitmentQaService {

    private final RecruitmentRepository recruitmentRepo;
    private final RecruitmentQuestionRepository questionRepo;
    private final RecruitmentAnswerRepository answerRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;
    private final com.example.todo.repository.UserBlockRepository blockRepo;

    private static final int MIN_QUESTION_LEN = 2;
    private static final int MAX_QUESTION_LEN = 500;
    private static final int MIN_ANSWER_LEN   = 2;
    private static final int MAX_ANSWER_LEN   = 1000;

    // ── 조회 ─────────────────────────────────────────

    public List<RecruitmentQuestionDto> getQuestions(Long recruitmentId, User currentUser) {
        Recruitment r = findRecruitment(recruitmentId);
        Long authorId = r.getAuthor() != null ? r.getAuthor().getId() : null;
        Long meId = currentUser != null ? currentUser.getId() : null;
        boolean isAuthor = authorId != null && authorId.equals(meId);

        // 내가 차단한 사람의 질문은 내 화면에서 뺀다. 모집글 작성자는 예외 — 내 글에 달린 질문은 답해야 하니까.
        Set<Long> blocked = (currentUser == null || isAuthor) ? Set.of() : blockRepo.findBlockedIds(meId);
        return questionRepo.findVisibleByRecruitmentId(recruitmentId).stream()
                .filter(q -> q.getAsker() == null || !blocked.contains(q.getAsker().getId()))
                .map(q -> {
                    boolean canView = canViewQuestion(q, meId, isAuthor);
                    return new RecruitmentQuestionDto(q, canView);
                })
                .collect(Collectors.toList());
    }

    /** 비공개 질문은 작성자(모집 author) + 질문자(asker)만 본문 조회 가능. 공개는 누구나 가능. */
    private boolean canViewQuestion(RecruitmentQuestion q, Long meId, boolean isAuthor) {
        if (!q.isPrivate()) return true;
        if (isAuthor) return true;
        if (meId != null && q.getAsker() != null && q.getAsker().getId().equals(meId)) return true;
        return false;
    }

    // ── 질문 등록 ────────────────────────────────────

    @Transactional
    public RecruitmentQuestionDto createQuestion(Long recruitmentId, RecruitmentQuestionRequest req, User asker) {
        GuestUtils.requireNonGuest(asker);
        Recruitment r = findRecruitment(recruitmentId);
        if (r.getHiddenAt() != null) {
            throw new ApiException(HttpStatus.NOT_FOUND.value(), "모집글을 찾을 수 없어요.");
        }

        // 본인 모집글에 질문 X
        if (r.getAuthor() != null && r.getAuthor().getId().equals(asker.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST.value(), "자신의 모집글에는 질문할 수 없어요.");
        }

        String body = trimAndValidate(req == null ? null : req.getBody(),
                MIN_QUESTION_LEN, MAX_QUESTION_LEN, "질문");

        boolean isPrivate = req != null && req.isPrivate();

        RecruitmentQuestion q = RecruitmentQuestion.builder()
                .recruitment(r)
                .asker(asker)
                .body(body)
                .isPrivate(isPrivate)
                .build();
        RecruitmentQuestion saved = questionRepo.save(q);

        // 작성자에게 알림 — recruitment 알림 패턴 따라 workspaceId는 null
        if (r.getAuthor() != null) {
            String notifBody = isPrivate
                    ? asker.getName() + " 님이 비공개 질문을 남겼습니다."
                    : asker.getName() + " 님이 질문을 남겼습니다.";
            notificationService.createNotification(
                    r.getAuthor().getEmail(),
                    asker.getEmail(),
                    NotificationType.RECRUITMENT_QUESTION_RECEIVED.name(),
                    r.getTitle(),
                    notifBody,
                    r.getId(),
                    null
            );
        }

        // 작성자가 만든 질문이므로 본인은 항상 볼 수 있음 → canView=true
        return new RecruitmentQuestionDto(saved, true);
    }

    // ── 질문 삭제 (soft hidden) ──────────────────────

    @Transactional
    public void deleteQuestion(Long recruitmentId, Long qId, User currentUser) {
        Recruitment r = findRecruitment(recruitmentId);
        RecruitmentQuestion q = findQuestionInRecruitment(qId, recruitmentId);

        boolean isAsker  = q.getAsker() != null && q.getAsker().getId().equals(currentUser.getId());
        boolean isAuthor = r.getAuthor() != null && r.getAuthor().getId().equals(currentUser.getId());
        if (!isAsker && !isAuthor) {
            throw new ApiException(HttpStatus.FORBIDDEN.value(), "본인 또는 모집 작성자만 삭제할 수 있어요.");
        }
        q.setHidden(true);
    }

    // ── 답변 등록/수정 (upsert) ──────────────────────

    @Transactional
    public RecruitmentAnswerDto upsertAnswer(Long recruitmentId, Long qId,
                                             RecruitmentAnswerRequest req, User author) {
        Recruitment r = findRecruitment(recruitmentId);
        checkAuthor(r, author);
        RecruitmentQuestion q = findQuestionInRecruitment(qId, recruitmentId);

        String body = trimAndValidate(req == null ? null : req.getBody(),
                MIN_ANSWER_LEN, MAX_ANSWER_LEN, "답변");

        RecruitmentAnswer answer = q.getAnswer();
        boolean isNew = (answer == null);
        if (isNew) {
            answer = RecruitmentAnswer.builder()
                    .question(q)
                    .author(author)
                    .body(body)
                    .build();
            q.setAnswer(answer);          // 양방향 동기화
            answer = answerRepo.save(answer);
        } else {
            answer.setBody(body);
            answer.setAuthor(author);     // 권한 이양 가능성 대비
        }

        // 질문자에게 알림 — 신규 답변일 때만 (수정 시마다 알리면 노이즈)
        if (isNew && q.getAsker() != null) {
            notificationService.createNotification(
                    q.getAsker().getEmail(),
                    author.getEmail(),
                    NotificationType.RECRUITMENT_QUESTION_ANSWERED.name(),
                    r.getTitle(),
                    "작성자가 질문에 답변을 남겼습니다.",
                    r.getId(),
                    null
            );
        }

        return new RecruitmentAnswerDto(answer);
    }

    // ── 답변 삭제 ────────────────────────────────────

    @Transactional
    public void deleteAnswer(Long recruitmentId, Long qId, User author) {
        Recruitment r = findRecruitment(recruitmentId);
        checkAuthor(r, author);
        RecruitmentQuestion q = findQuestionInRecruitment(qId, recruitmentId);
        if (q.getAnswer() == null) {
            return; // idempotent
        }
        q.setAnswer(null);  // orphanRemoval=true로 cascade 삭제
    }

    // ── 핀 토글 ──────────────────────────────────────

    @Transactional
    public RecruitmentQuestionDto pinQuestion(Long recruitmentId, Long qId, boolean pinned, User author) {
        Recruitment r = findRecruitment(recruitmentId);
        checkAuthor(r, author);
        RecruitmentQuestion q = findQuestionInRecruitment(qId, recruitmentId);
        q.setPinned(pinned);
        return new RecruitmentQuestionDto(q);
    }

    // ── 작성자 통계 (Phase 5) ────────────────────────

    /**
     * 작성자의 Q&A 응답 신뢰도 통계 (public).
     * 사이드바 한 줄 라인용. totalQuestionCount=0이면 answerRate/avg는 null.
     * 숨김(hidden=true) 질문은 분자/분모 모두에서 완전 제외.
     */
    public UserQaStatsDto getUserQaStats(Long userId) {
        // 1) 유저 존재 검증 — 탈퇴자는 없는 것으로 취급한다.
        //    이 엔드포인트는 permitAll 이라 토큰 없이 id 만 바꿔가며 호출할 수 있다.
        //    탈퇴자 통계가 그대로 나가면 탈퇴 계정을 열거할 수 있게 된다.
        boolean active = userRepo.findById(userId).filter(u -> !u.isDeleted()).isPresent();
        if (!active) {
            throw new ApiException(HttpStatus.NOT_FOUND.value(), "사용자를 찾을 수 없어요.");
        }

        // 2) 총 비숨김 질문 수
        long total = questionRepo.countByRecruitmentAuthorIdAndHiddenFalse(userId);

        // 3) 답변 latency 쌍 — (question.createdAt, answer.createdAt)
        List<Object[]> pairs = answerRepo.findAnswerLatencyPairsByAuthorId(userId);
        int answered = pairs.size();

        Integer answerRate = null;
        if (total > 0) {
            answerRate = (int) Math.round(answered * 100.0 / total);
        }

        Long avgLatencyMin = null;
        if (answered > 0) {
            long sumMin = 0L;
            for (Object[] row : pairs) {
                LocalDateTime q = (LocalDateTime) row[0];
                LocalDateTime a = (LocalDateTime) row[1];
                if (q == null || a == null) continue;
                long d = Duration.between(q, a).toMinutes();
                sumMin += Math.max(0L, d);
            }
            avgLatencyMin = Math.round((double) sumMin / answered);
        }

        return new UserQaStatsDto(userId, (int) total, answered, answerRate, avgLatencyMin);
    }

    // ── 헬퍼 ─────────────────────────────────────────

    private Recruitment findRecruitment(Long id) {
        return recruitmentRepo.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "모집글을 찾을 수 없어요."));
    }

    private RecruitmentQuestion findQuestionInRecruitment(Long qId, Long recruitmentId) {
        RecruitmentQuestion q = questionRepo.findById(qId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "질문을 찾을 수 없어요."));
        if (q.getRecruitment() == null || !q.getRecruitment().getId().equals(recruitmentId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST.value(), "질문이 해당 모집글에 속하지 않아요.");
        }
        return q;
    }

    private void checkAuthor(Recruitment r, User user) {
        if (r.getAuthor() == null || !r.getAuthor().getId().equals(user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN.value(), "모집 작성자만 가능해요.");
        }
    }


    private String trimAndValidate(String body, int min, int max, String label) {
        if (body == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST.value(), label + "을(를) 입력해주세요.");
        }
        String trimmed = body.trim();
        if (trimmed.length() < min) {
            throw new ApiException(HttpStatus.BAD_REQUEST.value(),
                    label + "은(는) 최소 " + min + "자 이상이어야 해요.");
        }
        if (trimmed.length() > max) {
            throw new ApiException(HttpStatus.BAD_REQUEST.value(),
                    label + "은(는) 최대 " + max + "자까지 입력 가능해요.");
        }
        return trimmed;
    }
}
