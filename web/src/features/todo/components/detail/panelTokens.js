/**
 * TaskDetailPanel 전용 CSS 클래스 매핑 — JSX와 CSS 토큰을 연결.
 * 컬러바·뱃지·dot 모두 TaskDetailPanel.css 에 정의되어 있음.
 */

export const STATUS_BAR_CLASS = {
    TODO:        "pdp-colorbar",
    IN_PROGRESS: "pdp-colorbar is-prog",
    DONE:        "pdp-colorbar is-done",
};

export const STATUS_BADGE_CLASS = {
    TODO:        "pd-badge pd-badge-todo",
    IN_PROGRESS: "pd-badge pd-badge-prog",
    DONE:        "pd-badge pd-badge-done",
};

export const STATUS_DOT_CLASS = {
    TODO:        "pd-seg-dot pd-dot-todo",
    IN_PROGRESS: "pd-seg-dot pd-dot-prog",
    DONE:        "pd-seg-dot pd-dot-done",
};
