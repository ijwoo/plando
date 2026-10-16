package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_settings", schema = "todo")
@Getter
@Setter
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "theme_mode")
    private String themeMode = "light";

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "notification_enabled")
    private Boolean notificationEnabled = true;

    // todo: 설정 배포용으로 작업 중
    @Column(name = "default_priority")
    private String defaultPriority = "MEDIUM";

    @Column(name = "default_view")
    private String defaultView = "kanban";

    @Column(name = "sidebar_collapsed")
    private Boolean sidebarCollapsed = false;

    @Column(name = "notify_due_date")
    private Boolean notifyDueDate = true;

    @Column(name = "notify_assignment")
    private Boolean notifyAssignment = true;

    @Column(name = "notify_comment")
    private Boolean notifyComment = true;

    @Column(name = "notify_mention")
    private Boolean notifyMention = true;

    @Column(name = "notify_dm")
    private Boolean notifyDm = true;

    // 마감 알림 리드타임 — 마감 며칠 전에 알릴지 (0=당일, 1=1일 전, 3=3일 전)
    @Column(name = "due_reminder_lead_days")
    private Integer dueReminderLeadDays = 1;

    // 새 할 일 기본 마감일 (none / today / tomorrow / week)
    @Column(name = "default_due")
    private String defaultDue = "none";

    // 주 시작 요일 (sun / mon)
    @Column(name = "week_start_day")
    private String weekStartDay = "sun";

    // 완료 항목 자동 보관 — 내가 만든 완료 할 일을 N일 후 자동 아카이브 (0 = 안 함, 7/14/30). 기본 30
    @Column(name = "auto_archive_days")
    private Integer autoArchiveDays = 30;

    // DM 대화에서 AI 할 일 제안 — off면 내 메시지는 분석하지 않고(프라이버시), 내 화면에도 칩을 숨긴다
    @Column(name = "dm_suggestion_enabled")
    private Boolean dmSuggestionEnabled = true;

    /*
     * 아래 필드들은 기존 개발/내부 상태 관리용.
     * 설정 배포용 화면에서는 사용하지 않음.
     * 추후 마이그레이션 완료 후 제거 검토.
     */

    @Column(name = "calendar_default_view")
    private String calendarDefaultView = "month";

    @Column(name = "compact_mode")
    private Boolean compactMode = false;

    @Column(name = "onboarding_completed")
    private Boolean onboardingCompleted = false;

    @Column(name = "dashboard_tutorial_seen")
    private Boolean dashboardTutorialSeen = false;

    @Column(name = "todo_tutorial_seen")
    private Boolean todoTutorialSeen = false;

    @Column(name = "tasklist_tutorial_seen")
    private Boolean tasklistTutorialSeen = false;

    @Column(name = "calendar_tutorial_seen")
    private Boolean calendarTutorialSeen = false;

    // 대시보드 카드 레이아웃(react-grid-layout) — JSON 문자열, 유저 전역 1개
    @Column(name = "dashboard_layout", columnDefinition = "TEXT")
    private String dashboardLayout;

    // 대시보드 북마크 — JSON 배열, 유저 전역
    @Column(name = "dashboard_bookmarks", columnDefinition = "TEXT")
    private String dashboardBookmarks;

    // 대시보드 메모(스티커) — JSON 객체 { workspaceId: [...] }, 워크스페이스별
    @Column(name = "dashboard_stickies", columnDefinition = "TEXT")
    private String dashboardStickies;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}