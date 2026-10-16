package com.example.todo.service;

import com.example.todo.repository.ApnsTokenRepository;
import com.example.todo.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 만료된 푸시 구독/디바이스 토큰 정리 — **별도 빈으로 분리한 이유가 핵심이다.**
 *
 * 삭제는 파생 delete 메서드(deleteByEndpoint/deleteByDeviceToken)라 트랜잭션이 반드시 있어야 한다.
 * 그런데 정리를 호출하는 지점(WebPushService.sendPushToUser, ApnsService.sendOne)은 트랜잭션이 없고,
 * 그 유일한 호출자인 NotificationService.createNotification 은 @Async 이며 @Transactional 도 아니다.
 * 그래서 예전 코드는 삭제에 도달해도 TransactionRequiredException 으로 튕겼고, 그 예외마저 넓은
 * catch 에 먹혀 **정리가 한 번도 성공한 적이 없었다.** (운영 DB에 한 사용자당 구독 20건·APNs 토큰
 * 12건이 5월부터 쌓여 있었다.)
 *
 * 같은 빈 안에 @Transactional 메서드를 두면 self-invocation 이라 프록시를 안 타서 똑같이 무의미하다.
 * 따라서 **바깥 빈**으로 빼서 호출한다. REQUIRES_NEW 로 잡아 발송 루프의 상태와 무관하게 커밋되게 한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushCleanupService {

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final ApnsTokenRepository apnsTokenRepository;

    /** 웹 푸시 구독 제거 (410 Gone / 404 Not Found 응답을 받은 endpoint). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void removeWebPushSubscription(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) return;
        try {
            pushSubscriptionRepository.deleteByEndpoint(endpoint);
            log.info("[WebPush] 만료 구독 정리 endpoint={}", abbreviate(endpoint));
        } catch (Exception e) {
            // 정리 실패가 알림 발송 자체를 막으면 안 된다. 다음 발송에서 다시 시도된다.
            log.warn("[WebPush] 만료 구독 정리 실패: {}", e.getMessage());
        }
    }

    /** APNs 디바이스 토큰 제거 (BadDeviceToken / Unregistered 응답을 받은 토큰). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void removeApnsToken(String deviceToken) {
        if (deviceToken == null || deviceToken.isBlank()) return;
        try {
            apnsTokenRepository.deleteByDeviceToken(deviceToken);
            log.info("[APNs] 만료 토큰 정리 tokenPrefix={}", abbreviate(deviceToken));
        } catch (Exception e) {
            log.warn("[APNs] 만료 토큰 정리 실패: {}", e.getMessage());
        }
    }

    /** 로그에 endpoint/토큰 전체를 남기지 않는다(그 자체가 푸시를 보낼 수 있는 자격증명). */
    private static String abbreviate(String value) {
        return value.length() <= 12 ? value : value.substring(0, 12) + "…";
    }
}
