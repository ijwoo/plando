/**
 * 앱 전체에서 사용하는 커스텀 DOM 이벤트 이름 상수
 * window.dispatchEvent / window.addEventListener 에서 문자열 대신 이 상수를 사용하세요.
 */
export const APP_EVENTS = {
    // Todo
    TODO_ADDED: "todo-added",
    TODO_UPDATED: "todo-updated",
    TODO_DELETED: "todo-deleted",
    OPEN_ADD_TODO: "open-add-todo",
    RECENT_TODOS_CHANGED: "recent-todos-changed",

    // Workflow statuses (커스텀 상태 정의 변경 — 보드/피커/라벨 맵 재로딩)
    STATUSES_CHANGED: "statuses-changed",
    // Tags (태그 정의 변경)
    TAGS_CHANGED: "tags-changed",

    // DM
    DM_UNREAD_CHANGED: "dm-unread-changed",
    DM_FILE_SENT: "dm-file-sent",

    // Notification
    NOTIFICATIONS_CHANGED: "notifications-changed",

    // Settings
    SETTINGS_CHANGED: "settings-changed",

    // App-level toast
    APP_TOAST: "app-toast",

    // Chat (Phase 12 — Quickbar/Dashboard에서 ChatWidget 열기)
    OPEN_CHAT: "open-chat",

    // Global STOMP (Phase 12 — presence refetch trigger)
    STOMP_CONNECTED: "stomp-connected",

    // Presence (Phase 12 — STOMP /topic/presence broadcast 수신 시 dispatch)
    PRESENCE_CHANGED: "presence-changed",

    // Guest block — 게스트가 작성/전송 액션 시도 시 전역 GuestBlockModal 트리거
    GUEST_BLOCK_REQUEST: "guest-block-request",

    // Auth — 세션 만료(401) 시 React 트리 내에서 로그인 리다이렉트 처리
    SESSION_EXPIRED: "session-expired",
};
