package com.example.todo.service;

import com.example.todo.dto.admin.AdminDtos.*;
import com.example.todo.entity.AdminAuditLog;
import com.example.todo.entity.ContentReport;
import com.example.todo.entity.Recruitment;
import com.example.todo.entity.RecruitmentQuestion;
import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.*;
import com.example.todo.util.GuestUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 백오피스 조회와 운영자 조치. 호출 전에 AdminAccessInterceptor 가 관리자 + OTP 토큰을 확인한다.
 *
 * 조치(숨김·정지·기각)는 모두 사유가 필요하고, 같은 트랜잭션에서 감사 로그를 남긴다.
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private static final int MAX_PAGE_SIZE = 100;

    private final UserRepository userRepo;
    private final ContentReportRepository reportRepo;
    private final RecruitmentRepository recruitmentRepo;
    private final RecruitmentQuestionRepository questionRepo;
    private final AdminAuditLogRepository auditRepo;
    private final AiUsageDailyRepository aiUsageRepo;

    // ── 대시보드 ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Stats stats() {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        Map<LocalDate, Long> byDay = new HashMap<>();
        for (Object[] row : aiUsageRepo.dailyCallsSince(today.minusDays(13))) {
            byDay.put((LocalDate) row[0], ((Number) row[1]).longValue());
        }
        // 호출이 없던 날도 0 으로 채워 14칸을 맞춘다 — 그래프가 날짜를 건너뛰지 않게.
        List<DailyCount> daily = new ArrayList<>();
        for (int i = 13; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            daily.add(new DailyCount(d, byDay.getOrDefault(d, 0L)));
        }
        return new Stats(
                userRepo.countMembers(),
                userRepo.countActiveSince(now.minusDays(7)),
                userRepo.countActiveSince(now.minusDays(30)),
                userRepo.countBySuspendedAtIsNotNullAndDeletedAtIsNull(),
                reportRepo.countByStatus(ContentReport.Status.OPEN),
                aiUsageRepo.sumCallsSince(today),
                aiUsageRepo.sumCallsSince(today.minusDays(6)),
                daily);
    }

    // ── 신고 ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageOf<ReportItem> reports(String status, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), clamp(size));
        Page<ContentReport> p = (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status))
                ? reportRepo.findAllByOrderByCreatedAtDesc(pr)
                : reportRepo.findByStatusOrderByCreatedAtDesc(
                        ModerationService.parse(ContentReport.Status.class, status, "상태"), pr);

        Map<Long, User> users = usersById(p.getContent().stream()
                .map(ContentReport::getReporterId).collect(Collectors.toSet()));
        List<ReportItem> items = p.getContent().stream().map(r -> {
            User reporter = users.get(r.getReporterId());
            long same = reportRepo.findByTargetTypeAndTargetIdAndStatus(r.getTargetType(), r.getTargetId(),
                    ContentReport.Status.OPEN).size();
            return new ReportItem(r.getId(), r.getTargetType().name(), r.getTargetId(), r.getReason().name(),
                    r.getDetail(), r.getStatus().name(), r.getCreatedAt(),
                    r.getReporterId(), reporter != null ? reporter.getName() : null,
                    same, preview(r.getTargetType(), r.getTargetId()),
                    r.getResolution() != null ? r.getResolution().name() : null,
                    r.getResolutionNote(), r.getHandledAt());
        }).toList();
        return new PageOf<>(items, p.getTotalElements(), p.getNumber(), p.getSize());
    }

    private TargetPreview preview(ContentReport.TargetType type, Long id) {
        return switch (type) {
            case RECRUITMENT -> recruitmentRepo.findById(id).map(r -> new TargetPreview(true, r.getHiddenAt() != null,
                    r.getTitle(), r.getSummary(), idOf(r.getAuthor()), nameOf(r.getAuthor()), emailOf(r.getAuthor())))
                    .orElse(gone());
            case QUESTION -> questionRepo.findById(id).map(q -> new TargetPreview(true, q.isHidden(),
                    q.getRecruitment() != null ? q.getRecruitment().getTitle() : null, q.getBody(),
                    idOf(q.getAsker()), nameOf(q.getAsker()), emailOf(q.getAsker())))
                    .orElse(gone());
            case USER -> userRepo.findById(id).map(u -> new TargetPreview(!u.isDeleted(), u.isSuspended(),
                    u.getName(), null, u.getId(), u.getName(), u.getEmail()))
                    .orElse(gone());
        };
    }

    /**
     * 신고 처리. 같은 대상의 대기 신고는 한꺼번에 닫는다 — 같은 글에 10건이 들어왔으면 10번 누르지 않게.
     */
    @Transactional
    public void resolve(User admin, Long reportId, ResolveRequest req, String ip) {
        ContentReport report = reportRepo.findById(reportId)
                .orElseThrow(() -> new ApiException(404, "신고를 찾을 수 없어요."));
        if (report.getStatus() != ContentReport.Status.OPEN) throw new ApiException(409, "이미 처리된 신고예요.");
        ContentReport.Resolution action = ModerationService.parse(ContentReport.Resolution.class, req.action(), "조치");
        String note = requireReason(req.note());

        switch (action) {
            case HIDE_CONTENT -> hide(admin, report.getTargetType(), report.getTargetId(), note, ip);
            case SUSPEND_USER -> {
                if (report.getTargetUserId() == null) throw new ApiException(400, "정지할 사용자가 없어요.");
                suspend(admin, report.getTargetUserId(), note, ip);
            }
            case DISMISS -> audit(admin, "REPORT_DISMISSED", report.getTargetType().name(), report.getTargetId(), note, ip);
        }

        ContentReport.Status closed = action == ContentReport.Resolution.DISMISS
                ? ContentReport.Status.DISMISSED : ContentReport.Status.RESOLVED;
        LocalDateTime now = LocalDateTime.now();
        for (ContentReport r : reportRepo.findByTargetTypeAndTargetIdAndStatus(
                report.getTargetType(), report.getTargetId(), ContentReport.Status.OPEN)) {
            r.setStatus(closed);
            r.setResolution(action);
            r.setResolutionNote(note);
            r.setHandledBy(admin.getId());
            r.setHandledAt(now);
        }
    }

    @Transactional
    public void hide(User admin, ContentReport.TargetType type, Long id, String reason, String ip) {
        String note = requireReason(reason);
        switch (type) {
            case RECRUITMENT -> {
                Recruitment r = recruitmentRepo.findById(id).orElseThrow(() -> new ApiException(404, "모집글을 찾을 수 없어요."));
                if (r.getHiddenAt() == null) r.setHiddenAt(LocalDateTime.now());
            }
            case QUESTION -> {
                RecruitmentQuestion q = questionRepo.findById(id).orElseThrow(() -> new ApiException(404, "질문을 찾을 수 없어요."));
                q.setHidden(true);
            }
            case USER -> throw new ApiException(400, "사용자는 숨길 수 없어요. 정지를 써 주세요.");
        }
        audit(admin, "CONTENT_HIDDEN", type.name(), id, note, ip);
    }

    /** 숨긴 모집글을 되돌린다. Q&A 는 작성자 삭제와 같은 플래그라 되돌리지 않는다. */
    @Transactional
    public void restoreRecruitment(User admin, Long id, String reason, String ip) {
        String note = requireReason(reason);
        Recruitment r = recruitmentRepo.findById(id).orElseThrow(() -> new ApiException(404, "모집글을 찾을 수 없어요."));
        r.setHiddenAt(null);
        audit(admin, "CONTENT_RESTORED", "RECRUITMENT", id, note, ip);
    }

    // ── 사용자 ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageOf<UserItem> users(String q, int page, int size) {
        Page<User> p = userRepo.searchForAdmin(q == null ? "" : q.trim(), PageRequest.of(Math.max(page, 0), clamp(size)));
        List<UserItem> items = p.getContent().stream().map(u -> new UserItem(
                u.getId(), u.getEmail(), u.getName(), u.getProvider() != null ? u.getProvider().name() : null,
                u.isAdmin(), GuestUtils.isGuest(u), u.getLastActiveAt(), u.getSuspendedAt(), u.getSuspendedReason(),
                reportRepo.countAgainstUser(u.getId()))).toList();
        return new PageOf<>(items, p.getTotalElements(), p.getNumber(), p.getSize());
    }

    @Transactional
    public void suspend(User admin, Long userId, String reason, String ip) {
        String note = requireReason(reason);
        User u = userRepo.findById(userId).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없어요."));
        if (u.getId().equals(admin.getId())) throw new ApiException(400, "나 자신은 정지할 수 없어요.");
        if (u.isAdmin()) throw new ApiException(403, "관리자 계정은 정지할 수 없어요.");
        if (u.isSuspended()) throw new ApiException(409, "이미 정지된 계정이에요.");
        u.setSuspendedAt(LocalDateTime.now());
        u.setSuspendedReason(note);
        audit(admin, "USER_SUSPENDED", "USER", userId, note, ip);
    }

    @Transactional
    public void unsuspend(User admin, Long userId, String reason, String ip) {
        String note = requireReason(reason);
        User u = userRepo.findById(userId).orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없어요."));
        if (!u.isSuspended()) throw new ApiException(409, "정지된 계정이 아니에요.");
        u.setSuspendedAt(null);
        u.setSuspendedReason(null);
        audit(admin, "USER_UNSUSPENDED", "USER", userId, note, ip);
    }

    // ── 감사 로그 ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageOf<AuditItem> audit(int page, int size) {
        Page<AdminAuditLog> p = auditRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(Math.max(page, 0), clamp(size)));
        Map<Long, User> admins = usersById(p.getContent().stream().map(AdminAuditLog::getAdminId).collect(Collectors.toSet()));
        List<AuditItem> items = p.getContent().stream().map(a -> new AuditItem(a.getId(), a.getAdminId(),
                nameOf(admins.get(a.getAdminId())), a.getAction(), a.getTargetType(), a.getTargetId(),
                a.getReason(), a.getIp(), a.getCreatedAt())).toList();
        return new PageOf<>(items, p.getTotalElements(), p.getNumber(), p.getSize());
    }

    // ── 공통 ────────────────────────────────────────────────────

    private void audit(User admin, String action, String type, Long id, String reason, String ip) {
        auditRepo.save(AdminAuditLog.builder().adminId(admin.getId()).action(action)
                .targetType(type).targetId(id).reason(reason).ip(ip).build());
    }

    private static String requireReason(String reason) {
        String r = reason == null ? "" : reason.trim();
        if (r.length() < 2) throw new ApiException(400, "사유를 적어 주세요.");
        if (r.length() > 500) throw new ApiException(400, "사유는 500자까지 쓸 수 있어요.");
        return r;
    }

    private Map<Long, User> usersById(Set<Long> ids) {
        return userRepo.findAllById(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private static int clamp(int size) {
        return Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
    }

    private static TargetPreview gone() {
        return new TargetPreview(false, false, null, null, null, null, null);
    }

    private static Long idOf(User u) { return u != null ? u.getId() : null; }
    private static String nameOf(User u) { return u != null ? u.getName() : null; }
    private static String emailOf(User u) { return u != null ? u.getEmail() : null; }
}
