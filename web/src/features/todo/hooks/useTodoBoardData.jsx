import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { addTodo, deleteTodo, fetchTodos } from "../api/todoApi.js";
import { resolveListFetchError } from "../../../shared/utils/apiAuthError.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { createEmptyTask, isPristineTask } from "../utils/createEmptyTask.js";
import { useDefaultPriority } from "./useDefaultPriority.js";
import { useConfirmDelete } from "./useConfirmDelete.js";
import { useOpenTodoDetail } from "./useOpenTodoDetail.jsx";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";
import { useRefetchOnFocus } from "../../../shared/hooks/useRefetchOnFocus.js";

export default function useTodoBoardData({ nav }) {
    const [todos, setTodos] = useState([]);
    /* 첫 조회 완료 여부. todos가 []로 시작하므로 이게 없으면 화면 진입/워크스페이스 전환마다
       "할 일이 없어요" 빈 상태가 한 프레임 번쩍인다. */
    const [loaded, setLoaded] = useState(false);
    // 403(워크스페이스 접근 권한 없음) 안내 — 로그아웃 대신 화면에 배너로 노출
    const [accessError, setAccessError] = useState(null);
    const [open, setOpen] = useState(false);
    const [task, setTask] = useState(createEmptyTask());

    const { currentWorkspace } = useWorkspace();
    const { activeProjectId } = useActiveProject();
    const defaultPriority = useDefaultPriority();

    useEffect(() => {
        setTask((prev) => (isPristineTask(prev) ? createEmptyTask(defaultPriority) : prev));
    }, [defaultPriority]);

    const refresh = useCallback(async () => {
        try {
            const { data } = await fetchTodos();
            setTodos(data ?? []);
            setAccessError(null);
        } catch (e) {
            // 401만 로그아웃. 403은 토큰이 유효하므로 세션을 유지하고 안내만 한다.
            const forbidden = resolveListFetchError(e, { nav, context: "보드 목록 조회 실패" });
            setAccessError(forbidden);
            if (forbidden) setTodos([]);
        } finally {
            setLoaded(true); // 실패해도 로딩은 끝 — 빈 상태 대신 오류 안내가 떠야 한다
        }
    }, [nav]);

    // 탭 복귀 시 조용히 재조회 — 소켓이 끊겼던 동안의 변경을 메운다
    useRefetchOnFocus(refresh);


    useEffect(() => {
        setLoaded(false); // 워크스페이스 전환 시 이전 목록/빈 상태가 스치지 않게
        refresh();
    }, [currentWorkspace?.workspaceId, refresh]);

    useEffect(() => {
        const handleTodoAdded = (e) => {
            const newTodo = e.detail;
            if (newTodo) {
                // 이미 같은 id가 있으면 추가하지 않음 (자체 dispatchEvent 중복 방지)
                setTodos((prev) =>
                    prev.some((t) => t.id === newTodo.id) ? prev : [newTodo, ...prev]
                );
            } else {
                refresh();
            }
        };
        window.addEventListener(APP_EVENTS.TODO_ADDED, handleTodoAdded);
        return () => window.removeEventListener(APP_EVENTS.TODO_ADDED, handleTodoAdded);
    }, [refresh]);

    useEffect(() => {
        const handleTodoUpdated = (e) => {
            const { id, patch, archived } = e.detail ?? {};
            if (id && archived) {
                setTodos((prev) => prev.filter((t) => t.id !== id));
            } else if (id && patch) {
                setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
            } else {
                refresh();
            }
        };
        window.addEventListener(APP_EVENTS.TODO_UPDATED, handleTodoUpdated);
        return () => window.removeEventListener(APP_EVENTS.TODO_UPDATED, handleTodoUpdated);
    }, [refresh]);

    const {
        deleteOpen,
        setDeleteOpen,
        deleteTarget,
        setDeleteTarget,
        errorOpen,
        setErrorOpen,
        errorMessage,
        requestDelete,
        confirmDelete: handleConfirmDelete,
    } = useConfirmDelete({ onAfterDelete: refresh });

    // 서브태스크 정리: parentId가 있고 그 부모가 목록에 있으면 최상위에서 제외
    // (부모가 목록에 없으면 — 완료/보관 등 — 고아 방지 위해 단독 표시 허용).
    // 내부 state(todos)는 전체 유지 → optimistic update·이벤트 patch는 그대로 동작.
    const visibleTodos = useMemo(() => {
        const ids = new Set(todos.map((t) => t.id));
        return todos.filter((t) => t.parentId == null || !ids.has(t.parentId));
    }, [todos]);

    const openTodoDetail = useOpenTodoDetail();

    const openRightDetail = useCallback(
        async (id) => {
            await openTodoDetail(id, {
                onDelete: async (todoId) => {
                    await deleteTodo(todoId);
                    await refresh();
                },
                onPatchLocal: (patch) => {
                    setTodos((prev) =>
                        prev.map((todo) => (todo.id === id ? { ...todo, ...patch } : todo))
                    );
                },
            });
        },
        [openTodoDetail, refresh]
    );

    const openAddModal = useCallback(() => {
        setTask(createEmptyTask(defaultPriority, "TODO"));
        setOpen(true);
    }, [defaultPriority]);

    const openAddModalWithStatus = useCallback(
        (status = "TODO") => {
            setTask(createEmptyTask(defaultPriority, status));
            setOpen(true);
        },
        [defaultPriority]
    );

    const handleAdd = useCallback(async () => {
        if (!task.title.trim()) return null;
        try {
            // 소속: 폼 선택값(projectScope) > 현재 스코프 > 인박스(null) — payload projectId로 전송
            const { projectScope, ...payload } = task;
            const scope = projectScope ?? (typeof activeProjectId === "number" ? activeProjectId : "inbox");
            const projectId = scope === "inbox" ? null : scope;
            const { data } = await addTodo({ ...payload, projectId, status: payload.status || "TODO" });
            window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
            if (data) {
                setTodos((prev) => [data, ...(prev ?? [])]);
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_ADDED, { detail: data }));
            } else {
                await refresh();
                window.dispatchEvent(new Event(APP_EVENTS.TODO_ADDED));
            }
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "작업이 추가됐어요.", severity: "success" } }));
            setTask(createEmptyTask(defaultPriority, "TODO"));
            setOpen(false);
            return data?.id ?? null;
        } catch (e) {
            console.error("작업 추가 실패", e);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "작업 추가 중 오류가 발생했어요.", severity: "error" } }));
            return null;
        }
    }, [task, refresh, defaultPriority, activeProjectId]);

    const moveToStatus = useCallback(
        async (todoId, nextStatus) => {
            if (!todoId || !nextStatus) return;
            setTodos((prev) =>
                prev.map((todo) =>
                    todo.id === todoId ? { ...todo, status: nextStatus } : todo
                )
            );
            try {
                const { updateTodoField } = await import("../api/todoApi.js");
                await updateTodoField(todoId, "status", nextStatus);
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todoId, patch: { status: nextStatus } } }));
                window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
            } catch (err) {
                await refresh();
                window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                    detail: {
                        message: err?.response?.data?.message || "상태 변경 중 오류가 발생했어요.",
                        severity: "error",
                    },
                }));
            }
        },
        [refresh]
    );

    const onDrop = useCallback(
        (e, nextStatus) => {
            const todoId = Number(e.dataTransfer.getData("todoId"));
            moveToStatus(todoId, nextStatus);
        },
        [moveToStatus]
    );

    const onDropByTouch = useCallback(
        (todoId, nextStatus) => {
            moveToStatus(Number(todoId), nextStatus);
        },
        [moveToStatus]
    );

    return {
        todos: visibleTodos,
        setTodos,
        loaded,
        accessError,
        open,
        setOpen,
        openAddModal,
        openAddModalWithStatus,
        task,
        setTask,
        handleAdd,
        deleteOpen,
        setDeleteOpen,
        deleteTarget,
        setDeleteTarget,
        errorOpen,
        setErrorOpen,
        errorMessage,
        refresh,
        onDrop,
        onDropByTouch,
        requestDelete,
        handleConfirmDelete,
        openRightDetail,
    };
}
