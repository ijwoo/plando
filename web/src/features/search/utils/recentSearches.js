// ── 최근 검색어 (결과를 실제로 연 검색어만 저장 — 의미 있는 기록만) ──
// 검색이 워크스페이스 단위(X-Workspace-Id)이므로 기록도 워크스페이스별.
// 데스크탑 GlobalSearch / 모바일 GlobalSearchMobile 공용.

const RECENT_KEY_PREFIX = "plando.recentSearches";
export const RECENT_MAX = 8;

const recentKey = () => `${RECENT_KEY_PREFIX}.${localStorage.getItem("currentWorkspaceId") ?? "none"}`;

export function loadRecents() {
    try {
        const raw = JSON.parse(localStorage.getItem(recentKey()));
        return Array.isArray(raw) ? raw.filter((s) => typeof s === "string") : [];
    } catch {
        return [];
    }
}

function saveRecents(list) {
    try {
        localStorage.setItem(recentKey(), JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch {
        /* ignore */
    }
}

/** 검색어를 맨 앞으로(중복 제거) 기록하고 새 목록 반환 */
export function pushRecent(query) {
    const q = (query || "").trim();
    if (!q) return loadRecents();
    const next = [q, ...loadRecents().filter((s) => s !== q)].slice(0, RECENT_MAX);
    saveRecents(next);
    return next;
}

/** 특정 검색어 제거하고 새 목록 반환 */
export function dropRecent(query) {
    const next = loadRecents().filter((s) => s !== query);
    saveRecents(next);
    return next;
}

/** 전체 삭제하고 빈 목록 반환 */
export function clearRecents() {
    saveRecents([]);
    return [];
}
