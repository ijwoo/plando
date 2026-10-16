package com.example.todo.controller;

import com.example.todo.config.AdminAccessInterceptor;
import com.example.todo.dto.admin.AdminDtos.*;
import com.example.todo.entity.ContentReport;
import com.example.todo.entity.User;
import com.example.todo.service.AdminAuthService;
import com.example.todo.service.AdminOverviewService;
import com.example.todo.service.AdminService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * 백오피스 API.
 *  - /api/admin/auth/**  : 관리자 확인 + OTP (일반 JWT 만 필요)
 *  - 그 밖의 /api/admin/** : AdminAccessInterceptor 가 OTP 토큰까지 확인한 뒤에만 들어온다
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminAuthService adminAuthService;
    private final AdminService adminService;
    private final AdminOverviewService overviewService;

    // ── 인증 ────────────────────────────────────────────────────

    @GetMapping("/auth/status")
    public AuthStatus status(Authentication auth) {
        return adminAuthService.status(auth.getName());
    }

    @PostMapping("/auth/enroll")
    public EnrollStart startEnroll(Authentication auth) {
        return adminAuthService.startEnroll(auth.getName());
    }

    @PostMapping("/auth/enroll/confirm")
    public AdminToken confirmEnroll(@RequestBody CodeRequest req, Authentication auth, HttpServletRequest http) {
        return adminAuthService.confirmEnroll(auth.getName(), req.code(), http.getRemoteAddr());
    }

    @PostMapping("/auth/verify")
    public AdminToken verify(@RequestBody CodeRequest req, Authentication auth, HttpServletRequest http) {
        return adminAuthService.verify(auth.getName(), req.code(), http.getRemoteAddr());
    }

    // ── 대시보드 ───────────────────────────────────────────────

    @GetMapping("/stats")
    public Stats stats() {
        return adminService.stats();
    }

    /** 개요 화면 — days 는 7 또는 30 (그 밖의 값은 30). */
    @GetMapping("/overview")
    public Overview overview(@RequestParam(defaultValue = "30") int days) {
        return overviewService.overview(days);
    }

    // ── 신고 ────────────────────────────────────────────────────

    @GetMapping("/reports")
    public PageOf<ReportItem> reports(@RequestParam(defaultValue = "OPEN") String status,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size) {
        return adminService.reports(status, page, size);
    }

    @PostMapping("/reports/{id}/resolve")
    public ResponseEntity<Void> resolve(@PathVariable Long id, @RequestBody ResolveRequest req, HttpServletRequest http) {
        adminService.resolve(admin(http), id, req, http.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/recruitments/{id}/hide")
    public ResponseEntity<Void> hideRecruitment(@PathVariable Long id, @RequestBody ReasonRequest req, HttpServletRequest http) {
        adminService.hide(admin(http), ContentReport.TargetType.RECRUITMENT, id, req.reason(), http.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/recruitments/{id}/restore")
    public ResponseEntity<Void> restoreRecruitment(@PathVariable Long id, @RequestBody ReasonRequest req, HttpServletRequest http) {
        adminService.restoreRecruitment(admin(http), id, req.reason(), http.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    // ── 사용자 ──────────────────────────────────────────────────

    @GetMapping("/users")
    public PageOf<UserItem> users(@RequestParam(required = false) String q,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        return adminService.users(q, page, size);
    }

    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<Void> suspend(@PathVariable Long id, @RequestBody ReasonRequest req, HttpServletRequest http) {
        adminService.suspend(admin(http), id, req.reason(), http.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{id}/unsuspend")
    public ResponseEntity<Void> unsuspend(@PathVariable Long id, @RequestBody ReasonRequest req, HttpServletRequest http) {
        adminService.unsuspend(admin(http), id, req.reason(), http.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    // ── 감사 로그 ───────────────────────────────────────────────

    @GetMapping("/audit-logs")
    public PageOf<AuditItem> audit(@RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "30") int size) {
        return adminService.audit(page, size);
    }

    private static User admin(HttpServletRequest http) {
        return (User) http.getAttribute(AdminAccessInterceptor.ADMIN_ATTR);
    }
}
