/**
 * 마지막으로 보던 앱 화면 경로 저장/복원.
 * 콜드 스타트(네이티브 재실행)·루트 진입 시 마지막 화면으로 돌아가기 위함.
 * 인증/딥링크 경로는 저장하지 않는다(복원 대상이 아님).
 */
const KEY = "plando.lastRoute";
const FALLBACK = "/dashboard";

// 복원에서 제외할 경로 — 여기로 되돌아가면 안 되는 화면들.
//  - 인증 화면(로그인 등): 복원 대상 아님
//  - 풀스크린 푸시 화면(설정·회고): 상단바/바텀네비가 숨겨져 "재개" 진입점으로 부적절.
//    마지막 "작업 화면"은 메인 탭이어야 함(Notion/Linear도 설정으로 재개하지 않음).
const EXCLUDE_PREFIXES = [
    "/login", "/register", "/oauth2", "/join", "/forgot-password", "/reset-password",
    "/settings", "/wrap",
];

export function rememberRoute(pathname) {
    if (!pathname || pathname === "/") return;
    if (EXCLUDE_PREFIXES.some((p) => pathname.startsWith(p))) return;
    try { localStorage.setItem(KEY, pathname); } catch { /* ignore */ }
}

export function getLastRoute() {
    try {
        const v = localStorage.getItem(KEY);
        if (v && !EXCLUDE_PREFIXES.some((p) => v.startsWith(p))) return v;
    } catch { /* ignore */ }
    return FALLBACK;
}
