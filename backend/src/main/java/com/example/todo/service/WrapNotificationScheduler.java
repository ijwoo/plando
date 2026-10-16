package com.example.todo.service;

import com.example.todo.entity.NotificationType;
import com.example.todo.entity.User;
import com.example.todo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 주간 회고 도착 푸시 — 매주 일요일 21시.
 * 게스트 제외 모든 사용자에게 "회고가 도착했어요" 알림.
 * NotificationService 가 알림 설정/푸시/APNs 다 처리.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WrapNotificationScheduler {

    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /** 매주 일요일 21:00 KST. cron: 초 분 시 일 월 요일 (SUN=0) */
    @Scheduled(cron = "0 0 21 * * SUN", zone = "Asia/Seoul")
    public void sendWeeklyWrapPush() {
        List<User> users = userRepository.findActiveNonGuestUsers();
        log.info("[WrapNotification] 주간 회고 푸시 시작 — 대상 {}명", users.size());

        int sent = 0;
        for (User u : users) {
            String email = u.getEmail();
            if (email == null || email.isBlank()) continue;
            try {
                notificationService.createNotification(
                        email,
                        null,
                        NotificationType.WRAP_WEEKLY.name(),
                        "지난 주 회고가 도착했어요",
                        "한 주를 어떻게 보냈는지 살펴보세요.",
                        null,
                        null
                );
                sent++;
            } catch (Exception e) {
                log.warn("[WrapNotification] {} 발송 실패: {}", email, e.getMessage());
            }
        }
        log.info("[WrapNotification] 완료 — {}/{}", sent, users.size());
    }
}
