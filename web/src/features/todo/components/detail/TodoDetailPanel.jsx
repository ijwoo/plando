import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

import useTodoDetailPanel from "../../hooks/useTodoDetailPanel.js";
import { useDebouncedCallback } from "../../../../shared/hooks/useDebouncedCallback.js";
import ConfirmDialog from "../../../../shared/ui/common/ConfirmDialog.jsx";
import RecurrenceEditScopeModal from "./RecurrenceEditScopeModal.jsx";
import TodoDetailDesktop from "./TodoDetailDesktop.jsx";
import TodoDetailMobile from "./TodoDetailMobile.jsx";
import { useWorkspace } from "../../../workspace/context/WorkspaceContext.jsx";
import { archiveTodo, updateTodoFocus } from "../../api/todoApi.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";

export default function TodoDetailPanel({
                                            todo,
                                            onClose,
                                            onDelete,
                                            onPatchLocal,
                                            onRestore,
                                            showClose = true,
                                        }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();

    const isGeneratedInstance = !!todo?.recurrenceSourceId;
    const [localHasRecurrence, setLocalHasRecurrence] = useState(!!todo?.hasRecurrence);

    const isRecurringTodo = !!(localHasRecurrence || todo?.hasRecurrence || todo?.recurrenceSourceId);

    const [scopeModalOpen, setScopeModalOpen] = useState(false);
    const [recurrenceScope, setRecurrenceScope] = useState("SINGLE");
    const [scopeDecided, setScopeDecided] = useState(false);
    // 범위 선택 전 보류된 수정 내용 — [{ field, value }] 목록 (필드별 마지막 값만 유지)
    const pendingCommitRef = useRef(null);
    // 아카이브 확인 다이얼로그
    const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

    useEffect(() => {
        if (todo?.id) {
            setRecurrenceScope("SINGLE");
            setScopeDecided(false);
            setLocalHasRecurrence(!!todo?.hasRecurrence);
            pendingCommitRef.current = null;
        }
    }, [todo?.id, todo?.hasRecurrence]);

    useEffect(() => {
        const handler = (e) => {
            const { id, patch } = e.detail ?? {};
            if (id === todo?.id && patch?.hasRecurrence !== undefined) {
                setLocalHasRecurrence(!!patch.hasRecurrence);
                setScopeDecided(false);
            }
        };
        window.addEventListener(APP_EVENTS.TODO_UPDATED, handler);
        return () => window.removeEventListener(APP_EVENTS.TODO_UPDATED, handler);
    }, [todo?.id]);

    const {
        tab,
        setTab,

        editable,
        setEditable,

        assigneeOptions,

        selectedAssignees,
        setSelectedAssignees,

        saveState,

        deleteOpen,
        setDeleteOpen,
        errorOpen,
        setErrorOpen,
        errorMessage,
        setErrorMessage,

        commit,
        commitMany,
        retryCommit,
        getLastSaved,
    } = useTodoDetailPanel({ todo, onPatchLocal, recurrenceScope });

    /* 보류분은 반드시 commitMany로 한 번에 내보낸다 — commit을 루프로 여러 번 부르면
       각 호출이 같은 롤백 기준값(base)을 캡처해서, 마지막에 끝난 저장이 다른 필드의
       저장 결과를 기준값에서 지워 버린다. */
    const flushPendings = useCallback((pendings, run) => {
        run(Object.fromEntries(pendings.map(({ field, value }) => [field, value])));
    }, []);

    // 범위 결정 후 보류된 수정 실행
    useEffect(() => {
        if (!scopeDecided || !pendingCommitRef.current?.length) return;
        const pendings = pendingCommitRef.current;
        pendingCommitRef.current = null;
        flushPendings(pendings, commitMany);
    }, [scopeDecided, commitMany, flushPendings]);

    // 반복 일정이면 첫 수정 시 모달 경유, 아니면 바로 저장
    const guardedCommit = useCallback((field, value) => {
        if (isRecurringTodo && !scopeDecided) {
            // 같은 필드는 마지막 값만 유지 (디바운스로 여러 번 들어와도 중복 커밋 방지)
            const rest = (pendingCommitRef.current ?? []).filter((p) => p.field !== field);
            pendingCommitRef.current = [...rest, { field, value }];
            setScopeModalOpen(true);
            return;
        }
        commit(field, value);
    }, [isRecurringTodo, scopeDecided, commit]);

    /** 여러 필드를 한 묶음으로 — 반복 범위 게이트는 guardedCommit과 동일. */
    const guardedCommitMany = useCallback((fields) => {
        const entries = Object.entries(fields ?? {});
        if (!entries.length) return;
        if (isRecurringTodo && !scopeDecided) {
            const keys = new Set(entries.map(([f]) => f));
            const rest = (pendingCommitRef.current ?? []).filter((p) => !keys.has(p.field));
            pendingCommitRef.current = [...rest, ...entries.map(([field, value]) => ({ field, value }))];
            setScopeModalOpen(true);
            return;
        }
        commitMany(fields);
    }, [isRecurringTodo, scopeDecided, commitMany]);

    // 패널 unmount 시 범위 미선택으로 보류된 수정이 남아 있으면 안전 기본값("이 일정만")으로 저장.
    // (범위 모달을 못 고른 채 패널이 닫히면, 화면에 보이던 수정이 서버에 저장되지 않는 silent loss 방지)
    const commitManyRef = useRef(commitMany);
    useEffect(() => { commitManyRef.current = commitMany; }, [commitMany]);
    useEffect(() => () => {
        const pendings = pendingCommitRef.current;
        if (pendings?.length) {
            pendingCommitRef.current = null;
            flushPendings(pendings, commitManyRef.current);
        }
    }, [flushPendings]);

    const guardedDebouncedCommit = useDebouncedCallback(guardedCommit, 600);

    const handleClose = () => {
        guardedDebouncedCommit.flush?.();
        onClose?.();
    };

    if (!todo || !editable) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 16, mb: 1 }}>
                    Task Detail
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    왼쪽에서 작업을 클릭하면 상세가 여기에 표시돼요.
                </Typography>
            </Box>
        );
    }

    const handleMapClick = () => {
        guardedDebouncedCommit.flush?.();
        onClose?.();
        navigate("/map", { state: { focusTodoId: todo.id } });
    };

    /** 포커스(⚡) 토글. 백엔드 PATCH + 로컬 editable + 상위 + 글로벌 이벤트. */
    const handleToggleFocus = async () => {
        const next = !(editable?.focused ?? todo?.focused);
        // 낙관적 UI — editable이 stale 되지 않도록 즉시 반영
        setEditable((prev) => (prev ? { ...prev, focused: next } : prev));
        try {
            await updateTodoFocus(todo.id, next);
            onPatchLocal?.({ focused: next });
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todo.id, patch: { focused: next } } }));
        } catch (err) {
            // 롤백
            setEditable((prev) => (prev ? { ...prev, focused: !next } : prev));
            const msg = err?.response?.status === 403
                ? (todo?.isSample ? "샘플 데이터는 읽기 전용입니다." : "포커스를 변경할 권한이 없어요.")
                : "포커스 변경 중 오류가 발생했어요.";
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: msg, severity: "error" } }));
        }
    };

    const handleArchive = async () => {
        try {
            await archiveTodo(todo.id);
            handleClose();
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todo.id, archived: true } }));
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "아카이브로 보관됐어요.", severity: "success" } }));
        } catch (err) {
            const msg = err?.response?.status === 403
                ? (todo?.isSample ? "샘플 데이터는 읽기 전용입니다." : "보관할 권한이 없어요.")
                : "아카이브 중 오류가 발생했어요.";
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: msg, severity: "error" } }));
        }
    };

    const viewProps = {
        todo,
        onClose: handleClose,
        onDelete,
        onPatchLocal,
        showClose,

        tab,
        setTab,

        editable,
        setEditable,

        assigneeOptions,

        selectedAssignees,
        setSelectedAssignees,

        saveState,

        deleteOpen,
        setDeleteOpen,
        errorOpen,
        setErrorOpen,
        errorMessage,
        setErrorMessage,

        commit: guardedCommit,
        commitMany: guardedCommitMany,
        debouncedCommit: guardedDebouncedCommit,
        retryCommit,

        onMapClick: handleMapClick,
        // 자식 컴포넌트의 아카이브 버튼은 곧장 archive를 호출하지 않고 확인 다이얼로그를 띄움
        onArchive: todo?.archived ? undefined : () => setArchiveConfirmOpen(true),
        onRestore: todo?.archived ? onRestore : undefined,
        focused: !!editable?.focused,
        onToggleFocus: (todo?.archived || todo?.isSample) ? undefined : handleToggleFocus,
        workspaceId: currentWorkspace?.workspaceId,
    };

    return (
        <>
            <RecurrenceEditScopeModal
                open={scopeModalOpen}
                isGeneratedInstance={isGeneratedInstance}
                onSelect={(scope) => {
                    setRecurrenceScope(scope);
                    setScopeDecided(true);
                    setScopeModalOpen(false);
                }}
                onClose={() => {
                    // 범위 미선택 취소/닫기 — 보류된 수정이 화면에만 남고 서버에 저장 안 되는 불일치 방지
                    const pendings = pendingCommitRef.current;
                    pendingCommitRef.current = null;
                    setScopeModalOpen(false);
                    if (!pendings?.length) return;

                    const revertPatch = {};
                    // 여러 필드를 각각 commit하면 롤백 기준값(base)이 서로 덮어써진다 → 한 묶음으로 모아 저장
                    const fallbackFields = {};
                    for (const { field, value } of pendings) {
                        if (field === "title" || field === "content") {
                            // 제목(contentEditable)/내용(에디터)은 자체 DOM 상태라 화면 되돌리기 불가
                            // → 안전 기본값("이 일정만")으로 저장해 화면=서버를 맞춘다
                            fallbackFields[field] = value;
                        } else {
                            // 그 외 필드는 마지막 저장값으로 되돌리기
                            revertPatch[field] = getLastSaved(field);
                            if (field === "assignees") {
                                revertPatch.assigneeNames = getLastSaved("assigneeNames");
                                const asg = getLastSaved("assignees") ?? [];
                                setSelectedAssignees(
                                    Array.isArray(asg)
                                        ? asg.map((a) => (typeof a === "string" ? a : a.email)).filter(Boolean)
                                        : String(asg).split(",").filter(Boolean)
                                );
                            }
                        }
                    }
                    if (Object.keys(revertPatch).length > 0) {
                        setEditable((prev) => (prev ? { ...prev, ...revertPatch } : prev));
                        onPatchLocal?.(revertPatch);
                        window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todo.id, patch: revertPatch } }));
                    }
                    if (Object.keys(fallbackFields).length > 0) {
                        commitMany(fallbackFields);
                        window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                            detail: { message: "반복 범위를 선택하지 않아 이 일정에만 저장했어요.", severity: "info" },
                        }));
                    }
                }}
            />

            {isMobile ? (
                <TodoDetailMobile {...viewProps} />
            ) : (
                <TodoDetailDesktop {...viewProps} />
            )}

            <ConfirmDialog
                open={deleteOpen}
                title="삭제 확인"
                message={`${
                    editable?.title ? `"${editable.title}" ` : "이 작업을 "
                }삭제할까요?\n삭제하면 되돌릴 수 없어요.`}
                confirmText="삭제"
                onClose={() => setDeleteOpen(false)}
                onConfirm={async () => {
                    try {
                        setDeleteOpen(false);
                        await onDelete?.(todo.id);
                        handleClose();
                        window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "삭제됐어요.", severity: "success" } }));
                    } catch (err) {
                        if (err?.response?.status === 403) {
                            setErrorMessage("작성자만 이 작업을 삭제할 수 있습니다.");
                        } else {
                            /* 반드시 문자열로 좁힌다. GlobalExceptionHandler는 err.response.data 를
                               Map.of("message", ...) 객체로 내려주는데, 이걸 그대로 넣으면 React가
                               "Objects are not valid as a React child"로 던지고 ErrorBoundary가
                               앱 전체를 교체한다 — 열려 있던 모든 폼의 미저장 내용이 사라진다. */
                            const raw = err?.response?.data;
                            setErrorMessage(
                                (typeof raw === "string" && raw)
                                || (typeof raw?.message === "string" && raw.message)
                                || "삭제 중 오류가 발생했습니다."
                            );
                        }
                        setErrorOpen(true);
                    }
                }}
            />

            <ConfirmDialog
                open={errorOpen}
                title="삭제할 수 없음"
                message={errorMessage}
                confirmText="확인"
                confirmColor="primary"
                hideCancel
                onClose={() => setErrorOpen(false)}
                onConfirm={() => setErrorOpen(false)}
            />

            <ConfirmDialog
                open={archiveConfirmOpen}
                title="아카이브로 보관할까요?"
                message={"보관된 작업은 보드와 작업 목록에서 숨겨지지만 삭제되지 않아요.\n언제든 아카이브에서 복원할 수 있어요."}
                confirmText="아카이브"
                cancelText="취소"
                confirmColor="primary"
                onClose={() => setArchiveConfirmOpen(false)}
                onConfirm={async () => {
                    setArchiveConfirmOpen(false);
                    await handleArchive();
                }}
            />
        </>
    );
}
