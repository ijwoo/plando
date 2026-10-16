package com.example.todo.service;

import com.example.todo.entity.Todo;
import com.example.todo.entity.NotificationType;
import com.example.todo.entity.User;
import com.example.todo.entity.UserSettings;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DueDateNotificationScheduler {

    private final TodoRepository todoRepository;
    private final NotificationService notificationService;
    private final UserSettingsRepository userSettingsRepository;

    // 사용자가 고를 수 있는 리드타임(당일/1일 전/3일 전). 기본값 1.
    private static final int[] LEAD_OPTIONS = {0, 1, 3};
    private static final int DEFAULT_LEAD = 1;

    /**
     * 매일 오전 9시 실행. 마감일 D-leadDays 인 작업을, 담당자별 리드타임 설정에 맞춰 알림.
     * (예: 리드타임 3일 전 사용자는 마감 3일 전에만, 당일 사용자는 마감 당일에만 받음)
     * notifyDueDate=false 인 사용자는 제외.
     */
    @Scheduled(cron = "0 0 9 * * *")
    @Transactional(readOnly = true)
    public void sendDueDateNotifications() {
        LocalDate today = LocalDate.now();
        log.info("[DueDateScheduler] 마감일 알림 실행 - today={}", today);
        for (int lead : LEAD_OPTIONS) {
            sendForLead(today, lead);
        }
    }

    private void sendForLead(LocalDate today, int leadDays) {
        LocalDate targetDate = today.plusDays(leadDays);
        List<Todo> todos = todoRepository.findByDueDateAndNotDone(targetDate);

        String whenLabel = leadDays == 0 ? "오늘" : leadDays == 1 ? "내일" : leadDays + "일 후";
        int sent = 0;
        for (Todo todo : todos) {
            try {
                if (todo.getAssignees() == null || todo.getAssignees().isEmpty()) continue;

                String todoTitle = todo.getTitle() != null ? todo.getTitle() : "작업";
                Long workspaceId = todo.getWorkspace() != null ? todo.getWorkspace().getId() : null;
                String title = whenLabel + " 마감 예정인 작업이 있어요";
                String message = "[" + todoTitle + "] 작업이 " + whenLabel + "(" + targetDate + ") 마감이에요.";

                Set<String> notified = new HashSet<>();
                for (User assignee : todo.getAssignees()) {
                    if (assignee == null || assignee.getEmail() == null) continue;
                    if (!notified.add(assignee.getEmail())) continue; // 중복 담당자 방지

                    UserSettings s = userSettingsRepository.findByUserId(assignee.getId()).orElse(null);
                    int userLead = (s != null && s.getDueReminderLeadDays() != null) ? s.getDueReminderLeadDays() : DEFAULT_LEAD;
                    boolean notify = (s == null || s.getNotifyDueDate() == null) ? true : s.getNotifyDueDate();

                    // 이 사용자의 리드타임과 일치하는 날짜에만 발송
                    if (!notify || userLead != leadDays) continue;

                    notificationService.createNotification(
                            assignee.getEmail(), null, NotificationType.TASK_DUE.name(),
                            title, message, todo.getId(), workspaceId
                    );
                    sent++;
                }
            } catch (Exception e) {
                log.warn("[DueDateScheduler] todoId={} 알림 발송 실패: {}", todo.getId(), e.getMessage());
            }
        }

        log.info("[DueDateScheduler] leadDays={} targetDate={} 처리 완료 - {}건 발송 / 후보 {}건", leadDays, targetDate, sent, todos.size());
    }
}
