package com.example.todo.service;

import com.eatthepath.pushy.apns.ApnsClient;
import com.eatthepath.pushy.apns.ApnsClientBuilder;
import com.eatthepath.pushy.apns.PushNotificationResponse;
import com.eatthepath.pushy.apns.auth.ApnsSigningKey;
import com.eatthepath.pushy.apns.util.SimpleApnsPayloadBuilder;
import com.eatthepath.pushy.apns.util.SimpleApnsPushNotification;
import com.eatthepath.pushy.apns.util.TokenUtil;
import com.example.todo.entity.ApnsToken;
import com.example.todo.repository.ApnsTokenRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApnsService {

    private final ApnsTokenRepository apnsTokenRepository;
    /** 만료 토큰 정리는 트랜잭션이 필요해 바깥 빈으로 뺐다 — 이유는 PushCleanupService 주석 참고. */
    private final PushCleanupService pushCleanupService;

    @Value("${apns.bundle-id:}")
    private String bundleId;

    @Value("${apns.key-id:}")
    private String keyId;

    @Value("${apns.team-id:}")
    private String teamId;

    /** .p8 파일 경로 (운영). 비어 있으면 key-content를 사용. */
    @Value("${apns.key-path:}")
    private String keyPath;

    /** .p8 내용을 base64로 인코딩한 값 (배포 환경에서 파일 대신 사용 가능). */
    @Value("${apns.key-content:}")
    private String keyContentBase64;

    /** production = TestFlight/AppStore 빌드. development = Xcode Run으로 직접 깐 빌드. */
    @Value("${apns.production:true}")
    private boolean production;

    private ApnsClient apnsClient;

    @PostConstruct
    public void init() {
        if (bundleId.isBlank() || keyId.isBlank() || teamId.isBlank() ||
                (keyPath.isBlank() && keyContentBase64.isBlank())) {
            log.warn("ApnsService: 환경변수 누락으로 비활성화 (bundleId/keyId/teamId/key-path or key-content)");
            return;
        }
        try {
            ApnsSigningKey signingKey;
            if (!keyContentBase64.isBlank()) {
                byte[] keyBytes = Base64.getDecoder().decode(keyContentBase64);
                try (InputStream is = new ByteArrayInputStream(keyBytes)) {
                    signingKey = ApnsSigningKey.loadFromInputStream(is, teamId, keyId);
                }
            } else {
                signingKey = ApnsSigningKey.loadFromPkcs8File(new File(keyPath), teamId, keyId);
            }

            String host = production
                    ? ApnsClientBuilder.PRODUCTION_APNS_HOST
                    : ApnsClientBuilder.DEVELOPMENT_APNS_HOST;

            apnsClient = new ApnsClientBuilder()
                    .setApnsServer(host)
                    .setSigningKey(signingKey)
                    .build();
            log.info("ApnsService initialized (host={}, bundleId={})", host, bundleId);
        } catch (Exception e) {
            log.error("ApnsService init failed - iOS push will be disabled: {}", e.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        if (apnsClient != null) {
            apnsClient.close();
        }
    }

    public boolean isAvailable() {
        return apnsClient != null;
    }

    /**
     * 디바이스 토큰 등록.
     *
     * 예전엔 이미 등록된 토큰이면 **무조건 호출자 이메일로 재바인딩**했다. 그래서 로그인한 사람이
     * 남의 디바이스 토큰을 알기만 하면 그 토큰을 자기 계정으로 가져올 수 있었고, 원래 주인은
     * 그 순간부터 푸시를 못 받았다(그리고 그 기기로는 가로챈 사람의 알림이 갔다).
     * 같은 기기를 다른 계정이 쓰는 정상 흐름은 앱이 로그아웃 때 unregister 를 호출해 행을 지우므로
     * 그대로 동작한다. 남아 있는 행이 있다면 이전 계정에서 로그아웃해 정리하도록 안내한다.
     */
    @Transactional
    public void register(String userEmail, String deviceToken) {
        apnsTokenRepository.findByDeviceToken(deviceToken).ifPresentOrElse(
                existing -> {
                    /* 다른 계정이 쓰던 기기 토큰이면 예전엔 409 로 막았다. 보안상으로는 맞지만,
                       APNs 토큰은 앱 재설치·기기 복원·중고 양도에서 **정상적으로** 주인이 바뀐다.
                       막아 두면 그 사용자는 푸시를 영영 못 받고 스스로 풀 방법도 없다.
                       한편 이 토큰은 어떤 API 응답에도 실리지 않아 남이 알아낼 경로가 없다.
                       그래서 재바인딩은 허용하되 흔적을 남긴다 — 실제로 악용되면 로그로 드러난다. */
                    if (existing.getUserEmail() != null && !existing.getUserEmail().equals(userEmail)) {
                        log.warn("[APNs] 기기 토큰 소유자 변경 {} -> {} tokenPrefix={}",
                                existing.getUserEmail(), userEmail,
                                deviceToken.substring(0, Math.min(8, deviceToken.length())));
                    }
                    existing.setUserEmail(userEmail);
                    existing.setBundleId(bundleId);
                    apnsTokenRepository.save(existing);
                    log.info("[APNs] token refreshed user={} tokenPrefix={}", userEmail,
                            deviceToken.substring(0, Math.min(8, deviceToken.length())));
                },
                () -> {
                    apnsTokenRepository.save(ApnsToken.builder()
                            .deviceToken(deviceToken)
                            .userEmail(userEmail)
                            .bundleId(bundleId.isBlank() ? "com.imjaewoo.plando" : bundleId)
                            .createdAt(LocalDateTime.now())
                            .build());
                    log.info("[APNs] token registered user={} tokenPrefix={}", userEmail,
                            deviceToken.substring(0, Math.min(8, deviceToken.length())));
                }
        );
    }

    /**
     * 토큰 해제 — **본인 토큰만** 지운다.
     * 예전엔 토큰 문자열만 받아 그대로 삭제해서, 남의 토큰을 알면 그 사람의 iOS 푸시를
     * 대신 꺼버릴 수 있었다.
     */
    @Transactional
    public void unregister(String userEmail, String deviceToken) {
        if (deviceToken == null || deviceToken.isBlank()) return;
        apnsTokenRepository.findByDeviceToken(deviceToken)
                .filter(t -> userEmail != null && userEmail.equalsIgnoreCase(t.getUserEmail()))
                .ifPresent(apnsTokenRepository::delete);
    }

    /** 사용자의 모든 iOS 디바이스로 푸시 발송. 실패한 토큰은 자동 삭제. */
    public void sendToUser(String userEmail, String title, String body, Map<String, String> data) {
        if (!isAvailable()) return;

        List<ApnsToken> tokens = apnsTokenRepository.findByUserEmail(userEmail);
        for (ApnsToken token : tokens) {
            sendOne(token.getDeviceToken(), title, body, data);
        }
    }

    private void sendOne(String deviceToken, String title, String body, Map<String, String> data) {
        try {
            SimpleApnsPayloadBuilder payloadBuilder = new SimpleApnsPayloadBuilder();
            payloadBuilder.setAlertTitle(title);
            payloadBuilder.setAlertBody(body);
            payloadBuilder.setSound("default");
            payloadBuilder.setBadgeNumber(1);

            if (data != null) {
                for (Map.Entry<String, String> e : data.entrySet()) {
                    payloadBuilder.addCustomProperty(e.getKey(), e.getValue());
                }
            }

            String payload = payloadBuilder.build();
            String normalizedToken = TokenUtil.sanitizeTokenString(deviceToken);
            SimpleApnsPushNotification notification = new SimpleApnsPushNotification(
                    normalizedToken, bundleId, payload);

            PushNotificationResponse<SimpleApnsPushNotification> response =
                    apnsClient.sendNotification(notification).get();

            if (!response.isAccepted()) {
                String reason = response.getRejectionReason().orElse("unknown");
                log.warn("APNs 거부: token={}..., reason={}", normalizedToken.substring(0, Math.min(8, normalizedToken.length())), reason);
                if ("BadDeviceToken".equals(reason) || "Unregistered".equals(reason)) {
                    // 파생 delete 라 트랜잭션이 필요한데 여기(발송 경로)엔 트랜잭션이 없다.
                    // 예전엔 그대로 호출해 TransactionRequiredException 이 났고 아래 catch 에 먹혀
                    // 죽은 토큰이 계속 쌓였다. 트랜잭션을 가진 바깥 빈으로 위임한다.
                    pushCleanupService.removeApnsToken(deviceToken);
                }
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException | RuntimeException e) {
            log.error("APNs 발송 실패: {}", e.getMessage());
        }
    }
}
