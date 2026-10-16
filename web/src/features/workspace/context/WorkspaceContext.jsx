import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMyWorkspaces } from "../api/workspaceApi.js";
import { getToken } from "../../../shared/utils/tokenUtils.js";

const WorkspaceContext = createContext(null);

const LS_CURRENT_WORKSPACE_ID = "currentWorkspaceId";
const LS_WORKSPACES = "workspaces";

function getInitialWorkspaces() {
    try {
        const raw = localStorage.getItem(LS_WORKSPACES);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error("workspaces 파싱 실패:", e);
        return [];
    }
}

export function WorkspaceProvider({ children }) {
    const [workspaces, setWorkspaces] = useState(getInitialWorkspaces);
    const [currentWorkspace, setCurrentWorkspace] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const syncCurrentWorkspace = useCallback((workspaceList) => {
        if (!workspaceList || workspaceList.length === 0) {
            setCurrentWorkspace(null);
            localStorage.removeItem(LS_CURRENT_WORKSPACE_ID);
            return;
        }

        const savedId = localStorage.getItem(LS_CURRENT_WORKSPACE_ID);
        const matched = workspaceList.find(
            (ws) => String(ws.workspaceId) === String(savedId)
        );

        const nextWorkspace = matched || workspaceList[0];
        setCurrentWorkspace(nextWorkspace);
        localStorage.setItem(LS_CURRENT_WORKSPACE_ID, String(nextWorkspace.workspaceId));
    }, []);

    const loadWorkspaces = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getMyWorkspaces();
            const normalized = Array.isArray(data) ? data : [];

            setWorkspaces(normalized);
            localStorage.setItem(LS_WORKSPACES, JSON.stringify(normalized));
            syncCurrentWorkspace(normalized);
            setLoadError(false);
        } catch (err) {
            // 일시적 네트워크 오류 시 캐시된 목록/선택 워크스페이스를 유지한다.
            // (여기서 상태·localStorage를 지우면 모든 요청이 X-Workspace-Id 없이 나가고
            //  전 화면이 "워크스페이스 없음" 상태가 됨 — 캐시는 이런 상황을 버티라고 존재)
            // 목록 비우기는 서버가 정상 응답으로 빈 목록을 줄 때(위 성공 경로)만 수행.
            console.error("워크스페이스 목록 조회 실패:", err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [syncCurrentWorkspace]);

    const changeWorkspace = useCallback((workspace) => {
        if (!workspace) return;
        setCurrentWorkspace(workspace);
        localStorage.setItem(LS_CURRENT_WORKSPACE_ID, String(workspace.workspaceId));
    }, []);

    useEffect(() => {
        syncCurrentWorkspace(workspaces);
    }, [workspaces, syncCurrentWorkspace]);

    // 앱 시작 시 토큰이 있으면 워크스페이스 목록 자동 로드
    useEffect(() => {
        if (getToken()) {
            loadWorkspaces();
        }
    }, [loadWorkspaces]);

    const value = useMemo(
        () => ({
            workspaces,
            currentWorkspace,
            loading,
            loadError,
            loadWorkspaces,
            changeWorkspace,
        }),
        [workspaces, currentWorkspace, loading, loadError, loadWorkspaces, changeWorkspace]
    );

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) {
        throw new Error("useWorkspace must be used within a WorkspaceProvider");
    }
    return ctx;
}