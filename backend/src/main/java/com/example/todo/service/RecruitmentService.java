package com.example.todo.service;

import com.example.todo.dto.RecruitmentApplicationDto;
import com.example.todo.dto.RecruitmentCreateRequest;
import com.example.todo.dto.RecruitmentDetailResponse;
import com.example.todo.dto.RecruitmentListResponse;
import com.example.todo.entity.*;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecruitmentService {

    private final RecruitmentRepository recruitmentRepo;
    private final RecruitmentApplicationRepository applicationRepo;
    private final RecruitmentMemberRepository memberRepo;
    private final RecruitmentBookmarkRepository bookmarkRepo;
    private final RecruitmentQuestionRepository questionRepo;
    private final UserRepository userRepo;
    private final WorkspaceRepository workspaceRepo;
    private final WorkspaceMemberRepository workspaceMemberRepo;
    private final NotificationService notificationService;
    private final UserBlockRepository blockRepo;

    // ── 목록 조회 ────────────────────────────────────────────────

    public List<RecruitmentListResponse> getList(User currentUser) {
        Map<Long, String> statusMap = buildAppliedStatusMap(currentUser);
        LocalDate today = LocalDate.now();

        Set<Long> blocked = blockedIds(currentUser);
        return recruitmentRepo.findByStatusOrderByIdDesc("모집중").stream()
                .filter(r -> visible(r, blocked))
                .filter(r -> r.getDeadline() == null || !r.getDeadline().isBefore(today))
                .sorted((a, b) -> Double.compare(calcRecommendScore(b, today), calcRecommendScore(a, today)))
                .map(r -> toListResponse(r, currentUser, statusMap.get(r.getId())))
                .collect(Collectors.toList());
    }

    private double calcRecommendScore(Recruitment r, LocalDate today) {
        // 마감 긴박도 (35%)
        double urgency = 0.3;
        if (r.getDeadline() != null) {
            long days = today.until(r.getDeadline(), ChronoUnit.DAYS);
            if (days <= 3)       urgency = 1.0;
            else if (days <= 7)  urgency = 0.85;
            else if (days <= 14) urgency = 0.70;
            else if (days <= 30) urgency = 0.40;
            else                 urgency = 0.10;
        }

        // 최신성 (30%) — 오래될수록 감쇠
        double recency = 0.5;
        if (r.getCreatedAt() != null) {
            long daysSince = ChronoUnit.DAYS.between(r.getCreatedAt().toLocalDate(), today);
            recency = 1.0 / (1.0 + daysSince * 0.05);
        }

        // 인기도 (20%) — 100뷰 기준 정규화
        double popularity = Math.min(r.getViewCount() / 100.0, 1.0);

        // 자리 여유도 (15%) — 꽉 찬 글은 낮게
        double vacancy = 1.0;
        if (r.getMaxMembers() > 0) {
            int filled = r.getMembers().size();
            vacancy = Math.max(0.0, (double)(r.getMaxMembers() - filled) / r.getMaxMembers());
        }

        return urgency * 0.35 + recency * 0.30 + popularity * 0.20 + vacancy * 0.15;
    }

    public List<RecruitmentListResponse> getMyRecruitments(User currentUser) {
        Map<Long, String> statusMap = buildAppliedStatusMap(currentUser);
        return recruitmentRepo.findByAuthorOrderByIdDesc(currentUser).stream()
                .map(r -> {
                    RecruitmentListResponse resp = toListResponse(r, currentUser, statusMap.get(r.getId()));
                    // mine 탭에서만 미답변 Q&A 수 노출
                    resp.setUnansweredCount((int) questionRepo.countUnansweredByRecruitmentId(r.getId()));
                    return resp;
                })
                .collect(Collectors.toList());
    }

    public List<RecruitmentListResponse> getBookmarkedRecruitments(User currentUser) {
        Map<Long, String> statusMap = buildAppliedStatusMap(currentUser);
        Set<Long> blocked = blockedIds(currentUser);
        return bookmarkRepo.findBookmarkedRecruitmentsByUser(currentUser).stream()
                .filter(r -> visible(r, blocked))
                .map(r -> toListResponse(r, currentUser, statusMap.get(r.getId())))
                .collect(Collectors.toList());
    }

    public List<RecruitmentListResponse> getAppliedRecruitments(User currentUser) {
        Map<Long, String> statusMap = buildAppliedStatusMap(currentUser);
        return applicationRepo.findByApplicantOrderByAppliedAtDesc(currentUser).stream()
                .filter(app -> app.getRecruitment().getHiddenAt() == null)
                .map(app -> toListResponse(app.getRecruitment(), currentUser, statusMap.get(app.getRecruitment().getId())))
                .collect(Collectors.toList());
    }

    public List<RecruitmentListResponse> search(String keyword, User currentUser) {
        Map<Long, String> statusMap = buildAppliedStatusMap(currentUser);
        Set<Long> blocked = blockedIds(currentUser);
        return recruitmentRepo.searchByKeyword(keyword).stream()
                .filter(r -> visible(r, blocked))
                .map(r -> toListResponse(r, currentUser, statusMap.get(r.getId())))
                .collect(Collectors.toList());
    }

    /**
     * 남에게 보여도 되는 글인가 — 운영자가 숨기지 않았고, 내가 차단한 사람의 글이 아니다.
     * "내 모집" 탭은 이 필터를 타지 않는다(숨겨진 내 글도 내게는 보인다).
     */
    private static boolean visible(Recruitment r, Set<Long> blocked) {
        if (r.getHiddenAt() != null) return false;
        return r.getAuthor() == null || !blocked.contains(r.getAuthor().getId());
    }

    private Set<Long> blockedIds(User currentUser) {
        return currentUser == null ? Set.of() : blockRepo.findBlockedIds(currentUser.getId());
    }

    /** 현재 사용자의 활성 지원 상태를 recruitmentId → status 맵으로 한 번에 로드 */
    private Map<Long, String> buildAppliedStatusMap(User currentUser) {
        if (currentUser == null) return Map.of();
        return applicationRepo.findActiveByApplicant(currentUser).stream()
                .collect(Collectors.toMap(
                        app -> app.getRecruitment().getId(),
                        app -> app.getStatus(),
                        (a, b) -> a   // 중복 시 첫 번째 유지
                ));
    }

    // ── 상세 조회 ────────────────────────────────────────────────

    @Transactional
    public RecruitmentDetailResponse getDetail(Long id, User currentUser) {
        Recruitment r = findById(id);
        boolean mine = currentUser != null && r.getAuthor() != null
                && r.getAuthor().getId().equals(currentUser.getId());
        // 운영자가 숨긴 글은 작성자 말고는 없는 글처럼 — 링크를 알아도 열리지 않는다.
        if (r.getHiddenAt() != null && !mine) {
            throw new ApiException(HttpStatus.NOT_FOUND.value(), "모집글을 찾을 수 없어요.");
        }
        r.setViewCount(r.getViewCount() + 1);

        long applicantsCount = applicationRepo.countByRecruitmentAndStatus(r, "PENDING")
                + applicationRepo.countByRecruitmentAndStatus(r, "ACCEPTED");

        boolean bookmarked = currentUser != null &&
                bookmarkRepo.existsByRecruitmentAndUser(r, currentUser);

        String appliedStatus = null;
        if (currentUser != null) {
            appliedStatus = applicationRepo.findByRecruitmentAndApplicant(r, currentUser)
                    .map(app -> app.getStatus())
                    .orElse(null);
        }

        boolean isAuthor = currentUser != null && r.getAuthor() != null
                && r.getAuthor().getId().equals(currentUser.getId());

        // 역할별 수락 인원 집계 — accepted 상태 + selectedRole 가 있는 신청만
        Map<Long, Integer> roleAcceptedCounts = buildRoleAcceptedCounts(r);

        RecruitmentDetailResponse resp = new RecruitmentDetailResponse(
                r, bookmarked, (int) applicantsCount, appliedStatus, isAuthor, roleAcceptedCounts);
        // Q&A 카운트 — 탭 배지 + 작성자 강조용
        resp.setQuestionCount((int) questionRepo.countByRecruitmentIdAndHiddenFalse(r.getId()));
        resp.setUnansweredCount((int) questionRepo.countUnansweredByRecruitmentId(r.getId()));
        resp.setPendingApplicants((int) applicationRepo.countByRecruitmentAndStatus(r, "PENDING"));
        return resp;
    }

    /** ACCEPTED 상태 신청에서 selectedRole 기준으로 인원 집계. */
    private Map<Long, Integer> buildRoleAcceptedCounts(Recruitment r) {
        Map<Long, Integer> counts = new HashMap<>();
        applicationRepo.findByRecruitmentAndStatusNotOrderByAppliedAtDesc(r, "CANCELLED").stream()
                .filter(a -> "ACCEPTED".equals(a.getStatus()) && a.getSelectedRole() != null)
                .forEach(a -> counts.merge(a.getSelectedRole().getId(), 1, Integer::sum));
        return counts;
    }

    // ── 생성 ─────────────────────────────────────────────────────

    @Transactional
    public RecruitmentListResponse create(RecruitmentCreateRequest req, User author) {
        /* 클라이언트가 준 workspaceId 를 그대로 믿으면 안 된다.
           예전엔 findById 만 하고 소속을 확인하지 않았다. 워크스페이스 id 는 순차값이라,
           남의 id 로 모집글을 만들면 그 글의 '작성자'가 되고 → 상세 응답이 작성자에게
           **그 워크스페이스의 초대코드를 그대로 내려주고**(RecruitmentDetailResponse:114-117)
           → 그 코드로 join 하면 남의 팀에 MEMBER 로 들어갈 수 있었다. 워크스페이스 탈취다.
           또 수락 처리(:461-472)는 joinWorkspace 의 가드를 우회해 멤버를 직접 심으므로,
           작성자가 임의 인물을 남의 팀에 넣는 것도 가능했다.
           내가 속한 워크스페이스만 연결할 수 있게 한다. */
        Workspace workspace = null;
        if (req.getWorkspaceId() != null) {
            workspace = workspaceRepo.findById(req.getWorkspaceId())
                    .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));
            if (!workspaceMemberRepo.existsByWorkspaceAndUser(workspace, author)) {
                throw new ApiException(403, "참여 중인 워크스페이스만 모집글에 연결할 수 있어요.");
            }
        }

        Recruitment r = Recruitment.builder()
                .title(req.getTitle())
                .summary(req.getSummary())
                .category(req.getCategory())
                .status("모집중")
                .locationText(req.getLocationText())
                .locationLat(req.getLocationLat())
                .locationLng(req.getLocationLng())
                .hasLocation(req.isHasLocation())
                .maxMembers(req.getMaxMembers() > 0 ? req.getMaxMembers() : 4)
                .deadline(req.getDeadline())
                .meetType(java.util.Optional.ofNullable(Recruitment.normalizeMeetType(req.getMeetType())).orElse("online"))
                .frequency(req.getFrequency())
                .duration(req.getDuration())
                .leaderRole(req.getLeaderRole())
                .leaderBio(req.getLeaderBio())
                .requirements(req.getRequirements())
                .author(author)
                .workspace(workspace)
                .build();

        // 기술스택
        if (req.getTechStacks() != null)
            r.getTechStacks().addAll(req.getTechStacks());

        // 협업 도구
        if (req.getTools() != null)
            r.getTools().addAll(req.getTools());

        recruitmentRepo.save(r);

        // 역할 추가
        if (req.getRoles() != null) {
            for (RecruitmentCreateRequest.RoleRequest rr : req.getRoles()) {
                RecruitmentRole role = RecruitmentRole.builder()
                        .recruitment(r)
                        .name(rr.getName())
                        .count(rr.getCount() > 0 ? rr.getCount() : 1)
                        .description(rr.getDescription())
                        .status("모집중")
                        .build();
                r.getRoles().add(role);
            }
        }

        // 작성자를 첫 번째 멤버로 추가
        RecruitmentMember leaderMember = RecruitmentMember.builder()
                .recruitment(r)
                .user(author)
                .roleLabel(req.getLeaderRole() != null ? req.getLeaderRole() : "팀장")
                .build();
        r.getMembers().add(leaderMember);

        recruitmentRepo.save(r);
        return toListResponse(r, author, null); // 본인 글이므로 appliedStatus null
    }

    // ── 수정 ─────────────────────────────────────────────────────

    @Transactional
    public RecruitmentDetailResponse update(Long id, RecruitmentCreateRequest req, User currentUser) {
        Recruitment r = findById(id);
        checkAuthor(r, currentUser);

        r.setTitle(req.getTitle());
        r.setSummary(req.getSummary());
        r.setCategory(req.getCategory());
        r.setLocationText(req.getLocationText());
        r.setLocationLat(req.getLocationLat());
        r.setLocationLng(req.getLocationLng());
        r.setHasLocation(req.isHasLocation());
        r.setMaxMembers(req.getMaxMembers() > 0 ? req.getMaxMembers() : r.getMaxMembers());
        r.setDeadline(req.getDeadline());
        r.setMeetType(Recruitment.normalizeMeetType(req.getMeetType()));
        r.setFrequency(req.getFrequency());
        r.setDuration(req.getDuration());
        r.setLeaderRole(req.getLeaderRole());
        r.setLeaderBio(req.getLeaderBio());
        r.setRequirements(req.getRequirements());

        if (req.getTechStacks() != null) {
            r.getTechStacks().clear();
            r.getTechStacks().addAll(req.getTechStacks());
        }
        if (req.getTools() != null) {
            r.getTools().clear();
            r.getTools().addAll(req.getTools());
        }
        if (req.getRoles() != null) {
            r.getRoles().clear();
            for (RecruitmentCreateRequest.RoleRequest rr : req.getRoles()) {
                RecruitmentRole role = RecruitmentRole.builder()
                        .recruitment(r)
                        .name(rr.getName())
                        .count(rr.getCount() > 0 ? rr.getCount() : 1)
                        .description(rr.getDescription())
                        .status("모집중")
                        .build();
                r.getRoles().add(role);
            }
        }

        long applicantsCount = applicationRepo.countByRecruitmentAndStatus(r, "PENDING")
                + applicationRepo.countByRecruitmentAndStatus(r, "ACCEPTED");
        boolean isAuthor = r.getAuthor() != null && r.getAuthor().getId().equals(currentUser.getId());
        RecruitmentDetailResponse updated = new RecruitmentDetailResponse(r, false, (int) applicantsCount, null, isAuthor,
                buildRoleAcceptedCounts(r));
        updated.setPendingApplicants((int) applicationRepo.countByRecruitmentAndStatus(r, "PENDING"));
        return updated;
    }

    // ── 상태 변경 ────────────────────────────────────────────────

    private static final java.util.Set<String> VALID_STATUSES = java.util.Set.of("모집중", "모집완료", "진행중");

    @Transactional
    public void updateStatus(Long id, String status, User currentUser) {
        if (!VALID_STATUSES.contains(status)) {
            throw new com.example.todo.exception.ApiException(400, "유효하지 않은 상태값입니다: " + status);
        }
        Recruitment r = findById(id);
        checkAuthor(r, currentUser);
        r.setStatus(status);
    }

    // ── 삭제 ─────────────────────────────────────────────────────

    @Transactional
    public void delete(Long id, User currentUser) {
        Recruitment r = findById(id);
        checkAuthor(r, currentUser);
        recruitmentRepo.delete(r);
    }

    // ── 지원 신청 / 취소 ─────────────────────────────────────────

    @Transactional
    public String toggleApply(Long recruitmentId, String message, Long roleId, User currentUser) {
        Recruitment r = findPublic(recruitmentId);

        if (r.getAuthor() != null && r.getAuthor().getId().equals(currentUser.getId()))
            throw new ApiException(HttpStatus.BAD_REQUEST.value(), "자신의 모집글에는 지원할 수 없어요.");

        // 신청 시 역할 선택 (취소가 아닌 신청/재신청에만 필요) — roleId가 있으면 같은 모집글의 role 인지 검증
        RecruitmentRole selectedRole = resolveRole(r, roleId);

        Optional<RecruitmentApplication> existing =
                applicationRepo.findByRecruitmentAndApplicant(r, currentUser);

        String authorEmail = r.getAuthor() != null ? r.getAuthor().getEmail() : null;
        Long workspaceId = r.getWorkspace() != null ? r.getWorkspace().getId() : null;

        if (existing.isPresent()) {
            RecruitmentApplication app = existing.get();
            /* REJECTED 도 재신청으로 본다.
               예전엔 CANCELLED 만 재신청 분기를 타서, 거절당한 사람이 "다시 지원하기"를 누르면
               else 로 떨어져 **지원이 아니라 취소로 처리**됐다. 화면은 "지원을 취소했어요"라고
               띄웠고, 한 번 더 눌러야 겨우 PENDING 이 됐다. 앱은 그 사이 두 번 호출하는 우회
               로직을 넣어 두었는데, 여기서 고치면 그 우회는 스스로 꺼진다. */
            String cur = app.getStatus();
            if ("CANCELLED".equals(cur) || "REJECTED".equals(cur)) {
                // 재신청 — 역할은 새로 선택한 것 또는 기존 유지
                app.setStatus("PENDING");
                app.setMessage(message);
                if (selectedRole != null) app.setSelectedRole(selectedRole);
                if (authorEmail != null) {
                    notificationService.createNotification(
                            authorEmail, currentUser.getEmail(),
                            NotificationType.RECRUITMENT_APPLIED.name(),
                            "새 지원자",
                            "'" + r.getTitle() + "' 에 " + currentUser.getName() + " 님이 다시 지원했습니다.",
                            r.getId(), workspaceId);
                }
                return "PENDING";
            } else {
                app.setStatus("CANCELLED");
                return "CANCELLED";
            }
        }

        RecruitmentApplication app = RecruitmentApplication.builder()
                .recruitment(r)
                .applicant(currentUser)
                .status("PENDING")
                .message(message)
                .selectedRole(selectedRole)
                .build();
        applicationRepo.save(app);

        if (authorEmail != null) {
            notificationService.createNotification(
                    authorEmail, currentUser.getEmail(),
                    NotificationType.RECRUITMENT_APPLIED.name(),
                    "새 지원자",
                    "'" + r.getTitle() + "' 에 " + currentUser.getName() + " 님이 지원했습니다.",
                    r.getId(), workspaceId);
        }
        return "PENDING";
    }

    /** roleId 가 같은 모집글의 role 인지 확인 후 반환. null/0 이면 null. */
    private RecruitmentRole resolveRole(Recruitment r, Long roleId) {
        if (roleId == null || roleId <= 0) return null;
        return r.getRoles().stream()
                .filter(role -> role.getId().equals(roleId))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(),
                        "선택한 역할을 모집글에서 찾을 수 없어요."));
    }

    // ── 북마크 토글 ──────────────────────────────────────────────

    @Transactional
    public boolean toggleBookmark(Long recruitmentId, User currentUser) {
        Recruitment r = findPublic(recruitmentId);
        Optional<RecruitmentBookmark> existing =
                bookmarkRepo.findByRecruitmentAndUser(r, currentUser);

        if (existing.isPresent()) {
            bookmarkRepo.delete(existing.get());
            return false;
        }
        bookmarkRepo.save(RecruitmentBookmark.builder()
                .recruitment(r)
                .user(currentUser)
                .build());
        return true;
    }

    // ── 신청자 목록 조회 ──────────────────────────────────────────

    public List<RecruitmentApplicationDto> getApplications(Long recruitmentId, User currentUser) {
        Recruitment r = findById(recruitmentId);
        checkAuthor(r, currentUser);
        return applicationRepo.findByRecruitmentAndStatusNotOrderByAppliedAtDesc(r, "CANCELLED")
                .stream()
                .map(RecruitmentApplicationDto::new)
                .collect(Collectors.toList());
    }

    // ── 신청 수락/거절 ────────────────────────────────────────────

    @Transactional
    public RecruitmentApplicationDto reviewApplication(Long recruitmentId, Long appId,
                                                       String action, User currentUser) {
        Recruitment r = findById(recruitmentId);
        checkAuthor(r, currentUser);

        RecruitmentApplication app = applicationRepo.findById(appId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "지원 신청을 찾을 수 없어요."));

        if (!app.getRecruitment().getId().equals(recruitmentId))
            throw new ApiException(HttpStatus.BAD_REQUEST.value(), "잘못된 요청입니다.");

        String authorEmail = r.getAuthor() != null ? r.getAuthor().getEmail() : null;
        Long workspaceId = r.getWorkspace() != null ? r.getWorkspace().getId() : null;

        if ("accept".equalsIgnoreCase(action)) {
            // 전체 정원 초과 방지
            if (r.getMembers().size() >= r.getMaxMembers()) {
                throw new ApiException(HttpStatus.BAD_REQUEST.value(),
                        "모집 정원(" + r.getMaxMembers() + "명)이 이미 가득 찼습니다.");
            }

            // 역할별 정원 초과 방지 — selectedRole 이 있는 지원에만 적용
            RecruitmentRole role = app.getSelectedRole();
            if (role != null) {
                Map<Long, Integer> acceptedByRole = buildRoleAcceptedCounts(r);
                int accepted = acceptedByRole.getOrDefault(role.getId(), 0);
                if (accepted >= role.getCount()) {
                    throw new ApiException(HttpStatus.BAD_REQUEST.value(),
                            "'" + role.getName() + "' 역할은 이미 모집이 완료됐어요.");
                }
            }

            app.setStatus("ACCEPTED");
            User applicant = app.getApplicant();

            // 1) RecruitmentMember 추가 (중복 방지)
            boolean alreadyRecruitMember = r.getMembers().stream()
                    .anyMatch(m -> m.getUser() != null && m.getUser().getId().equals(applicant.getId()));
            if (!alreadyRecruitMember) {
                RecruitmentMember member = RecruitmentMember.builder()
                        .recruitment(r)
                        .user(applicant)
                        .roleLabel(role != null ? role.getName() : "팀원")
                        .build();
                r.getMembers().add(member);
            }

            // 2) 연결된 워크스페이스에 멤버 추가 (중복 방지)
            if (r.getWorkspace() != null) {
                Workspace ws = r.getWorkspace();
                boolean alreadyWsMember = workspaceMemberRepo.existsByWorkspaceAndUser(ws, applicant);
                if (!alreadyWsMember) {
                    WorkspaceMember wsMember = WorkspaceMember.builder()
                            .workspace(ws)
                            .user(applicant)
                            .role(WorkspaceRole.MEMBER)
                            .build();
                    workspaceMemberRepo.save(wsMember);
                }
            }

            // 3) 정원이 찼으면 모집완료 자동 전환
            if (r.getMembers().size() >= r.getMaxMembers()) {
                r.setStatus("모집완료");
            }

            // 4) 신청자에게 수락 알림
            notificationService.createNotification(
                    applicant.getEmail(), authorEmail,
                    NotificationType.RECRUITMENT_ACCEPTED.name(),
                    "지원 수락",
                    "'" + r.getTitle() + "' 팀에 합류하셨습니다!",
                    r.getId(), workspaceId);

        } else if ("reject".equalsIgnoreCase(action)) {
            app.setStatus("REJECTED");

            // 신청자에게 거절 알림
            notificationService.createNotification(
                    app.getApplicant().getEmail(), authorEmail,
                    NotificationType.RECRUITMENT_REJECTED.name(),
                    "지원 결과 안내",
                    "'" + r.getTitle() + "' 지원이 아쉽게도 거절되었습니다.",
                    r.getId(), workspaceId);
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST.value(), "action은 accept 또는 reject 이어야 합니다.");
        }

        return new RecruitmentApplicationDto(app);
    }

    // ── 체크리스트 토글 ───────────────────────────────────────────

    @Transactional
    public void toggleChecklist(Long recruitmentId, Long checklistId, User currentUser) {
        Recruitment r = findById(recruitmentId);
        checkAuthor(r, currentUser);

        r.getChecklist().stream()
                .filter(c -> c.getId().equals(checklistId))
                .findFirst()
                .ifPresent(c -> c.setDone(!c.isDone()));
    }

    // ── 유틸 ─────────────────────────────────────────────────────

    /** 남이 다루는 경로(지원·북마크)용 — 운영자가 숨긴 글은 없는 글로 본다. */
    private Recruitment findPublic(Long id) {
        Recruitment r = findById(id);
        if (r.getHiddenAt() != null) throw new ApiException(HttpStatus.NOT_FOUND.value(), "모집글을 찾을 수 없어요.");
        return r;
    }

    private Recruitment findById(Long id) {
        return recruitmentRepo.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "모집글을 찾을 수 없어요."));
    }

    private void checkAuthor(Recruitment r, User currentUser) {
        if (r.getAuthor() == null || !r.getAuthor().getId().equals(currentUser.getId()))
            throw new ApiException(HttpStatus.FORBIDDEN.value(), "작성자만 수정/삭제할 수 있어요.");
    }

    private RecruitmentListResponse toListResponse(Recruitment r, User currentUser, String appliedStatus) {
        boolean bookmarked = currentUser != null &&
                bookmarkRepo.existsByRecruitmentAndUser(r, currentUser);
        return new RecruitmentListResponse(r, bookmarked, appliedStatus);
    }
}
