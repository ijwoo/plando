import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { addTodo, deleteTodo, fetchTodos } from "../../todo/api/todoApi.js";
import { resolveListFetchError } from "../../../shared/utils/apiAuthError.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";
import { createEmptyTask, isPristineTask } from "../../todo/utils/createEmptyTask.js";
import { useDefaultPriority } from "../../todo/hooks/useDefaultPriority.js";
import { useConfirmDelete } from "../../todo/hooks/useConfirmDelete.js";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import { useRefetchOnFocus } from "../../../shared/hooks/useRefetchOnFocus.js";

export default function useTaskListData({ nav }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    // 403(워크스페이스 접근 권한 없음) 안내 — 로그아웃 대신 화면에 배너로 노출
    const [accessError, setAccessError] = useState(null);
    const [openAdd, setOpenAdd] = useState(false);
    const [task, setTask] = useState(createEmptyTask());

    const { currentWorkspace } = useWorkspace();
    const { activeProjectId } = useActiveProject();
    const defaultPriority = useDefaultPriority();

    useEffect(() => {
        setTask((prev) => (isPristineTask(prev) ? createEmptyTask(defaultPriority) : prev));
    }, [defaultPriority]);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await fetchTodos();
            setRows(data ?? []);
            setAccessError(null);
        } catch (e) {
            // 401만 로그아웃. 403은 토큰이 유효하므로 세션을 유지하고 안내만 한다.
            const forbidden = resolveListFetchError(e, { nav, context: "할 일 목록 조회 실패" });
            setAccessError(forbidden);
            if (forbidden) setRows([]);
        } finally {
            setLoading(false);
        }
    }, [nav]);

        // 탭 복귀 시 조용히 재조회 — 소켓이 끊겼던 동안의 변경을 메운다
    useRefetchOnFocus(refresh);

useEffect(() => {
        refresh();
    }, [currentWorkspace?.workspaceId, refresh]);

    useEffect(() => {
        const handleTodoAdded = (e) => {
            const newTodo = e.detail;
            if (newTodo) {
                setRows((prev) => {
                    if ((prev ?? []).some((r) => r.id === newTodo.id)) return prev ?? [];
                    return [newTodo, ...(prev ?? [])];
                });
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
                setRows((prev) => prev.filter((r) => r.id !== id));
            } else if (id && patch) {
                setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
            } else if (id) {
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
        requestDelete: askDelete,
        confirmDelete,
    } = useConfirmDelete({ onAfterDelete: refresh });

    // 서브태스크 정리: parentId가 있고 그 부모가 목록에 있으면 최상위에서 제외
    // (부모가 없으면 고아 방지 위해 단독 표시). 내부 state(rows)는 전체 유지.
    const visibleRows = useMemo(() => {
        const ids = new Set(rows.map((r) => r.id));
        return rows.filter((r) => r.parentId == null || !ids.has(r.parentId));
    }, [rows]);

    // 부모 id → 서브태스크 배열. 목록 행을 인라인 확장할 때 쓰는 자식 소스.
    // 필터/스코프 적용 전 전체 rows 기준이라, 확장하면 해당 부모의 자식이 전부 보인다.
    const subtasksByParent = useMemo(() => {
        const map = new Map();
        for (const r of rows) {
            if (r.parentId == null) continue;
            const list = map.get(r.parentId);
            if (list) list.push(r);
            else map.set(r.parentId, [r]);
        }
        return map;
    }, [rows]);

    const openTodoDetail = useOpenTodoDetail();

    const openDetail = useCallback(
        async (id) => {
            await openTodoDetail(id, {
                onDelete: async (todoId) => {
                    await deleteTodo(todoId);
                    await refresh();
                },
                onPatchLocal: (patch) => {
                    setRows((prev) =>
                        prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
                    );
                    window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id, patch } }));
                },
            });
        },
        [openTodoDetail, refresh]
    );

    const openAddModal = useCallback(() => {
        setTask(createEmptyTask(defaultPriority));
        setOpenAdd(true);
    }, [defaultPriority]);

    // 낙관 반영 + 이벤트 공통 — 모달/인라인 빠른추가가 함께 사용
    const commitAdded = useCallback(async (data) => {
        window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
        if (data) {
            setRows((prev) => [data, ...(prev ?? [])]);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_ADDED, { detail: data }));
        } else {
            await refresh();
            window.dispatchEvent(new Event(APP_EVENTS.TODO_ADDED));
        }
        window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "작업이 추가됐어요.", severity: "success" } }));
    }, [refresh]);

    const handleAdd = useCallback(async () => {
        if (!task.title.trim()) return null;
        try {
            // 소속: 폼 선택값(projectScope) > 현재 스코프 > 인박스(null) — payload projectId로 전송 (보드 handleAdd와 동일)
            const { projectScope, ...payload } = task;
            const scope = projectScope ?? (typeof activeProjectId === "number" ? activeProjectId : "inbox");
            const projectId = scope === "inbox" ? null : scope;
            const { data } = await addTodo({ ...payload, projectId, status: payload.status || "TODO" });
            await commitAdded(data);
            setTask(createEmptyTask(defaultPriority));
            setOpenAdd(false);
            return data?.id ?? null;
        } catch (e) {
            console.error("작업 추가 실패", e);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "작업 추가 중 오류가 발생했어요.", severity: "error" } }));
            return null;
        }
    }, [task, defaultPriority, commitAdded, activeProjectId]);

    /**
     * 인라인 빠른 추가 — 모달 없이 제목(+담당자/마감/우선순위 옵션)만으로 즉시 생성.
     * 반환: { ok, id } — 입력창이 성공했을 때만 비워지도록 성공 여부를 명시적으로 알린다
     * (id는 서버가 본문을 안 줄 수도 있어 성공 판정에 쓰지 않는다).
     */
    const quickAdd = useCallback(async (title, extras = {}) => {
        const t = (title || "").trim();
        if (!t) return { ok: false, id: null };
        try {
            const { data } = await addTodo({ ...createEmptyTask(defaultPriority), ...extras, title: t, status: "TODO" });
            await commitAdded(data);
            return { ok: true, id: data?.id ?? null };
        } catch (e) {
            console.error("빠른 추가 실패", e);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "작업 추가 중 오류가 발생했어요.", severity: "error" } }));
            return { ok: false, id: null };
        }
    }, [defaultPriority, commitAdded]);

    return {
        rows: visibleRows,
        subtasksByParent,
        setRows,
        loading,
        accessError,
        refresh,
        openAdd,
        setOpenAdd,
        openAddModal,
        task,
        setTask,
        handleAdd,
        quickAdd,
        deleteOpen,
        setDeleteOpen,
        deleteTarget,
        setDeleteTarget,
        errorOpen,
        setErrorOpen,
        errorMessage,
        openDetail,
        askDelete,
        confirmDelete,
    };
}
