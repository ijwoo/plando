package com.example.todo.service;

import com.example.todo.dto.admin.AdminDtos.BlockedUser;
import com.example.todo.dto.admin.AdminDtos.ReportRequest;
import com.example.todo.entity.ContentReport;
import com.example.todo.entity.Recruitment;
import com.example.todo.entity.RecruitmentQuestion;
import com.example.todo.entity.User;
import com.example.todo.entity.UserBlock;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.ContentReportRepository;
import com.example.todo.repository.RecruitmentQuestionRepository;
import com.example.todo.repository.RecruitmentRepository;
import com.example.todo.repository.UserBlockRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.util.GuestUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * 사용자 쪽 신고·차단.
 *
 * 신고는 운영자에게 가는 접수일 뿐 그 자체로는 아무것도 숨기지 않는다 — 신고 몇 건으로 자동으로
 * 숨기면, 마음에 안 드는 글을 여럿이 몰려와 지울 수 있게 된다. 숨김·정지는 운영자가 정한다.
 * 차단은 즉시 내 화면에만 적용된다.
 */
@Service
@RequiredArgsConstructor
public class ModerationService {

    /** 한 사람이 하루에 보낼 수 있는 신고 수 — 신고 목록을 도배하지 못하게. */
    static final int DAILY_REPORT_LIMIT = 20;

    private final ContentReportRepository reportRepo;
    private final UserBlockRepository blockRepo;
    private final RecruitmentRepository recruitmentRepo;
    private final RecruitmentQuestionRepository questionRepo;
    private final UserRepository userRepo;
    private final WorkspaceResolver workspaceResolver;

    // ── 신고 ────────────────────────────────────────────────────

    @Transactional
    public void report(String userEmail, ReportRequest req) {
        User me = workspaceResolver.getUser(userEmail);
        GuestUtils.requireNonGuest(me);

        ContentReport.TargetType type = parse(ContentReport.TargetType.class, req.targetType(), "신고 대상");
        ContentReport.Reason reason = parse(ContentReport.Reason.class, req.reason(), "신고 사유");
        if (req.targetId() == null) throw new ApiException(400, "신고 대상을 골라 주세요.");
        String detail = req.detail() == null ? null : req.detail().trim();
        if (detail != null && detail.length() > 500) throw new ApiException(400, "내용은 500자까지 쓸 수 있어요.");
        if (reason == ContentReport.Reason.OTHER && (detail == null || detail.isEmpty())) {
            throw new ApiException(400, "기타 사유는 내용을 적어 주세요.");
        }

        Long targetUserId = targetOwner(type, req.targetId());
        if (me.getId().equals(targetUserId)) throw new ApiException(400, "내 글이나 내 계정은 신고할 수 없어요.");

        if (reportRepo.existsByReporterIdAndTargetTypeAndTargetId(me.getId(), type, req.targetId())) {
            throw new ApiException(409, "이미 신고했어요. 운영자가 확인하고 있어요.");
        }
        if (reportRepo.countByReporterIdAndCreatedAtAfter(me.getId(), LocalDateTime.now().minusDays(1)) >= DAILY_REPORT_LIMIT) {
            throw new ApiException(429, "오늘은 더 신고할 수 없어요. 내일 다시 시도해 주세요.");
        }

        reportRepo.save(ContentReport.builder()
                .reporterId(me.getId())
                .targetType(type)
                .targetId(req.targetId())
                .targetUserId(targetUserId)
                .reason(reason)
                .detail(detail == null || detail.isEmpty() ? null : detail)
                .build());
    }

    /** 대상이 있는지 확인하고 그 작성자(사용자 신고면 그 사람)를 돌려준다. */
    private Long targetOwner(ContentReport.TargetType type, Long id) {
        return switch (type) {
            case RECRUITMENT -> {
                Recruitment r = recruitmentRepo.findById(id)
                        .filter(x -> x.getHiddenAt() == null)
                        .orElseThrow(() -> new ApiException(404, "모집글을 찾을 수 없어요."));
                yield r.getAuthor() != null ? r.getAuthor().getId() : null;
            }
            case QUESTION -> {
                RecruitmentQuestion q = questionRepo.findById(id)
                        .filter(x -> !x.isHidden())
                        .orElseThrow(() -> new ApiException(404, "질문을 찾을 수 없어요."));
                yield q.getAsker().getId();
            }
            case USER -> {
                User u = userRepo.findById(id)
                        .filter(x -> !x.isDeleted())
                        .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없어요."));
                yield u.getId();
            }
        };
    }

    // ── 차단 ────────────────────────────────────────────────────

    @Transactional
    public void block(String userEmail, Long targetId) {
        User me = workspaceResolver.getUser(userEmail);
        GuestUtils.requireNonGuest(me);
        if (me.getId().equals(targetId)) throw new ApiException(400, "나 자신은 차단할 수 없어요.");
        userRepo.findById(targetId).filter(u -> !u.isDeleted())
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없어요."));
        if (blockRepo.findByBlockerIdAndBlockedId(me.getId(), targetId).isPresent()) return; // 멱등
        blockRepo.save(UserBlock.builder().blockerId(me.getId()).blockedId(targetId).build());
    }

    @Transactional
    public void unblock(String userEmail, Long targetId) {
        User me = workspaceResolver.getUser(userEmail);
        blockRepo.findByBlockerIdAndBlockedId(me.getId(), targetId).ifPresent(blockRepo::delete);
    }

    @Transactional(readOnly = true)
    public List<BlockedUser> blocked(String userEmail) {
        User me = workspaceResolver.getUser(userEmail);
        List<UserBlock> blocks = blockRepo.findByBlockerIdOrderByCreatedAtDesc(me.getId());
        var users = userRepo.findAllById(blocks.stream().map(UserBlock::getBlockedId).toList());
        return blocks.stream().map(b -> {
            User u = users.stream().filter(x -> x.getId().equals(b.getBlockedId())).findFirst().orElse(null);
            return new BlockedUser(b.getBlockedId(), u != null ? u.getName() : null,
                    u != null ? u.getProfileImageUrl() : null, b.getCreatedAt());
        }).toList();
    }

    /** 목록에서 뺄 사람들. 비로그인이면 빈 집합. */
    @Transactional(readOnly = true)
    public Set<Long> blockedIds(User me) {
        return me == null ? Set.of() : blockRepo.findBlockedIds(me.getId());
    }

    static <E extends Enum<E>> E parse(Class<E> type, String value, String label) {
        try {
            return Enum.valueOf(type, value == null ? "" : value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, label + " 값이 올바르지 않아요.");
        }
    }
}
