import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { getToken } from "../../../shared/utils/tokenUtils.js";
import { clearProjects, getProjectById, loadProjects, PROJECTS_CHANGED } from "../store/projectStore.js";

/**
 * 글로벌 프로젝트 필터(스코프).
 * - activeProjectId: null = 전체, number = 특정 프로젝트, "inbox" = 프로젝트 없는 할 일
 * - 워크스페이스별 localStorage 저장, 워크스페이스 바뀌면 그 워크스페이스 저장값으로(없으면 전체)
 * - matchesActiveProject(todo): 할 일 중심 뷰(보드·목록·캘린더)가 이 함수로 필터
 * - 프로젝트 목록 로딩도 여기서 트리거 (워크스페이스 변경 시 projectStore.loadProjects)
 */
const ActiveProjectContext = createContext(null);
const KEY = "activeProject";

export function ActiveProjectProvider({ children }) {
    const { currentWorkspace } = useWorkspace();
    const wsId = currentWorkspace?.workspaceId ?? "none";

    const [activeProjectId, setActiveProjectIdState] = useState(null);

    const [projVersion, bumpProjVersion] = useReducer((x) => x + 1, 0);

    // 워크스페이스 변경 → 저장된 스코프 즉시 복원 + 프로젝트 목록 로드.
    // 로드 완료 후 저장된 프로젝트가 더 이상 없으면(삭제) 전체로 — "라벨은 전체인데 필터만 살아있는" 빈 화면 방지
    useEffect(() => {
        let stored = null;
        try {
            const raw = localStorage.getItem(`${KEY}.${wsId}`);
            stored = raw ? JSON.parse(raw) : null;
        } catch { stored = null; }
        setActiveProjectIdState(stored);

        if (wsId === "none" || !getToken()) {
            clearProjects();
            return;
        }
        loadProjects()
            .then(() => {
                setActiveProjectIdState((cur) => {
                    if (typeof cur === "number" && !getProjectById(cur)) {
                        try { localStorage.removeItem(`${KEY}.${wsId}`); } catch { /* ignore */ }
                        return null;
                    }
                    return cur;
                });
            })
            .catch(() => { /* 로드 실패 시 스코프는 유지 — 다음 변경 이벤트에서 재시도 */ });
    }, [wsId]);

    // 할 일 추가/변경/삭제 → 프로젝트 카운트(todoCount/doneCount) 갱신 (디바운스 — 연속 변경 묶음)
    useEffect(() => {
        let timer = null;
        const handle = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (getToken()) loadProjects().catch(() => {});
            }, 800);
        };
        window.addEventListener(APP_EVENTS.TODO_ADDED, handle);
        window.addEventListener(APP_EVENTS.TODO_UPDATED, handle);
        return () => {
            clearTimeout(timer);
            window.removeEventListener(APP_EVENTS.TODO_ADDED, handle);
            window.removeEventListener(APP_EVENTS.TODO_UPDATED, handle);
        };
    }, []);

    // 프로젝트 목록 변경(생성/수정/삭제) → 활성 프로젝트가 삭제됐으면 전체로, 이름/색 변경은 리렌더 반영
    useEffect(() => {
        const handle = () => {
            bumpProjVersion();
            setActiveProjectIdState((cur) => {
                if (typeof cur === "number" && !getProjectById(cur)) {
                    try { localStorage.removeItem(`${KEY}.${wsId}`); } catch { /* ignore */ }
                    return null;
                }
                return cur;
            });
        };
        window.addEventListener(PROJECTS_CHANGED, handle);
        return () => window.removeEventListener(PROJECTS_CHANGED, handle);
    }, [wsId]);

    const setActiveProject = useCallback((id) => {
        setActiveProjectIdState(id ?? null);
        try {
            if (id == null) localStorage.removeItem(`${KEY}.${wsId}`);
            else localStorage.setItem(`${KEY}.${wsId}`, JSON.stringify(id));
        } catch { /* ignore */ }
    }, [wsId]);

    // 서버 todo가 projectId(null = 인박스)를 직접 들고 있으므로 단순 비교
    const matchesActiveProject = useCallback((todo) => {
        if (activeProjectId == null) return true; // 전체
        if (activeProjectId === "inbox") return todo?.projectId == null;
        return todo?.projectId === activeProjectId;
    }, [activeProjectId]);

    const activeProject = useMemo(() => {
        if (activeProjectId == null || activeProjectId === "inbox") return null;
        return getProjectById(activeProjectId);
    }, [activeProjectId, projVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    const value = useMemo(
        () => ({ activeProjectId, activeProject, setActiveProject, matchesActiveProject }),
        [activeProjectId, activeProject, setActiveProject, matchesActiveProject]
    );

    return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>;
}

export function useActiveProject() {
    const ctx = useContext(ActiveProjectContext);
    if (!ctx) throw new Error("useActiveProject must be used within ActiveProjectProvider");
    return ctx;
}
