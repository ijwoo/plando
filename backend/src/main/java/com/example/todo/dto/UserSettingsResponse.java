package com.example.todo.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserSettingsResponse {
    private String themeMode;
    private String displayName;
    private String calendarDefaultView;
    private Boolean compactMode;
    private Boolean notificationEnabled;

    private Boolean onboardingCompleted;
    private Boolean dashboardTutorialSeen;
    private Boolean todoTutorialSeen;
    private Boolean tasklistTutorialSeen;
    private Boolean calendarTutorialSeen;

    //todo: 설정 배포용으로 작업 중
    private String defaultPriority;
    private String defaultView;
    private Boolean sidebarCollapsed;

    private Boolean notifyDueDate;
    private Boolean notifyAssignment;
    private Boolean notifyComment;
    private Boolean notifyMention;
    private Boolean notifyDm;

    private Integer dueReminderLeadDays;
    private String defaultDue;
    private String weekStartDay;
    private Integer autoArchiveDays;
    // DM AI 할 일 제안 수신/분석 허용
    private Boolean dmSuggestionEnabled;

    // 대시보드 카드 레이아웃 JSON
    private String dashboardLayout;
    // 대시보드 북마크(JSON 배열) / 메모 스티커(JSON 객체)
    private String dashboardBookmarks;
    private String dashboardStickies;

    private String profileImageUrl;
}