package com.example.todo.service;

import com.example.todo.entity.PushSubscription;
import com.example.todo.entity.NotificationType;
import com.example.todo.repository.PushSubscriptionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Security;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebPushService {

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final ObjectMapper objectMapper;
    /** 만료 구독 정리는 트랜잭션이 필요해 바깥 빈으로 뺐다 — 이유는 PushCleanupService 주석 참고. */
    private final PushCleanupService pushCleanupService;

    @Value("${webpush.vapid.public-key}")
    private String vapidPublicKey;

    @Value("${webpush.vapid.private-key}")
    private String vapidPrivateKey;

    @Value("${webpush.vapid.subject}")
    private String vapidSubject;

    private PushService pushService;

    @PostConstruct
    public void init() {
        try {
            Security.addProvider(new BouncyCastleProvider());
            pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);
            log.info("WebPushService initialized successfully");
        } catch (Exception e) {
            log.error("WebPushService init failed - push notifications will be disabled: {}", e.getMessage());
        }
    }

    public boolean isAvailable() {
        return pushService != null;
    }

    public String getVapidPublicKey() {
        return vapidPublicKey;
    }

    @Transactional
    public void subscribe(String userEmail, String endpoint, String p256dh, String auth) {
        pushSubscriptionRepository.findByEndpoint(endpoint).ifPresentOrElse(
            existing -> {
                existing.setUserEmail(userEmail);
                existing.setP256dhKey(p256dh);
                existing.setAuthKey(auth);
            },
            () -> pushSubscriptionRepository.save(
                com.example.todo.entity.PushSubscription.builder()
                    .userEmail(userEmail)
                    .endpoint(endpoint)
                    .p256dhKey(p256dh)
                    .authKey(auth)
                    .createdAt(java.time.LocalDateTime.now())
                    .build()
            )
        );
    }

    /**
     * 구독 해지 — **본인 구독만** 지운다.
     * 예전엔 endpoint 만 받아 그대로 삭제해서, 로그인한 사람이 남의 endpoint 를 알면
     * 그 사람의 웹 푸시를 대신 꺼버릴 수 있었다.
     */
    @Transactional
    public void unsubscribe(String userEmail, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) return;
        pushSubscriptionRepository.findByEndpoint(endpoint)
                .filter(sub -> userEmail != null && userEmail.equalsIgnoreCase(sub.getUserEmail()))
                .ifPresent(pushSubscriptionRepository::delete);
    }

    public void sendPushToUser(String userEmail, String title, String body, Long targetId, Long workspaceId, String workspaceName, String type) {
        if (pushService == null) return;
        List<PushSubscription> subscriptions = pushSubscriptionRepository.findByUserEmail(userEmail);

        String url;
        if (NotificationType.DM_RECEIVED.name().equals(type) && targetId != null) {
            url = "/#/dm?openRoom=" + targetId;
            if (workspaceId != null) url += "&workspaceId=" + workspaceId;
        } else {
            url = "/#/todos";
            if (targetId != null && workspaceId != null) {
                url += "?openTask=" + targetId + "&workspaceId=" + workspaceId;
            } else if (targetId != null) {
                url += "?openTask=" + targetId;
            }
        }

        String fullTitle = (workspaceName != null && !workspaceName.isBlank())
                ? "[" + workspaceName + "] " + title
                : title;

        String payload = buildPayload(fullTitle, body, url, workspaceId);

        for (PushSubscription sub : subscriptions) {
            try {
                Subscription subscription = new Subscription(
                    sub.getEndpoint(),
                    new Subscription.Keys(sub.getP256dhKey(), sub.getAuthKey())
                );
                Notification notification = new Notification(subscription, payload);

                /* web-push 라이브러리는 410 Gone 을 **예외가 아니라 응답으로** 돌려준다.
                   예전엔 반환값을 버리고 catch 안에서 메시지에 "410" 이 있는지만 봤는데,
                   그 catch 는 애초에 실행되지 않는다 → 만료 구독이 영원히 안 지워지고
                   매번 헛발송만 반복됐다. 이제 상태 코드를 직접 본다. */
                org.apache.http.HttpResponse response = pushService.send(notification);
                int status = response.getStatusLine() != null ? response.getStatusLine().getStatusCode() : -1;

                if (status == 410 || status == 404) {
                    // 410 Gone = 구독 만료/해지, 404 = endpoint 없음. 둘 다 다시 살아나지 않는다.
                    pushCleanupService.removeWebPushSubscription(sub.getEndpoint());
                } else if (status < 200 || status >= 300) {
                    log.warn("Web push 거부 status={} endpoint={}", status, abbreviate(sub.getEndpoint()));
                }
            } catch (Exception e) {
                log.warn("Failed to send push to endpoint {}: {}", abbreviate(sub.getEndpoint()), e.getMessage());
            }
        }
    }

    /** endpoint 전체는 그 자체로 푸시 발송 자격증명이라 로그에 남기지 않는다. */
    private static String abbreviate(String endpoint) {
        if (endpoint == null) return "";
        return endpoint.length() <= 40 ? endpoint : endpoint.substring(0, 40) + "…";
    }

    private String buildPayload(String title, String body, String url, Long workspaceId) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("title", title);
            payload.put("body", body);
            payload.put("url", url);
            if (workspaceId != null) payload.put("workspaceId", workspaceId);
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.warn("Push payload 직렬화 실패: {}", e.getMessage());
            return "{}";
        }
    }
}
