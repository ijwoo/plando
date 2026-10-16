import { useCallback, useEffect, useMemo, useState } from "react";
import { addTodo, fetchTodos, updateTodoField } from "../../todo/api/todoApi.js";
import { getMySettings } from "../../settings/api/settingsApi.js";
import { resolveListFetchError } from "../../../shared/utils/apiAuthError.js";
import {
    addDays,
    toCalendarEvent,
    toYmd,
} from "../utils/calendarUtils.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { createEmptyTask } from "../../todo/utils/createEmptyTask.js";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";
import { useRefetchOnFocus } from "../../../shared/hooks/useRefetchOnFocus.js";

export default function useCalendarData(nav) {
    const [todos, setTodos] = useState([]);
    /* 첫 조회가 끝났는지. todos가 []로 시작하므로 이게 없으면 화면 진입 때마다
       "일정이 없어요" 빈 상태가 한 프레임 번쩍인 뒤 목록이 그려진다. */
    const [loaded, setLoaded] = useState(false);
    // 403(워크스페이스 접근 권한 없음) 안내 — 로그아웃 대신 화면에 배너로 노출
    const [accessError, setAccessError] = useState(null);
    const [openAdd, setOpenAdd] = useState(false);

    const [defaultPriority, setDefaultPriority] = useState("MEDIUM");
    const [task, setTask] = useState(createEmptyTask("MEDIUM"));

    const { currentWorkspace } = useWorkspace();
    const { activeProjectId } = useActiveProject();

    useEffect(() => {
        let mounted = true;

        const fetchSettings = async () => {
            try {
                const res = await getMySettings();
                if (!mounted) return;

                const savedPriority = res.data?.defaultPriority ?? "MEDIUM";
                setDefaultPriority(savedPriority);

                setTask((prev) => {
                    const isPristine =
                        !prev?.title &&
                        !prev?.content &&
                        !prev?.startAt &&
                        !prev?.dueDate &&
                        (!prev?.assignees || prev.assignees.length === 0);

                    if (!isPristine) return prev;
                    return createEmptyTask(savedPriority);
                });
            } catch (e) {
                console.error("설정 조회 실패", e);
                if (mounted) {
                    setDefaultPriority("MEDIUM");
                    setTask((prev) => {
                        const isPristine =
                            !prev?.title &&
                            !prev?.content &&
                            !prev?.startAt &&
                            !prev?.dueDate &&
                            (!prev?.assignees || prev.assignees.length === 0);

                        if (!isPristine) return prev;
                        return createEmptyTask("MEDIUM");
                    });
                }
            }
        };

        fetchSettings();

        return () => {
            mounted = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        try {
            const { data } = await fetchTodos();
            setTodos(data ?? []);
            setAccessError(null);
        } catch (e) {
            // 401만 로그아웃. 403은 토큰이 유효하므로 세션을 유지하고 안내만 한다.
            const forbidden = resolveListFetchError(e, { nav, context: "캘린더 일정 조회 실패" });
            setAccessError(forbidden);
            if (forbidden) setTodos([]);
        } finally {
            setLoaded(true); // 실패해도 로딩은 끝 — 빈 상태 대신 오류 안내가 떠야 한다
        }
    }, [nav]);

    // 탭 복귀 시 조용히 재조회 — 소켓이 끊겼던 동안의 변경을 메운다
    useRefetchOnFocus(refresh);


    // 워크스페이스를 바꾸면 다시 "로딩 중"으로 — 이전 워크스페이스 일정이 남아 보이거나
    // 빈 상태가 번쩍이지 않게 한다.
    useEffect(() => {
        setLoaded(false);
        refresh();
    }, [currentWorkspace?.workspaceId, refresh]);

    useEffect(() => {
        const handleUpdated = (e) => {
            const { id, patch, archived, deleted } = e.detail ?? {};
            if (!id) return;
            if (archived || deleted) {
                setTodos((prev) => prev.filter((t) => t.id !== id));
            } else if (patch) {
                setTodos((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
                );
            } else {
                refresh();
            }
        };
        const handleAdded = () => refresh();

        window.addEventListener(APP_EVENTS.TODO_UPDATED, handleUpdated);
        window.addEventListener(APP_EVENTS.TODO_ADDED, handleAdded);
        return () => {
            window.removeEventListener(APP_EVENTS.TODO_UPDATED, handleUpdated);
            window.removeEventListener(APP_EVENTS.TODO_ADDED, handleAdded);
        };
    }, [refresh]);

    const events = useMemo(
        () => (todos ?? []).map(toCalendarEvent).filter(Boolean),
        [todos]
    );

    const statusCount = useMemo(() => {
        const c = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
        for (const t of todos) c[t.status] = (c[t.status] ?? 0) + 1;
        return c;
    }, [todos]);

    const openAddModal = useCallback(() => {
        setTask(createEmptyTask(defaultPriority));
        setOpenAdd(true);
    }, [defaultPriority]);

    const openAddWithRange = useCallback((startDate, endDateExclusive) => {
        const startYmd = toYmd(startDate);
        const endInclusive = addDays(endDateExclusive, -1);
        const dueYmd = toYmd(endInclusive);

        setTask({
            ...createEmptyTask(defaultPriority),
            startAt: startYmd,
            dueDate: dueYmd,
        });
        setOpenAdd(true);
    }, [defaultPriority]);

    const openAddWithDay = useCallback((clickedDate) => {
        const ymd = toYmd(clickedDate);
        setTask({
            ...createEmptyTask(defaultPriority),
            startAt: ymd,
            dueDate: ymd,
        });
        setOpenAdd(true);
    }, [defaultPriority]);

    const openAddWithTimeSlot = useCallback((start, end) => {
        const ymd = toYmd(start);
        const pad = (n) => String(n).padStart(2, "0");
        const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
        const endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
        setTask({
            ...createEmptyTask(defaultPriority),
            startAt: ymd,
            dueDate: ymd,
            startTime,
            endTime,
            allDay: false,
        });
        setOpenAdd(true);
    }, [defaultPriority]);

    const handleAdd = useCallback(async () => {
        if (!task.title.trim()) return null;

        try {
            // 소속: 폼 선택값(projectScope) > 현재 스코프 > 인박스(null) — payload projectId로 전송
            const { projectScope, ...payload } = task;
            const scope = projectScope ?? (typeof activeProjectId === "number" ? activeProjectId : "inbox");
            const { data } = await addTodo({
                ...payload,
                projectId: scope === "inbox" ? null : scope,
                status: "TODO",
            });

            setTask(createEmptyTask(defaultPriority));
            setOpenAdd(false);
            toast.success("일정이 추가됐어요.");
            await refresh();
            return data?.id ?? null;
        } catch (e) {
            toast.error(getApiError(e, "할일 추가에 실패했어요."));
            return null;
        }
    }, [task, refresh, defaultPriority, activeProjectId]);

    const saveEventRange = useCallback(
        async (event, start, end) => {
            const todo = event?.resource;
            if (!todo?.id) return;

            const pad = (n) => String(n).padStart(2, "0");
            // event.allDay만 신뢰 (자정 시작 timed 이벤트가 잘못 all-day로 분기되어
            // addDays(-1)로 마감일이 전날로 어긋나던 버그 방지).
            const isTimed = !event.allDay;

            if (isTimed) {
                // end가 정확히 자정(=24:00 경계, 다음 날 00:00)이면 그 전날 23:59로 캡
                // (모바일 useTimelineDnD의 23:59 캡과 동일 정책 — 24:00이 다음 날 마감으로
                //  기록되는 것 방지). 자정을 실제로 넘는 멀티데이 시간 이벤트
                // (예: 22:00→익일 01:00)는 잘리지 않고 그대로 보존한다.
                let clampedEnd = end;
                const isMidnightBoundary =
                    end.getHours() === 0 &&
                    end.getMinutes() === 0 &&
                    end.getTime() > start.getTime();
                if (isMidnightBoundary) {
                    clampedEnd = new Date(
                        end.getFullYear(),
                        end.getMonth(),
                        end.getDate() - 1,
                        23,
                        59,
                        0,
                        0,
                    );
                }

                const nextStart = toYmd(start);
                const nextDue = toYmd(clampedEnd);
                const nextStartTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
                const nextEndTime = `${pad(clampedEnd.getHours())}:${pad(clampedEnd.getMinutes())}`;

                setTodos((prev) =>
                    prev.map((t) =>
                        t.id === todo.id
                            ? { ...t, startAt: nextStart, dueDate: nextDue, startTime: nextStartTime, endTime: nextEndTime }
                            : t
                    )
                );

                try {
                    await updateTodoField(todo.id, "startAt", nextStart);
                    await updateTodoField(todo.id, "dueDate", nextDue);
                    await updateTodoField(todo.id, "startTime", nextStartTime);
                    await updateTodoField(todo.id, "endTime", nextEndTime);
                    await refresh();
                } catch (e) {
                    toast.error(getApiError(e, "일정 이동에 실패했어요."));
                    await refresh();
                }
            } else {
                const inclusiveEnd = addDays(end, -1);
                const nextDue = toYmd(inclusiveEnd);
                const hadStartAt = !!todo.startAt;
                const nextStart = hadStartAt ? toYmd(start) : null;

                setTodos((prev) =>
                    prev.map((t) =>
                        t.id === todo.id
                            ? { ...t, ...(hadStartAt && { startAt: nextStart }), dueDate: nextDue }
                            : t
                    )
                );

                try {
                    if (hadStartAt) {
                        await updateTodoField(todo.id, "startAt", nextStart);
                    }
                    await updateTodoField(todo.id, "dueDate", nextDue);
                    await refresh();
                } catch (e) {
                    toast.error(getApiError(e, "일정 이동에 실패했어요."));
                    await refresh();
                }
            }
        },
        [refresh]
    );

    return {
        todos,
        setTodos,
        loaded,
        accessError,
        events,
        statusCount,
        refresh,
        openAdd,
        openAddModal,
        setOpenAdd,
        task,
        setTask,
        handleAdd,
        openAddWithRange,
        openAddWithDay,
        openAddWithTimeSlot,
        saveEventRange,
    };
}