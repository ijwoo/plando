/**
 * 회고 진입 카드 노출 제어 — localStorage 기반.
 * 사용자가 회고 페이지를 한 번 열면 그 주차는 진입 카드에서 사라짐.
 *
 * key: wrap-viewed-{weekStart}  (예: wrap-viewed-2026-05-25)
 * value: 1
 */
const PREFIX = "wrap-viewed-";

export function markWrapViewed(weekStart) {
    if (!weekStart) return;
    try {
        localStorage.setItem(PREFIX + weekStart, "1");
    } catch { /* private mode 등 — 조용히 무시 */ }
}

export function wasWrapViewed(weekStart) {
    if (!weekStart) return false;
    try {
        return localStorage.getItem(PREFIX + weekStart) === "1";
    } catch {
        return false;
    }
}
