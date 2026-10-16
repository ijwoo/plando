package com.example.todo.service;

import com.example.todo.dto.admin.AdminDtos.*;
import com.example.todo.entity.ContentReport;
import com.example.todo.repository.ContentReportRepository;
import com.example.todo.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 백오피스 개요 화면의 집계.
 *
 * 기준을 한 곳에 모아 둔다 — 화면의 숫자가 서로 다른 기준으로 세어지지 않게.
 *   - 사람: 탈퇴하지 않았고 게스트가 아닌 계정
 *   - 워크스페이스: 샘플이 아니고, 위 기준의 사람이 한 명 이상 있는 곳
 *   - 할 일: 샘플이 아니고, 게스트가 만들지 않은 것
 *
 * 워크스페이스·사용자에는 생성일 컬럼이 없어서 "최근 생성"은 셀 수 없다.
 * 그래서 워크스페이스 목록은 마지막으로 할 일이 생긴 시각 순(최근 활동)으로 보여 준다.
 */
@Service
@RequiredArgsConstructor
public class AdminOverviewService {

    private static final String REAL_USER = "u.deleted_at IS NULL AND u.guest_login_count = 0";
    private static final String REAL_WORKSPACE =
            "w.is_sample = false AND EXISTS (SELECT 1 FROM todo.workspace_member m JOIN todo.users u ON u.id = m.user_id"
                    + " WHERE m.workspace_id = w.id AND " + REAL_USER + ")";
    private static final String REAL_TODO =
            "t.is_sample = false AND NOT EXISTS (SELECT 1 FROM todo.users g WHERE g.id = t.created_by AND g.guest_login_count > 0)";

    @PersistenceContext
    private EntityManager em;

    private final UserRepository userRepo;
    private final ContentReportRepository reportRepo;

    @Transactional(readOnly = true)
    public Overview overview(int requestedDays) {
        int days = requestedDays == 7 ? 7 : 30;
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        // 이번 달 1일부터 지금까지 vs 지난달 1일부터 같은 길이 — 달 중간에 봐도 공정하게 비교된다
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime prevStart = monthStart.minusMonths(1);
        LocalDateTime prevEnd = prevStart.plus(Duration.between(monthStart, now));
        if (prevEnd.isAfter(monthStart)) prevEnd = monthStart;

        return new Overview(
                days,
                userRepo.countMembers(),
                userRepo.countActiveSince(now.minusDays(7)),
                userRepo.countActiveSince(now.minusDays(30)),
                userRepo.countBySuspendedAtIsNotNullAndDeletedAtIsNull(),
                count("SELECT COUNT(*) FROM todo.workspace w WHERE " + REAL_WORKSPACE),
                countTodosBetween(monthStart, now.plusSeconds(1)),
                countTodosBetween(prevStart, prevEnd),
                reportRepo.countByStatus(ContentReport.Status.OPEN),
                daily(today.minusDays(days - 1)),
                teamSizes(),
                recentWorkspaces());
    }

    private long countTodosBetween(LocalDateTime from, LocalDateTime to) {
        return ((Number) em.createNativeQuery(
                        "SELECT COUNT(*) FROM todo.todo t WHERE " + REAL_TODO + " AND t.created_at >= :from AND t.created_at < :to")
                .setParameter("from", from).setParameter("to", to)
                .getSingleResult()).longValue();
    }

    /** 날마다 만든 할 일·완료한 할 일. 없는 날도 0 으로 채워 그래프가 날짜를 건너뛰지 않게 한다. */
    private List<DailyActivity> daily(LocalDate from) {
        Map<LocalDate, Long> created = byDay("created_at", from);
        Map<LocalDate, Long> done = byDay("done_at", from);
        List<DailyActivity> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(LocalDate.now()); d = d.plusDays(1)) {
            out.add(new DailyActivity(d, created.getOrDefault(d, 0L), done.getOrDefault(d, 0L)));
        }
        return out;
    }

    private Map<LocalDate, Long> byDay(String column, LocalDate from) {
        String col = "t." + column;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(
                        "SELECT CAST(" + col + " AS DATE), COUNT(*) FROM todo.todo t WHERE " + REAL_TODO
                                + " AND " + col + " >= :from GROUP BY CAST(" + col + " AS DATE)")
                .setParameter("from", from.atStartOfDay())
                .getResultList();
        Map<LocalDate, Long> m = new HashMap<>();
        for (Object[] r : rows) m.put(toDate(r[0]), ((Number) r[1]).longValue());
        return m;
    }

    /** 멤버 수로 나눈 워크스페이스 — 혼자 쓰는 곳 / 2–5명 / 6명 이상. */
    private List<SizeBucket> teamSizes() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT CASE WHEN c.n = 1 THEN 'SOLO' WHEN c.n <= 5 THEN 'SMALL' ELSE 'LARGE' END AS k, COUNT(*)
                FROM (SELECT w.id, (SELECT COUNT(*) FROM todo.workspace_member m JOIN todo.users u ON u.id = m.user_id
                                    WHERE m.workspace_id = w.id AND %s) AS n
                      FROM todo.workspace w WHERE w.is_sample = false) c
                WHERE c.n > 0
                GROUP BY CASE WHEN c.n = 1 THEN 'SOLO' WHEN c.n <= 5 THEN 'SMALL' ELSE 'LARGE' END
                """.formatted(REAL_USER)).getResultList();
        Map<String, Long> m = new HashMap<>();
        for (Object[] r : rows) m.put((String) r[0], ((Number) r[1]).longValue());
        return List.of(
                new SizeBucket("SOLO", "혼자 (1명)", m.getOrDefault("SOLO", 0L)),
                new SizeBucket("SMALL", "소규모 (2–5명)", m.getOrDefault("SMALL", 0L)),
                new SizeBucket("LARGE", "6명 이상", m.getOrDefault("LARGE", 0L)));
    }

    /** 마지막으로 할 일이 생긴 시각이 최근인 워크스페이스 5곳. */
    private List<WorkspaceItem> recentWorkspaces() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT w.id, w.name,
                       (SELECT COUNT(*) FROM todo.workspace_member m JOIN todo.users u ON u.id = m.user_id
                         WHERE m.workspace_id = w.id AND %1$s) AS members,
                       a.cnt, a.last_at,
                       (SELECT u.name FROM todo.workspace_member m JOIN todo.users u ON u.id = m.user_id
                         WHERE m.workspace_id = w.id AND m.role = 'OWNER' ORDER BY m.id LIMIT 1) AS owner_name,
                       (SELECT u.email FROM todo.workspace_member m JOIN todo.users u ON u.id = m.user_id
                         WHERE m.workspace_id = w.id AND m.role = 'OWNER' ORDER BY m.id LIMIT 1) AS owner_email
                FROM todo.workspace w
                JOIN (SELECT t.workspace_id, COUNT(*) AS cnt, MAX(t.created_at) AS last_at
                      FROM todo.todo t WHERE %2$s GROUP BY t.workspace_id) a ON a.workspace_id = w.id
                WHERE %3$s
                ORDER BY a.last_at DESC, w.id DESC
                LIMIT 5
                """.formatted(REAL_USER, REAL_TODO, REAL_WORKSPACE)).getResultList();
        List<WorkspaceItem> out = new ArrayList<>();
        for (Object[] r : rows) {
            out.add(new WorkspaceItem(((Number) r[0]).longValue(), (String) r[1],
                    ((Number) r[2]).longValue(), ((Number) r[3]).longValue(),
                    (String) r[5], (String) r[6], toDateTime(r[4])));
        }
        return out;
    }

    private long count(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }

    private static LocalDate toDate(Object o) {
        if (o instanceof LocalDate d) return d;
        if (o instanceof java.sql.Date d) return d.toLocalDate();
        if (o instanceof LocalDateTime dt) return dt.toLocalDate();
        if (o instanceof Timestamp ts) return ts.toLocalDateTime().toLocalDate();
        return LocalDate.parse(String.valueOf(o).substring(0, 10));
    }

    private static LocalDateTime toDateTime(Object o) {
        if (o == null) return null;
        if (o instanceof LocalDateTime dt) return dt;
        if (o instanceof Timestamp ts) return ts.toLocalDateTime();
        return LocalDateTime.parse(String.valueOf(o).replace(' ', 'T'));
    }
}
