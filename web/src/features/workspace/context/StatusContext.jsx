import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { fetchStatuses } from "../../todo/api/statusApi.js";
import { fetchTags } from "../../todo/api/tagApi.js";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { getToken } from "../../../shared/utils/tokenUtils.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { STATUS_LABEL, statusColor } from "../../../shared/ui/tone.js";

const StatusContext = createContext(null);

/**
 * 상태집합 로딩 전 폴백(기본 3상태) — 커스텀 상태가 로드되기 전에도 화면이 깨지지 않게.
 * 색은 여기서 고정하지 않는다. tone.js statusColor(theme, key)가 단일 소스.
 */
const FALLBACK_STATUSES = [
    { id: -1, statusKey: "TODO", label: "할 일", color: null, category: "TODO", sortOrder: 0, isDefault: true },
    { id: -2, statusKey: "IN_PROGRESS", label: "진행 중", color: null, category: "IN_PROGRESS", sortOrder: 1, isDefault: false },
    { id: -3, statusKey: "DONE", label: "완료", color: null, category: "DONE", sortOrder: 2, isDefault: false },
];

// 상태 정렬 — 카테고리(할일→진행중→완료)를 먼저, 같은 카테고리 안에선 sortOrder.
// 커스텀 상태(예: '검토필요'=진행중)가 생성 순서와 무관하게 제 카테고리 자리에 놓이도록.
const CATEGORY_RANK = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
function sortStatuses(list) {
    return [...list].sort((a, b) => {
        const ca = CATEGORY_RANK[a.category] ?? 1;
        const cb = CATEGORY_RANK[b.category] ?? 1;
        if (ca !== cb) return ca - cb;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
}

/**
 * 워크스페이스별 커스텀 상태·태그 정의를 로드/캐시하는 컨텍스트.
 * 상태는 보드 컬럼·라벨·색 전반에 쓰이므로 워크스페이스 단위 전역 config로 관리한다(WorkspaceContext와 동일 톤).
 */
export function StatusProvider({ children }) {
    const theme = useTheme();
    const { currentWorkspace } = useWorkspace();
    const [statuses, setStatuses] = useState(FALLBACK_STATUSES);
    const [tags, setTags] = useState([]);

    const loadStatuses = useCallback(async () => {
        if (!getToken()) return;
        try {
            const data = await fetchStatuses();
            setStatuses(Array.isArray(data) && data.length ? sortStatuses(data) : FALLBACK_STATUSES);
        } catch {
            setStatuses(FALLBACK_STATUSES);
        }
    }, []);

    const loadTags = useCallback(async () => {
        if (!getToken()) return;
        try {
            const data = await fetchTags();
            setTags(Array.isArray(data) ? data : []);
        } catch {
            setTags([]);
        }
    }, []);

    // 워크스페이스 전환 시 재로딩
    useEffect(() => {
        loadStatuses();
        loadTags();
    }, [currentWorkspace?.workspaceId, loadStatuses, loadTags]);

    // 정의 변경 이벤트 → 재로딩
    useEffect(() => {
        const onStatuses = () => loadStatuses();
        const onTags = () => loadTags();
        window.addEventListener(APP_EVENTS.STATUSES_CHANGED, onStatuses);
        window.addEventListener(APP_EVENTS.TAGS_CHANGED, onTags);
        return () => {
            window.removeEventListener(APP_EVENTS.STATUSES_CHANGED, onStatuses);
            window.removeEventListener(APP_EVENTS.TAGS_CHANGED, onTags);
        };
    }, [loadStatuses, loadTags]);

    const byKey = useMemo(() => {
        const m = new Map();
        for (const s of statuses) m.set(s.statusKey, s);
        return m;
    }, [statuses]);

    const value = useMemo(() => {
        const label = (key) => byKey.get(key)?.label ?? STATUS_LABEL[key] ?? key ?? "-";
        // 커스텀 상태는 정의된 색이 우선, 없으면 tone.js 단일 소스로 폴백(알 수 없는 키 → danger)
        const colorOf = (key) => byKey.get(key)?.color ?? statusColor(theme, key);
        const categoryOf = (key) => byKey.get(key)?.category ?? (key === "IN_PROGRESS" ? "IN_PROGRESS" : key === "DONE" ? "DONE" : "TODO");
        const toneOf = (t, key) => {
            const base = colorOf(key);
            const isDark = t.palette.mode === "dark";
            return { bg: alpha(base, isDark ? 0.14 : 0.10), border: alpha(base, isDark ? 0.22 : 0.18), text: t.palette.text.primary, color: base };
        };
        return { statuses, tags, byKey, label, colorOf, categoryOf, toneOf, reloadStatuses: loadStatuses, reloadTags: loadTags };
    }, [statuses, tags, byKey, theme, loadStatuses, loadTags]);

    return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useStatuses() {
    const ctx = useContext(StatusContext);
    if (!ctx) throw new Error("useStatuses must be used within a StatusProvider");
    return ctx;
}
