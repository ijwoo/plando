import { useCallback, useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import {
    deleteWorkspace,
    leaveWorkspace,
    transferOwner,
    checkHasRecruitments,
} from "../api/workspaceApi.js";

/**
 * 워크스페이스 삭제 / 나가기 / 관리자 위임 공통 로직
 *
 * confirm 타입:
 *   "leave"    — 일반 나가기 확인
 *   "transfer" — 관리자 위임 선택
 *   "delete"   — 삭제 확인 (+ hasRecruitments 플래그)
 */
export function useWorkspaceActions({ onSuccess } = {}) {
    const { workspaces, loadWorkspaces } = useWorkspace();

    const [confirm,        setConfirm]        = useState(null);
    const [transferTarget, setTransferTarget] = useState(null);
    const [transferring,   setTransferring]   = useState(false);
    const [errorMsg,       setErrorMsg]       = useState("");

    const clearError = useCallback(() => setErrorMsg(""), []);

    // ── 나가기 클릭 ──────────────────────────────────────────────
    const handleLeaveClick = useCallback((ws, members) => {
        setErrorMsg("");
        if (workspaces.length <= 1) {
            setErrorMsg("유일한 워크스페이스입니다. 나가려면 먼저 새 워크스페이스를 만들어주세요.");
            return;
        }
        const isOwner = ws?.role === "OWNER";
        if (isOwner && members.length > 1) {
            setTransferTarget(null);
            setConfirm({ type: "transfer" });
        } else {
            setConfirm({ type: "leave" });
        }
    }, [workspaces]);

    // ── 삭제 클릭 ────────────────────────────────────────────────
    const handleDeleteClick = useCallback(async (ws) => {
        setErrorMsg("");
        if (workspaces.length <= 1) {
            setErrorMsg("워크스페이스는 최소 1개 이상 있어야 합니다. 새 워크스페이스를 만든 후 삭제해 주세요.");
            return;
        }
        let hasRecruitments = false;
        try { hasRecruitments = await checkHasRecruitments(ws.workspaceId); } catch { /* ignore */ }
        setConfirm({ type: "delete", hasRecruitments });
    }, [workspaces]);

    // ── 나가기 실행 ──────────────────────────────────────────────
    const handleLeave = useCallback(async (ws, afterClose) => {
        if (!ws) return;
        try {
            await leaveWorkspace(ws.workspaceId);
            await loadWorkspaces();
            afterClose?.();
        } catch (e) {
            setErrorMsg(e?.response?.data?.message || "나가기에 실패했습니다.");
        }
        setConfirm(null);
    }, [loadWorkspaces]);

    // ── 삭제 실행 ────────────────────────────────────────────────
    const handleDelete = useCallback(async (ws, afterClose) => {
        if (!ws) return;
        try {
            await deleteWorkspace(ws.workspaceId);
            await loadWorkspaces();
            afterClose?.();
        } catch (e) {
            setErrorMsg(e?.response?.data?.message || "삭제에 실패했습니다.");
        }
        setConfirm(null);
    }, [loadWorkspaces]);

    // ── 관리자 위임 후 나가기 ────────────────────────────────────
    const handleTransferAndLeave = useCallback(async (ws, afterClose) => {
        if (!transferTarget || !ws) return;
        setTransferring(true);
        try {
            const targetId = transferTarget.userId || transferTarget.id;
            await transferOwner(ws.workspaceId, targetId);
            await leaveWorkspace(ws.workspaceId);
            await loadWorkspaces();
            afterClose?.();
        } catch (e) {
            setErrorMsg(e?.response?.data?.message || "관리자 위임에 실패했습니다.");
        }
        setTransferring(false);
        setConfirm(null);
    }, [transferTarget, loadWorkspaces]);

    const reset = useCallback(() => {
        setConfirm(null);
        setTransferTarget(null);
        setErrorMsg("");
    }, []);

    return {
        confirm, setConfirm,
        transferTarget, setTransferTarget,
        transferring,
        errorMsg, clearError,
        handleLeaveClick,
        handleDeleteClick,
        handleLeave,
        handleDelete,
        handleTransferAndLeave,
        reset,
    };
}
