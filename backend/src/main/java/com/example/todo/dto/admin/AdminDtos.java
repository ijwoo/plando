package com.example.todo.dto.admin;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 백오피스·신고·차단 API 의 요청/응답 모양. */
public final class AdminDtos {

    private AdminDtos() {}

    // ── 사용자 쪽 ───────────────────────────────────────────────

    public record ReportRequest(String targetType, Long targetId, String reason, String detail) {}

    public record BlockedUser(Long id, String name, String profileImageUrl, LocalDateTime blockedAt) {}

    // ── 관리자 인증 ─────────────────────────────────────────────

    /** name·email 은 관리자 화면 아래쪽 계정 표시용 */
    public record AuthStatus(boolean enrolled, String name, String email) {}

    public record EnrollStart(String otpauthUri, String secret) {}

    public record CodeRequest(String code) {}

    public record AdminToken(String token, LocalDateTime expiresAt) {}

    // ── 대시보드 ───────────────────────────────────────────────

    public record DailyCount(LocalDate date, long count) {}

    /** 개요 화면 한 장. 숫자는 모두 게스트·탈퇴·샘플을 뺀 값이다. */
    public record Overview(int days,
                           long members, long active7d, long active30d, long suspended,
                           long workspaces,
                           long todosThisMonth, long todosLastMonth,
                           long openReports,
                           List<DailyActivity> daily,
                           List<SizeBucket> teamSizes,
                           List<WorkspaceItem> recentWorkspaces) {}

    public record DailyActivity(LocalDate date, long created, long done) {}

    public record SizeBucket(String key, String label, long count) {}

    public record WorkspaceItem(Long id, String name, long members, long todos,
                                String ownerName, String ownerEmail, LocalDateTime lastActivityAt) {}

    public record Stats(long members, long active7d, long active30d, long suspended,
                        long openReports, long aiCallsToday, long aiCalls7d,
                        List<DailyCount> aiCallsDaily) {}

    // ── 신고 ────────────────────────────────────────────────────

    /** 신고 대상의 지금 모습 — 운영자가 원문을 보고 판단하게. 지워졌으면 exists=false. */
    public record TargetPreview(boolean exists, boolean hidden, String title, String body,
                                Long authorId, String authorName, String authorEmail) {}

    public record ReportItem(Long id, String targetType, Long targetId, String reason, String detail,
                             String status, LocalDateTime createdAt,
                             Long reporterId, String reporterName,
                             long sameTargetCount, TargetPreview target,
                             String resolution, String resolutionNote, LocalDateTime handledAt) {}

    public record ResolveRequest(String action, String note) {}

    // ── 사용자 ──────────────────────────────────────────────────

    public record UserItem(Long id, String email, String name, String provider, boolean admin,
                           boolean guest, LocalDateTime lastActiveAt, LocalDateTime suspendedAt,
                           String suspendedReason, long reportCount) {}

    public record ReasonRequest(String reason) {}

    // ── 감사 로그 ───────────────────────────────────────────────

    public record AuditItem(Long id, Long adminId, String adminName, String action, String targetType,
                            Long targetId, String reason, String ip, LocalDateTime createdAt) {}

    public record PageOf<T>(List<T> items, long total, int page, int size) {}
}
