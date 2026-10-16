package com.example.todo.service;

import com.example.todo.dto.NotificationResponseDto;
import com.example.todo.entity.Notification;
import com.example.todo.entity.NotificationType;
import com.example.todo.entity.User;
import com.example.todo.entity.UserSettings;
import com.example.todo.repository.NotificationRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.UserSettingsRepository;
import com.example.todo.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WebPushService webPushService;
    private final ApnsService apnsService;

    private static final List<String> RECRUITMENT_TYPES = List.of(
            NotificationType.RECRUITMENT_ACCEPTED.name(),
            NotificationType.RECRUITMENT_REJECTED.name(),
            NotificationType.RECRUITMENT_APPLIED.name(),
            NotificationType.RECRUITMENT_QUESTION_RECEIVED.name(),
            NotificationType.RECRUITMENT_QUESTION_ANSWERED.name()
    );

    /**
     * Dashboard PriorityStack용 — 특정 type만 필터링.
     * type별 카테고리 카드(새 작업 / 멘션 등)를 그릴 때 사용.
     * limit 미적용 시 전체 반환.
     */
    public List<NotificationResponseDto> getNotificationsByTypes(
            String userEmail, Long workspaceId, List<String> types, Integer limit) {
        if (types == null || types.isEmpty()) return List.of();
        List<Notification> list = notificationRepository
                .findByReceiverEmailAndWorkspaceIdAndTypeInOrderByCreatedAtDesc(userEmail, workspaceId, types);
        if (limit != null && limit > 0 && list.size() > limit) {
            list = list.subList(0, limit);
        }
        return list.stream().map(this::toDto).toList();
    }

    public List<NotificationResponseDto> getMyNotifications(String userEmail, Long workspaceId) {
        List<Notification> workspace = notificationRepository
                .findByReceiverEmailAndWorkspaceIdOrderByCreatedAtDesc(userEmail, workspaceId);
        List<Notification> recruitment = notificationRepository
                .findByReceiverEmailAndTypeInOrderByCreatedAtDesc(userEmail, RECRUITMENT_TYPES);

        List<Notification> merged = new ArrayList<>(workspace);
        Set<Long> seen = new HashSet<>();
        workspace.forEach(n -> seen.add(n.getId()));
        recruitment.stream().filter(n -> seen.add(n.getId())).forEach(merged::add);
        merged.sort(Comparator.comparing(Notification::getCreatedAt).reversed());

        return merged.stream().map(this::toDto).toList();
    }

    public long getUnreadCount(String userEmail, Long workspaceId) {
        long wsCount = notificationRepository.countByReceiverEmailAndWorkspaceIdAndIsReadFalse(userEmail, workspaceId);
        long recruitCount = notificationRepository
                .findByReceiverEmailAndTypeInAndIsReadFalse(userEmail, RECRUITMENT_TYPES)
                .stream()
                .filter(n -> n.getWorkspaceId() == null || !n.getWorkspaceId().equals(workspaceId))
                .count();
        return wsCount + recruitCount;
    }

    @Transactional
    public void markAsRead(Long id, String userEmail) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new com.example.todo.exception.ApiException(404, "알림을 찾을 수 없습니다."));

        if (!notification.getReceiverEmail().equals(userEmail)) {
            throw new com.example.todo.exception.ApiException(403, "권한이 없습니다.");
        }

        notification.setIsRead(true);
    }

    @Transactional
    public void markAllAsRead(String userEmail, Long workspaceId) {
        notificationRepository
                .findByReceiverEmailAndWorkspaceIdAndIsReadFalseOrderByCreatedAtDesc(userEmail, workspaceId)
                .forEach(n -> n.setIsRead(true));
        notificationRepository
                .findByReceiverEmailAndTypeInAndIsReadFalse(userEmail, RECRUITMENT_TYPES)
                .forEach(n -> n.setIsRead(true));
    }

    public long getRecruitmentUnreadCount(String userEmail) {
        return notificationRepository.findByReceiverEmailAndTypeInAndIsReadFalse(userEmail, RECRUITMENT_TYPES).size();
    }

    public List<NotificationResponseDto> getRecruitmentNotifications(String userEmail) {
        return notificationRepository
                .findByReceiverEmailAndTypeInOrderByCreatedAtDesc(userEmail, RECRUITMENT_TYPES)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void markAllRecruitmentAsRead(String userEmail) {
        notificationRepository
                .findByReceiverEmailAndTypeInAndIsReadFalse(userEmail, RECRUITMENT_TYPES)
                .forEach(n -> n.setIsRead(true));
    }

    /**
     * 알림 생성 전 수신자의 알림 설정을 확인한다.
     * - notificationEnabled = false  → 모든 알림 차단
     * - notifyAssignment = false     → TASK_ASSIGNED 차단
     * - notifyDueDate = false        → TASK_DUE 차단
     * - notifyComment = false        → COMMENT 차단
     */
    @Async
    public void createNotification(String receiverEmail,
                                   String senderEmail,
                                   String type,
                                   String title,
                                   String message,
                                   Long targetId,
                                   Long workspaceId) {

        if (!isNotificationAllowed(receiverEmail, type)) {
            return;
        }

        saveNotification(receiverEmail, senderEmail, type, title, message, targetId, workspaceId);

        // Push 발송은 트랜잭션 밖에서 실행
        try {
            String workspaceName = workspaceId != null
                    ? workspaceRepository.findById(workspaceId).map(w -> w.getName()).orElse(null)
                    : null;
            webPushService.sendPushToUser(receiverEmail, title, message, targetId, workspaceId, workspaceName, type);
        } catch (Exception e) {
            log.warn("Web push 발송 실패 (receiver={}): {}", receiverEmail, e.getMessage());
        }

        try {
            java.util.Map<String, String> data = new java.util.HashMap<>();
            data.put("type", type == null ? "" : type);
            if (targetId != null)    data.put("targetId", String.valueOf(targetId));
            if (workspaceId != null) data.put("workspaceId", String.valueOf(workspaceId));
            apnsService.sendToUser(receiverEmail, title, message, data);
        } catch (Exception e) {
            log.warn("APNs 발송 실패 (receiver={}): {}", receiverEmail, e.getMessage());
        }
    }

    @Transactional
    protected void saveNotification(String receiverEmail, String senderEmail, String type,
                                    String title, String message, Long targetId, Long workspaceId) {
        Notification notification = Notification.builder()
                .receiverEmail(receiverEmail)
                .senderEmail(senderEmail)
                .type(type)
                .title(title)
                .message(message)
                .targetId(targetId)
                .workspaceId(workspaceId)
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();
        notificationRepository.save(notification);
    }

    /**
     * 수신자의 알림 설정을 확인해 해당 타입의 알림을 보낼 수 있는지 반환.
     */
    private boolean isNotificationAllowed(String receiverEmail, String type) {
        // findActiveByEmail: 탈퇴자에게는 어떤 알림도 만들지 않는다.
        // 여기가 알림·푸시의 단일 관문이라, 이 한 줄로 주간 회고 크론·그룹 DM 팬아웃·
        // 멘션·팀모집 알림이 한꺼번에 막힌다. (dm_room_members 는 의도적으로 남기므로
        // 그냥 두면 탈퇴자 앞으로 알림 행이 계속 쌓인다.)
        User receiver = userRepository.findActiveByEmail(receiverEmail).orElse(null);
        if (receiver == null) return false;

        UserSettings settings = userSettingsRepository.findByUserId(receiver.getId()).orElse(null);
        if (settings == null) return true; // 설정 없으면 기본 허용

        // 전체 알림 OFF
        if (Boolean.FALSE.equals(settings.getNotificationEnabled())) return false;

        // 타입별 설정 확인
        if (NotificationType.TASK_ASSIGNED.name().equals(type)) return !Boolean.FALSE.equals(settings.getNotifyAssignment());
        if (NotificationType.TASK_DUE.name().equals(type))      return !Boolean.FALSE.equals(settings.getNotifyDueDate());
        if (NotificationType.COMMENT.name().equals(type))       return !Boolean.FALSE.equals(settings.getNotifyComment());
        if (NotificationType.MENTION.name().equals(type))       return !Boolean.FALSE.equals(settings.getNotifyMention());
        // DM_MENTION은 MENTION에서 분리된 타입 — 기존 동작 유지를 위해 같은 설정(멘션 알림)을 따른다
        if (NotificationType.DM_MENTION.name().equals(type))    return !Boolean.FALSE.equals(settings.getNotifyMention());
        if (NotificationType.DM_RECEIVED.name().equals(type))   return !Boolean.FALSE.equals(settings.getNotifyDm());
        return true;
    }

    private NotificationResponseDto toDto(Notification notification) {
        String senderName = null;
        if (notification.getSenderEmail() != null) {
            senderName = userRepository.findByEmail(notification.getSenderEmail())
                    .map(User::getName)
                    .orElse(null);
        }
        return NotificationResponseDto.builder()
                .id(notification.getId())
                .type(notification.getType())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .senderName(senderName)
                .targetId(notification.getTargetId())
                .read(notification.getIsRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
