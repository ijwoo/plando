/**
 * 앱 전체 z-index 중앙 관리 (단일 source of truth)
 *
 * 시맨틱 레이어:
 *     1   — STICKY (sticky 헤더 / 작은 stacking)
 *    10   — FAB (페이지 위 작은 플로팅 버튼)
 *   100   — MAP_CONTROL (지도 위 컨트롤 / 마커 라벨)
 *  1100   — TOOLTIP
 *  1200   — POPOVER (팝오버 / 메뉴)
 *  1300   — DRAWER (드로어 / 사이드바 / 모바일 네비)
 *  1400   — MODAL (모달 / 다이얼로그 / 시트 - 1단계)
 *  1500   — MODAL_NESTED (모달 위 popper / picker / 세부 패널 - 2단계)
 *  2000   — TOAST (토스트 / 스낵바, 모달 위)
 *  9999   — OVERLAY_TOP (튜토리얼, 글로벌 최상위 오버레이)
 */
export const Z = {
    // === 시맨틱 z-index (표준) ===
    STICKY: 1,
    FAB: 10,
    MAP_CONTROL: 100,
    TOOLTIP: 1100,
    POPOVER: 1200,
    DRAWER: 1300,
    MODAL: 1400,
    MODAL_NESTED: 1500,
    TOAST: 2000,
    OVERLAY_TOP: 9999,

    // === 도메인별 별칭 (기존 호환) ===
    MOBILE_NAV_BACKDROP: 1298,
    MOBILE_NAV_SHEET: 1299,
    MOBILE_NAV: 1300,
    CHAT_WIDGET: 1300,
    ONBOARDING: 1300,
    ONBOARDING_SPOTLIGHT: 1301,
    ONBOARDING_GLOW: 1301,
    ONBOARDING_LINE: 1302,
    ONBOARDING_MOTION: 1303,
    ONBOARDING_FLOAT: 1304,
    ONBOARDING_TOOLTIP: 1305,

    // DM 룸
    DM_ROOM_BACKDROP: 1399,
    DM_ROOM: 1400,

    // 바텀시트
    SHEET: 1400,

    // 이모지 피커 (시트 위)
    EMOJI_PICKER: 1402,

    // 세부 패널
    DETAIL_PANEL: 1500,

    // 에디터 슬래시 커맨드 팝업 (세부 패널 내부 에디터 위로 떠야 함)
    EDITOR_POPUP: 1600,

    // 고우선 다이얼로그
    DIALOG_BACKDROP: 1700,
    DIALOG: 1701,

    // 파일 미리보기 (최상위)
    FILE_PREVIEW: 1801,
};
