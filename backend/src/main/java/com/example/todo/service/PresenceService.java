package com.example.todo.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * STOMP 세션 기반 사용자 presence 추적.
 *
 * - SessionConnectedEvent → 해당 email 의 active session count++ + lastSeen 갱신
 * - SessionDisconnectEvent → count--, 0 이면 offline
 *
 * 메모리 기반 (단일 인스턴스 가정). 다중 인스턴스 배포 시 Redis 등 분산 store 필요.
 *
 * Dashboard TeamStatusList / DM 채팅 헤더에서 사용.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;
    private final com.example.todo.repository.UserRepository userRepository;
    private final com.example.todo.repository.WorkspaceMemberRepository workspaceMemberRepository;

    private final ConcurrentHashMap<String, java.util.concurrent.atomic.AtomicInteger> sessionCount = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Instant> lastSeen = new ConcurrentHashMap<>();

    @EventListener
    public void onConnect(SessionConnectedEvent event) {
        String email = extractEmail(event.getUser());
        if (email == null) return;
        java.util.concurrent.atomic.AtomicInteger counter = sessionCount.computeIfAbsent(email, k -> new java.util.concurrent.atomic.AtomicInteger(0));
        int newCount = counter.incrementAndGet();
        lastSeen.put(email, Instant.now());
        log.debug("[presence] connect email={} sessions={}", email, newCount);
        if (newCount == 1) broadcast(email, true);
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = accessor.getUser();
        String email = extractEmail(user);
        if (email == null) return;
        java.util.concurrent.atomic.AtomicInteger counter = sessionCount.get(email);
        int newCount = counter != null ? counter.decrementAndGet() : 0;
        if (newCount <= 0) sessionCount.remove(email);
        lastSeen.put(email, Instant.now());
        log.debug("[presence] disconnect email={} sessions={}", email, Math.max(newCount, 0));
        if (newCount <= 0) broadcast(email, false);
    }

    /**
     * 접속 상태 브로드캐스트.
     *
     * 예전엔 전역 `/topic/presence` 하나로 쐈다. 그런데 WebSocketConfig 의 SUBSCRIBE 인가는
     * `/topic/dm/` 와 `/topic/workspace/` 만 검사하므로 이 토픽은 **무검사로 통과**했다.
     * 로그인만 하면(둘러보기 게스트 토큰 포함) 누구나 구독해서 **전 서비스 사용자의 이메일이
     * 접속할 때마다 흘러들어왔다.** REST 쪽(PresenceController)은 워크스페이스 멤버로 제대로
     * 제한하고 있어서 WS 만 뚫려 있던 셈이다.
     *
     * 내가 속한 워크스페이스 토픽으로만 보낸다 — 그 토픽은 이미 멤버십을 검사한다.
     * 같은 워크스페이스 사람의 접속 상태만 알면 되는 기능이라 기능 손실도 없다.
     */
    private void broadcast(String email, boolean online) {
        try {
            Map<String, Object> payload = Map.of(
                    "email", email,
                    "online", online,
                    "lastSeen", lastSeen.get(email) == null ? "" : lastSeen.get(email).toString()
            );
            userRepository.findActiveByEmail(email)
                    .map(workspaceMemberRepository::findByUser)
                    .orElseGet(java.util.List::of)
                    .forEach(m -> {
                        if (m.getWorkspace() != null) {
                            messagingTemplate.convertAndSend(
                                    "/topic/workspace/" + m.getWorkspace().getId() + "/presence", payload);
                        }
                    });
        } catch (Exception e) {
            log.warn("[presence] broadcast 실패 email={} err={}", email, e.getMessage());
        }
    }

    /** ONLINE: 활성 STOMP 세션이 1개 이상. OFFLINE: 0 또는 미접속. */
    public boolean isOnline(String email) {
        if (email == null) return false;
        java.util.concurrent.atomic.AtomicInteger counter = sessionCount.get(email);
        return counter != null && counter.get() > 0;
    }

    public Instant getLastSeen(String email) {
        return email == null ? null : lastSeen.get(email);
    }

    /** 일괄 조회 — Dashboard TeamStatusList 가 워크스페이스 멤버 한 번에 가져갈 때 사용. */
    public Map<String, PresenceInfo> snapshot(Set<String> emails) {
        return emails.stream()
                .filter(e -> e != null)
                .collect(java.util.stream.Collectors.toMap(
                        e -> e,
                        e -> new PresenceInfo(isOnline(e), lastSeen.get(e))
                ));
    }

    private String extractEmail(Principal principal) {
        return principal != null ? principal.getName() : null;
    }

    public record PresenceInfo(boolean online, Instant lastSeen) {}
}
