package com.example.todo.controller;

import com.example.todo.dto.NotificationResponseDto;
import com.example.todo.dto.PushSubscriptionRequest;
import com.example.todo.entity.Workspace;
import com.example.todo.service.ApnsService;
import com.example.todo.service.NotificationService;
import com.example.todo.service.WebPushService;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final WebPushService webPushService;
    private final ApnsService apnsService;
    private final WorkspaceResolver workspaceResolver;

    @GetMapping
    public List<NotificationResponseDto> getMyNotifications(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        return notificationService.getMyNotifications(userEmail, workspace.getId());
    }

    /**
     * Dashboard PriorityStack용 — type 필터로 알림 조회.
     * 예: GET /api/notifications/by-types?types=TASK_ASSIGNED,MENTION&limit=5
     */
    @GetMapping("/by-types")
    public List<NotificationResponseDto> getNotificationsByTypes(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            @RequestParam("types") List<String> types,
            @RequestParam(value = "limit", required = false) Integer limit
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        return notificationService.getNotificationsByTypes(userEmail, workspace.getId(), types, limit);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        long unreadCount = notificationService.getUnreadCount(userEmail, workspace.getId());
        return Map.of("unreadCount", unreadCount);
    }

    @PatchMapping("/{id}/read")
    public void markAsRead(@PathVariable Long id, Authentication authentication) {
        String userEmail = authentication.getName();
        notificationService.markAsRead(id, userEmail);
    }

    @PatchMapping("/read-all")
    public void markAllAsRead(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        notificationService.markAllAsRead(userEmail, workspace.getId());
    }

    // ── 팀 모집 전용 알림 ────────────────────────────────────────────

    @GetMapping("/recruitment")
    public List<NotificationResponseDto> getRecruitmentNotifications(Authentication authentication) {
        String userEmail = authentication.getName();
        return notificationService.getRecruitmentNotifications(userEmail);
    }

    @GetMapping("/recruitment/unread-count")
    public Map<String, Long> getRecruitmentUnreadCount(Authentication authentication) {
        String userEmail = authentication.getName();
        return Map.of("unreadCount", notificationService.getRecruitmentUnreadCount(userEmail));
    }

    @PatchMapping("/recruitment/read-all")
    public void markAllRecruitmentAsRead(Authentication authentication) {
        String userEmail = authentication.getName();
        notificationService.markAllRecruitmentAsRead(userEmail);
    }

    // ── Web Push ────────────────────────────────────────────────────

    @GetMapping("/vapid-public-key")
    public ResponseEntity<Map<String, String>> getVapidPublicKey() {
        if (!webPushService.isAvailable()) {
            return ResponseEntity.status(503).body(Map.of("error", "Push service not available"));
        }
        return ResponseEntity.ok(Map.of("publicKey", webPushService.getVapidPublicKey()));
    }

    @PostMapping("/push/subscribe")
    public ResponseEntity<Void> subscribe(@Valid @RequestBody PushSubscriptionRequest body, Authentication authentication) {
        if (!webPushService.isAvailable()) {
            return ResponseEntity.status(503).build();
        }
        String userEmail = authentication.getName();
        webPushService.subscribe(
            userEmail,
            body.getEndpoint(),
            body.getKeys().getP256dh(),
            body.getKeys().getAuth()
        );
        return ResponseEntity.ok().build();
    }

    /**
     * 구독 해지 — 본인 구독만.
     * 예전엔 Authentication 을 아예 받지 않아서, 로그인만 되어 있으면 남의 endpoint 로
     * 그 사람의 푸시를 꺼버릴 수 있었다.
     */
    @DeleteMapping("/push/unsubscribe")
    public ResponseEntity<Void> unsubscribe(@RequestBody Map<String, String> body, Authentication authentication) {
        webPushService.unsubscribe(authentication.getName(), body.get("endpoint"));
        return ResponseEntity.ok().build();
    }

    /** iOS APNs 디바이스 토큰 등록. */
    @PostMapping("/push/ios/register")
    public ResponseEntity<Void> registerApnsToken(@RequestBody Map<String, String> body, Authentication authentication) {
        String userEmail = authentication.getName();
        String token = body.get("deviceToken");
        if (token == null || token.isBlank()) {
            log.warn("[APNs/register] empty deviceToken from user={}", userEmail);
            return ResponseEntity.badRequest().build();
        }
        if (!apnsService.isAvailable()) {
            log.warn("[APNs/register] service unavailable, user={}, tokenPrefix={}", userEmail, prefix(token));
            return ResponseEntity.status(503).build();
        }
        log.info("[APNs/register] user={}, tokenPrefix={}, tokenLen={}", userEmail, prefix(token), token.length());
        apnsService.register(userEmail, token);
        return ResponseEntity.ok().build();
    }

    /** iOS APNs 토큰 해제 — 본인 토큰만. (구독 해지와 같은 이유로 소유자 검사 추가) */
    @DeleteMapping("/push/ios/unregister")
    public ResponseEntity<Void> unregisterApnsToken(@RequestBody Map<String, String> body, Authentication authentication) {
        String token = body.get("deviceToken");
        if (token == null || token.isBlank()) return ResponseEntity.badRequest().build();
        log.info("[APNs/unregister] user={}, tokenPrefix={}", authentication.getName(), prefix(token));
        apnsService.unregister(authentication.getName(), token);
        return ResponseEntity.ok().build();
    }

    private static String prefix(String token) {
        return token.length() >= 8 ? token.substring(0, 8) : token;
    }
}
