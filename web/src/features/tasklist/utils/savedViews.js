// ── 사용자 저장 뷰(스마트 뷰) — 현재 필터 조합을 이름 붙여 저장 (워크스페이스별 localStorage) ──
// 네이티브 smartViews.ts 미러. 하드코딩 4종(오늘/내할일/지연/반복)과 별개로 사용자가 만든다.

const KEY_PREFIX = "plando.savedViews";
export const SAVED_VIEW_MAX = 20;
export const SAVED_VIEWS_CHANGED = "plando:savedViewsChanged";

const key = () => `${KEY_PREFIX}.${localStorage.getItem("currentWorkspaceId") ?? "none"}`;

export function loadSavedViews() {
    try {
        const raw = JSON.parse(localStorage.getItem(key()));
        return Array.isArray(raw) ? raw.filter((v) => v && typeof v.id === "string" && typeof v.name === "string") : [];
    } catch {
        return [];
    }
}

function persist(list) {
    try {
        localStorage.setItem(key(), JSON.stringify(list.slice(0, SAVED_VIEW_MAX)));
        window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED));
    } catch {
        /* ignore (private mode 등) */
    }
    return list;
}

/**
 * 뷰의 담당 토큰 목록 — 구버전(assigneeIsMe/단일 assigneeFilter) 저장분을 다중 토큰으로 승계.
 * 토큰: 'me'(내 할 일) · 'none'(미지정) · <email>(멤버).
 */
export function viewAssignees(filters) {
    if (!filters) return [];
    if (Array.isArray(filters.assignees)) return filters.assignees;
    const out = [];
    if (filters.assigneeIsMe) out.push("me");
    if (filters.assigneeFilter) out.push(filters.assigneeFilter);
    return out;
}

/**
 * 저장 뷰 추가 — filters = { statusSet[], prioritySet[], recurringOnly, dueDateFilter, assignees[] }
 * 배열/원시값만 담아 직렬화 안전하게.
 */
export function addSavedView(name, filters) {
    const nm = (name || "").trim();
    if (!nm) return loadSavedViews();
    const list = loadSavedViews();
    const item = {
        id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: nm,
        filters: {
            statusSet: Array.isArray(filters.statusSet) ? filters.statusSet : [],
            prioritySet: Array.isArray(filters.prioritySet) ? filters.prioritySet : [],
            recurringOnly: !!filters.recurringOnly,
            dueDateFilter: filters.dueDateFilter ?? null,
            assignees: Array.isArray(filters.assignees) ? filters.assignees : [],
        },
    };
    return persist([item, ...list]);
}

export function removeSavedView(id) {
    return persist(loadSavedViews().filter((v) => v.id !== id));
}
