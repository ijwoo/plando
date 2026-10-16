package com.example.todo.service;

import com.example.todo.dto.UserSettingsResponse;
import com.example.todo.dto.UserSettingsUpdateRequest;
import com.example.todo.entity.User;
import com.example.todo.entity.UserSettings;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserSettingsService {

    private final UserSettingsRepository userSettingsRepository;
    private final UserRepository userRepository;

    @Transactional
    public UserSettingsResponse getMySettings(Long userId) {
        UserSettings settings = userSettingsRepository.findByUserId(userId).orElse(null);
        if (settings == null) {
            return defaultResponse();
        }

        // null인 알림 필드를 기본값(true)으로 초기화해 DB에 저장
        boolean changed = false;
        if (settings.getNotificationEnabled() == null) { settings.setNotificationEnabled(true); changed = true; }
        if (settings.getNotifyDueDate() == null)        { settings.setNotifyDueDate(true);        changed = true; }
        if (settings.getNotifyAssignment() == null)     { settings.setNotifyAssignment(true);     changed = true; }
        if (settings.getNotifyComment() == null)        { settings.setNotifyComment(true);        changed = true; }
        if (settings.getNotifyMention() == null)        { settings.setNotifyMention(true);        changed = true; }
        if (settings.getNotifyDm() == null)             { settings.setNotifyDm(true);             changed = true; }
        if (settings.getDmSuggestionEnabled() == null)  { settings.setDmSuggestionEnabled(true);  changed = true; }
        if (changed) userSettingsRepository.save(settings);

        String profileImageUrl = userRepository.findById(userId)
                .map(User::getProfileImageUrl).orElse(null);
        return toResponse(settings, profileImageUrl);
    }

    @Transactional
    public UserSettingsResponse updateMySettings(Long userId, UserSettingsUpdateRequest request) {
        UserSettings settings = userSettingsRepository.findByUserId(userId)
                .orElseGet(() -> createEmptyDefaultSettings(userId));

        if (request.getThemeMode() != null) {
            settings.setThemeMode(request.getThemeMode());
        }
        if (request.getDisplayName() != null) {
            settings.setDisplayName(request.getDisplayName());
            userRepository.findById(userId).ifPresent(user -> {
                user.setName(request.getDisplayName());
                userRepository.save(user);
            });
        }
        if (request.getCalendarDefaultView() != null) {
            settings.setCalendarDefaultView(request.getCalendarDefaultView());
        }
        if (request.getCompactMode() != null) {
            settings.setCompactMode(request.getCompactMode());
        }
        if (request.getNotificationEnabled() != null) {
            settings.setNotificationEnabled(request.getNotificationEnabled());
        }

        if (request.getOnboardingCompleted() != null) {
            settings.setOnboardingCompleted(request.getOnboardingCompleted());
        }
        if (request.getDashboardTutorialSeen() != null) {
            settings.setDashboardTutorialSeen(request.getDashboardTutorialSeen());
        }
        if (request.getTodoTutorialSeen() != null) {
            settings.setTodoTutorialSeen(request.getTodoTutorialSeen());
        }
        if (request.getTasklistTutorialSeen() != null) {
            settings.setTasklistTutorialSeen(request.getTasklistTutorialSeen());
        }
        if (request.getCalendarTutorialSeen() != null) {
            settings.setCalendarTutorialSeen(request.getCalendarTutorialSeen());
        }

        //todo: 설정 배포용으로 작업 중
        if (request.getDefaultPriority() != null) {
            settings.setDefaultPriority(request.getDefaultPriority());
        }
        if (request.getDefaultView() != null) {
            settings.setDefaultView(request.getDefaultView());
        }
        if (request.getSidebarCollapsed() != null) {
            settings.setSidebarCollapsed(request.getSidebarCollapsed());
        }

        if (request.getNotifyDueDate() != null) {
            settings.setNotifyDueDate(request.getNotifyDueDate());
        }
        if (request.getNotifyAssignment() != null) {
            settings.setNotifyAssignment(request.getNotifyAssignment());
        }
        if (request.getNotifyComment() != null) {
            settings.setNotifyComment(request.getNotifyComment());
        }
        if (request.getNotifyMention() != null) {
            settings.setNotifyMention(request.getNotifyMention());
        }
        if (request.getNotifyDm() != null) {
            settings.setNotifyDm(request.getNotifyDm());
        }
        if (request.getDmSuggestionEnabled() != null) {
            settings.setDmSuggestionEnabled(request.getDmSuggestionEnabled());
        }
        if (request.getDueReminderLeadDays() != null) {
            settings.setDueReminderLeadDays(request.getDueReminderLeadDays());
        }
        if (request.getDefaultDue() != null) {
            settings.setDefaultDue(request.getDefaultDue());
        }
        if (request.getWeekStartDay() != null) {
            settings.setWeekStartDay(request.getWeekStartDay());
        }
        if (request.getAutoArchiveDays() != null) {
            settings.setAutoArchiveDays(request.getAutoArchiveDays());
        }
        if (request.getDashboardLayout() != null) {
            settings.setDashboardLayout(request.getDashboardLayout());
        }
        if (request.getDashboardBookmarks() != null) {
            settings.setDashboardBookmarks(request.getDashboardBookmarks());
        }
        if (request.getDashboardStickies() != null) {
            settings.setDashboardStickies(request.getDashboardStickies());
        }

        String profileImageUrl = userRepository.findById(userId)
                .map(User::getProfileImageUrl).orElse(null);
        return toResponse(userSettingsRepository.save(settings), profileImageUrl);
    }

    @Transactional
    public UserSettings createDefaultSettings(User user) {
        UserSettings settings = new UserSettings();
        settings.setUserId(user.getId());
        String fallbackName = user.getName() != null && !user.getName().isBlank() ? user.getName()
                : (user.getEmail() != null && user.getEmail().contains("@") ? user.getEmail().split("@")[0] : "사용자");
        settings.setDisplayName(fallbackName);
        settings.setThemeMode("light");
        settings.setCalendarDefaultView("month");
        settings.setCompactMode(false);
        settings.setNotificationEnabled(true);
        settings.setOnboardingCompleted(false);
        settings.setDashboardTutorialSeen(false);
        settings.setTodoTutorialSeen(false);
        settings.setTasklistTutorialSeen(false);
        settings.setCalendarTutorialSeen(false);

        //todo: 설정 배포용으로 작업 중
        settings.setDefaultPriority("MEDIUM");
        settings.setDefaultView("dashboard");
        settings.setSidebarCollapsed(false);

        settings.setNotificationEnabled(true);
        settings.setNotifyDueDate(true);
        settings.setNotifyAssignment(true);
        settings.setNotifyComment(true);
        settings.setNotifyMention(true);
        settings.setNotifyDm(true);
        settings.setDueReminderLeadDays(1);
        settings.setDefaultDue("none");
        settings.setWeekStartDay("sun");
        settings.setAutoArchiveDays(30);

        return userSettingsRepository.save(settings);
    }

    private UserSettings createEmptyDefaultSettings(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        UserSettings settings = new UserSettings();
        settings.setUserId(userId);
        String fallbackName = user.getName() != null && !user.getName().isBlank() ? user.getName()
                : (user.getEmail() != null && user.getEmail().contains("@") ? user.getEmail().split("@")[0] : "사용자");
        settings.setDisplayName(fallbackName);
        settings.setThemeMode("light");
        settings.setCalendarDefaultView("month");
        settings.setCompactMode(false);
        settings.setNotificationEnabled(true);
        settings.setOnboardingCompleted(false);
        settings.setDashboardTutorialSeen(false);
        settings.setTodoTutorialSeen(false);
        settings.setTasklistTutorialSeen(false);
        settings.setCalendarTutorialSeen(false);

        //todo: 설정 배포용으로 작업 중
        settings.setDefaultPriority("MEDIUM");
        settings.setDefaultView("dashboard");
        settings.setSidebarCollapsed(false);

        settings.setNotificationEnabled(true);
        settings.setNotifyDueDate(true);
        settings.setNotifyAssignment(true);
        settings.setNotifyComment(true);
        settings.setDueReminderLeadDays(1);
        settings.setDefaultDue("none");
        settings.setWeekStartDay("sun");
        settings.setAutoArchiveDays(30);
        return userSettingsRepository.save(settings);
    }

    private UserSettingsResponse defaultResponse() {
        return UserSettingsResponse.builder()
                .themeMode("light")
                .displayName("")
                .calendarDefaultView("month")
                .compactMode(false)
                .notificationEnabled(true)
                .notifyDueDate(true)
                .notifyAssignment(true)
                .notifyComment(true)
                .notifyMention(true)
                .notifyDm(true)
                .dueReminderLeadDays(1)
                .defaultDue("none")
                .weekStartDay("sun")
                .autoArchiveDays(30)
                .onboardingCompleted(false)
                .dashboardTutorialSeen(false)
                .todoTutorialSeen(false)
                .tasklistTutorialSeen(false)
                .calendarTutorialSeen(false)
                .build();
    }

    private UserSettingsResponse toResponse(UserSettings settings, String profileImageUrl) {
        return UserSettingsResponse.builder()
                .themeMode(settings.getThemeMode())
                .displayName(settings.getDisplayName())
                .calendarDefaultView(settings.getCalendarDefaultView())
                .compactMode(settings.getCompactMode())
                .dueReminderLeadDays(settings.getDueReminderLeadDays())
                .defaultDue(settings.getDefaultDue())
                .weekStartDay(settings.getWeekStartDay())
                .autoArchiveDays(settings.getAutoArchiveDays())

                // todo: 설정 배포용으로 작업 중
                .defaultPriority(settings.getDefaultPriority())
                .defaultView(settings.getDefaultView())
                .sidebarCollapsed(settings.getSidebarCollapsed())
                .notificationEnabled(settings.getNotificationEnabled())
                .notifyDueDate(settings.getNotifyDueDate())
                .notifyAssignment(settings.getNotifyAssignment())
                .notifyComment(settings.getNotifyComment())
                .notifyMention(settings.getNotifyMention())
                .notifyDm(settings.getNotifyDm())
                .dmSuggestionEnabled(settings.getDmSuggestionEnabled())

                // 온보딩 / 튜토리얼 상태값
                .onboardingCompleted(settings.getOnboardingCompleted())
                .dashboardTutorialSeen(settings.getDashboardTutorialSeen())
                .todoTutorialSeen(settings.getTodoTutorialSeen())
                .tasklistTutorialSeen(settings.getTasklistTutorialSeen())
                .calendarTutorialSeen(settings.getCalendarTutorialSeen())

                .dashboardLayout(settings.getDashboardLayout())
                .dashboardBookmarks(settings.getDashboardBookmarks())
                .dashboardStickies(settings.getDashboardStickies())

                .profileImageUrl(profileImageUrl)
                .build();
    }
}