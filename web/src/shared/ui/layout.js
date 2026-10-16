// Layout 치수의 single source of truth.
// Navbar Toolbar minHeight과 Layout의 fixed-navbar padding 보정에 사용된다.
export const MOBILE_NAVBAR_HEIGHT = 56;
// 데스크탑 상단 네비 높이 — 컴팩트하게(본문 카드 높이 확보). 패널 빠른캡처 띠도 이 값에 맞춰짐.
export const DESKTOP_NAVBAR_HEIGHT = 52;

// 클릭업식 2단 사이드바 치수 — Layout/Sidebar/SidebarIconRail 단일 출처.
// (이전엔 Layout이 308/64를 하드코딩, Sidebar가 동일 값을 따로 계산 → 드리프트 위험)
export const SIDEBAR_RAIL_WIDTH = 56;   // 아이콘 레일 폭
export const SIDEBAR_PAD = 8;           // 카드 바깥 여백(좌·상·하)
export const SIDEBAR_GAP = 8;           // 레일↔패널 사이 여백
export const SIDEBAR_PANEL_WIDTH = 236; // 맥락 패널 폭
export const SIDEBAR_W_EXPANDED = SIDEBAR_PAD + SIDEBAR_RAIL_WIDTH + SIDEBAR_GAP + SIDEBAR_PANEL_WIDTH; // 308
export const SIDEBAR_W_COLLAPSED = SIDEBAR_PAD + SIDEBAR_RAIL_WIDTH; // 64
