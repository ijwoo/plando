import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchTodos } from "../features/todo/api/todoApi.js";
import { useWorkspace } from "../features/workspace/context/WorkspaceContext.jsx";
import { APP_EVENTS } from "../shared/constants/events.js";
import { toDateFromYmd } from "../features/calendar/utils/calendarUtils.js";
import { isSameDay } from "../shared/utils/formatters.js";
import { isAssignedToEmail } from "../shared/utils/assigneeUtils.js";
import { getUser } from "../shared/utils/tokenUtils.js";

const STATUS_DONE = "DONE";
const STATUS_IN_PROGRESS = "IN_PROGRESS";

/**
 * Sidebar 의 카운트 / 진행률 / 스마트 뷰용 가벼운 훅.
 *
 * fetchTodos 한 번 호출 + TODO_* 이벤트 구독으로 sync.
 */
export default function useSidebarCounts() {
    const { currentWorkspace } = useWorkspace();
    const [tasks, setTasks] = useState([]);
    const myEmail = useMemo(() => getUser()?.email || "", []);

    const load = useCallback(() => {
        fetchTodos()
            .then((res) => setTasks(res.data || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!currentWorkspace?.workspaceId) {
            setTasks([]);
            return;
        }
        load();
    }, [currentWorkspace?.workspaceId, load]);

    useEffect(() => {
        const handler = () => load();
        window.addEventListener(APP_EVENTS.TODO_ADDED, handler);
        window.addEventListener(APP_EVENTS.TODO_UPDATED, handler);
        window.addEventListener(APP_EVENTS.TODO_DELETED, handler);
        return () => {
            window.removeEventListener(APP_EVENTS.TODO_ADDED, handler);
            window.removeEventListener(APP_EVENTS.TODO_UPDATED, handler);
            window.removeEventListener(APP_EVENTS.TODO_DELETED, handler);
        };
    }, [load]);

    return useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let pendingTotal = 0;
        let todayTotal = 0;
        let todayDone = 0;
        let todayPending = 0;
        let todayInProgress = 0;
        let overdueCount = 0;
        let mineCount = 0;
        let recurringCount = 0;
        const focused = [];

        for (const t of tasks) {
            const done = t.status === STATUS_DONE;
            if (!done) pendingTotal++;
            if (!done && isAssignedToEmail(t, myEmail)) mineCount++;
            if (!done && (t.hasRecurrence || t.recurrenceSourceId != null)) recurringCount++;
            if (t.focused && !done && !t.archived) focused.push(t);

            if (t.dueDate) {
                const due = toDateFromYmd(t.dueDate);
                if (due) {
                    if (isSameDay(due, today)) {
                        todayTotal++;
                        if (done) todayDone++;
                        else {
                            todayPending++;
                            if (t.status === STATUS_IN_PROGRESS) todayInProgress++;
                        }
                    } else if (!done && due < today) {
                        overdueCount++;
                    }
                }
            }
        }

        // dueDate 오름차순. dueDate 없는 항목은 뒤로.
        focused.sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
        });

        const todayProgress = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

        return {
            pendingTotal,
            todayTotal,
            todayDone,
            todayPending,
            todayInProgress,
            todayProgress,
            overdueCount,
            mineCount,
            recurringCount,
            focusedTasks: focused,
        };
    }, [tasks, myEmail]);
}
