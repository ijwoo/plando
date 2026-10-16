import { useCallback, useState } from "react";

/**
 * 할 일 목록(데스크탑) 커스텀 컬럼.
 * 레이아웃: [6px 바][제목(유연,채움 min 220)][표시 컬럼들(고정,리사이즈)][36px 액션/+]
 * 리사이즈 = 인접 쌍(경계 양옆 두 컬럼만 주고받음) → 다른 컬럼 안 밀림, 표 폭 그대로(오버플로 없음).
 * 표시/너비/순서는 localStorage 저장. 너비는 CSS 변수(--tlc-<key>)로 드래그 중 라이브 반영.
 */
export const TASKLIST_COLUMNS = [
    { key: "status", label: "상태", width: 100, min: 84, default: true },
    { key: "assignees", label: "담당자", width: 130, min: 72, default: true },
    { key: "due", label: "마감일", width: 140, min: 100, default: true },
    { key: "priority", label: "우선순위", width: 100, min: 84, default: true },
    // 전체/인박스 스코프에서 소속 식별용 — 프로젝트 스코프에선 페이지에서 숨김 처리
    { key: "project", label: "프로젝트", width: 140, min: 96, default: true },
];

const DEF = Object.fromEntries(TASKLIST_COLUMNS.map((c) => [c.key, c]));
const STORAGE_KEY = "plando.tasklistColumns.v3"; // v3: 프로젝트 컬럼 기본 on

export const TITLE_MIN = 220;

export function colMin(key) {
    return DEF[key]?.min ?? 72;
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
}
function save(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** [6px 바][제목 유연(min 220)][표시 컬럼들(고정,var)][36px 액션/+] — 끝 빈 공간 없음 */
export function buildGridCols(columns) {
    const cols = columns.map((c) => `var(--tlc-${c.key}, ${c.width}px)`).join(" ");
    return `6px minmax(${TITLE_MIN}px, 1fr) ${cols} 36px`;
}

/** 테이블 컨테이너에 깔 CSS 변수 (현재 너비). */
export function columnVars(columns) {
    const vars = {};
    for (const c of columns) vars[`--tlc-${c.key}`] = `${c.width}px`;
    return vars;
}

export function useTaskListColumns() {
    const [state, setState] = useState(() => {
        const saved = load();
        return {
            order: saved?.order ?? TASKLIST_COLUMNS.map((c) => c.key),
            visible: saved?.visible ?? TASKLIST_COLUMNS.filter((c) => c.default).map((c) => c.key),
            widths: saved?.widths ?? {},
        };
    });

    const commit = (next) => { save(next); return next; };

    const toggle = useCallback((key) => setState((p) => {
        const visible = p.visible.includes(key) ? p.visible.filter((k) => k !== key) : [...p.visible, key];
        return commit({ ...p, visible });
    }), []);

    const setWidth = useCallback((key, w) => setState((p) => (
        commit({ ...p, widths: { ...p.widths, [key]: Math.max(colMin(key), Math.round(w)) } })
    )), []);

    const reorder = useCallback((fromKey, toKey) => setState((p) => {
        const order = [...p.order];
        const fi = order.indexOf(fromKey);
        const ti = order.indexOf(toKey);
        if (fi < 0 || ti < 0 || fi === ti) return p;
        order.splice(fi, 1);
        order.splice(ti, 0, fromKey);
        return commit({ ...p, order });
    }), []);

    const visibleSet = new Set(state.visible);
    const columns = state.order
        .filter((k) => visibleSet.has(k) && DEF[k])
        .map((k) => ({ ...DEF[k], width: state.widths[k] ?? DEF[k].width }));
    return { columns, allColumns: TASKLIST_COLUMNS, isVisible: (k) => visibleSet.has(k), toggle, setWidth, reorder };
}
