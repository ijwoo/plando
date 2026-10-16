import { useCallback, useEffect, useMemo, useState } from "react";
import {
    fetchTodayTodos,
    fetchHighPriorityTasks,
    fetchOverdueTasks,
    fetchInProgressTasks,
    fetchRecentActivity,
    fetchPeriodTasks,
} from "../api/dashboardApi.js";
import { deleteTodo, fetchTodos } from "../../todo/api/todoApi.js";
import { fetchNotificationsByTypes } from "../../notification/api/notificationsApi.js";
import { fetchWorkspacePresence } from "../api/presenceApi.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import { fetchAllUsers } from "../../../shared/api/userApi.js";
import { toDateFromYmd } from "../../calendar/utils/calendarUtils.js";
// 주(週) 범위는 일요일 시작 고정 (dashboardUtils 공용 헬퍼).
import { isSameDay, getWeekDates, getThisWeekRange, getLastWeekRange } from "../utils/dashboardUtils.js";
import { toYmd } from "../../../shared/utils/formatters.js";
import { isTodoDone } from "../../../shared/utils/todoStatus.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";

function extractAssigneeEmails(task) {
    if (Array.isArray(task.assignees)) {
        return task.assignees.map((a) => (typeof a === "string" ? a : a?.email ?? String(a)));
    }
    if (typeof task.assignees === "string" && task.assignees) {
        return task.assignees.split(",").filter(Boolean);
    }
    return [];
}

export default function useDashboardData() {
    const [allTasks, setAllTasks] = useState([]);
    // 지난주~이번주 dueDate 범위, archived 무관. weekly* / memberStats 계산용.
    const [periodTasks, setPeriodTasks] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [userList, setUserList] = useState([]);
    const [userImageMap, setUserImageMap] = useState({});
    const [todayTodos, setTodayTodos] = useState([]);
    const [highPriority, setHighPriority] = useState([]);
    const [overdueTasks, setOverdueTasks] = useState([]);
    const [inProgressTasks, setInProgressTasks] = useState([]);
    const [assignNotifications, setAssignNotifications] = useState([]);
    const [mentionNotifications, setMentionNotifications] = useState([]);
    const [presenceMap, setPresenceMap] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const { currentWorkspace } = useWorkspace();
    const { categoryOf: statusCategoryOf } = useStatuses();

    // periodTasks 전용 완료 판정.
    //
    // isTodoDone()은 `doneAt`(완료 시각)을 1차 기준으로 쓰는데, /dashboard/period-tasks가
    // 내려주는 PeriodTaskDto에는 doneAt이 없다(id·title·status·priority·dueDate·assignees뿐).
    // 그래서 `status === "DONE"` 폴백으로 떨어져, 워크스페이스가 만든 커스텀 완료 상태
    // ("배포완료" 등)의 할 일이 주간 완료율·멤버 현황에서 미완료로 세어졌고,
    // "이번 주 할 일" 카드에서는 체크가 안 켜진 채로 눌러도 다시 완료로 PATCH돼 해제되지 않았다.
    //
    // 완료 여부는 워크스페이스 상태 정의의 category로도 똑같이 알 수 있으므로(DONE 카테고리
    // = doneAt이 찍히는 상태), 그것으로 판정한다. 알 수 없는 key는 categoryOf가 TODO로
    // 폴백하므로 오탐이 나지 않는다.
    // TODO: 서버가 PeriodTaskDto에 doneAt을 추가하면 isTodoDone() 단독으로 되돌릴 것.
    const isPeriodTaskDone = useCallback(
        (t) => isTodoDone(t) || statusCategoryOf(t?.status) === "DONE",
        [statusCategoryOf]
    );

    const refreshDashboard = useCallback(async () => {
        setIsLoading(true);
        try {
            // 지난주 시작 ~ 이번주 끝 범위 (archived 무관 통계용)
            const { end: thisWeekEnd } = getThisWeekRange();
            const { start: lastWeekStart } = getLastWeekRange();
            const periodFrom = toYmd(lastWeekStart);
            const periodTo = toYmd(thisWeekEnd);

            const results = await Promise.allSettled([
                fetchTodayTodos(),
                fetchHighPriorityTasks(),
                fetchOverdueTasks(),
                fetchInProgressTasks(),
                fetchRecentActivity(),
                fetchAllUsers(),
                fetchTodos(),
                fetchNotificationsByTypes(["TASK_ASSIGNED"], 5),
                fetchNotificationsByTypes(["MENTION"], 5),
                fetchWorkspacePresence(),
                fetchPeriodTasks(periodFrom, periodTo),
            ]);

            const get = (r, fallback = []) =>
                r.status === "fulfilled" ? (r.value.data ?? fallback) : fallback;

            const getObj = (r, fallback = {}) =>
                r.status === "fulfilled" ? (r.value.data ?? fallback) : fallback;

            const [todayRes, highRes, overdueRes, inProgressRes, activityRes, usersRes, allRes, assignRes, mentionRes, presenceRes, periodRes] = results;

            setAllTasks(get(allRes));
            setPeriodTasks(get(periodRes));
            setTodayTodos(get(todayRes));
            setHighPriority(get(highRes));
            setOverdueTasks(get(overdueRes));
            setInProgressTasks(get(inProgressRes));
            setRecentActivity(get(activityRes));
            setAssignNotifications(get(assignRes));
            setMentionNotifications(get(mentionRes));
            setPresenceMap(getObj(presenceRes));

            const userArr = get(usersRes);
            setUserList(userArr);
            const map = {};
            userArr.forEach((u) => {
                if (u.email) map[u.email] = { name: u.name, profileImageUrl: u.profileImageUrl };
            });
            setUserImageMap(map);
        } catch (error) {
            console.error("대시보드 로딩 실패:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!currentWorkspace?.workspaceId) return;
        refreshDashboard();
    }, [currentWorkspace?.workspaceId, refreshDashboard]);

    // STOMP 연결 직후 presence만 빠르게 한 번 더 fetch — 본인이 online으로 보이게
    useEffect(() => {
        const handler = async () => {
            try {
                const { data } = await fetchWorkspacePresence();
                setPresenceMap(data ?? {});
            } catch { /* ignore */ }
        };
        window.addEventListener(APP_EVENTS.STOMP_CONNECTED, handler);
        return () => window.removeEventListener(APP_EVENTS.STOMP_CONNECTED, handler);
    }, []);

    // 다른 사용자의 presence 변경 broadcast → presenceMap에 patch
    useEffect(() => {
        const handler = (e) => {
            const p = e.detail;
            if (!p?.email) return;
            setPresenceMap((prev) => ({
                ...prev,
                [p.email]: { online: !!p.online, lastSeen: p.lastSeen || null },
            }));
        };
        window.addEventListener(APP_EVENTS.PRESENCE_CHANGED, handler);
        return () => window.removeEventListener(APP_EVENTS.PRESENCE_CHANGED, handler);
    }, []);

    useEffect(() => {
        const handler = () => refreshDashboard();
        window.addEventListener(APP_EVENTS.TODO_ADDED, handler);
        window.addEventListener(APP_EVENTS.TODO_UPDATED, handler);
        window.addEventListener(APP_EVENTS.TODO_DELETED, handler);
        return () => {
            window.removeEventListener(APP_EVENTS.TODO_ADDED, handler);
            window.removeEventListener(APP_EVENTS.TODO_UPDATED, handler);
            window.removeEventListener(APP_EVENTS.TODO_DELETED, handler);
        };
    }, [refreshDashboard]);

    const openTodoDetail = useOpenTodoDetail();

    const openTaskDetail = useCallback(
        async (id) => {
            await openTodoDetail(id, {
                onDelete: async (todoId) => {
                    await deleteTodo(todoId);
                    await refreshDashboard();
                },
                onPatchLocal: (patch) => {
                    const apply = (tasks) =>
                        tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
                    setAllTasks((prev) => apply(prev));
                    setPeriodTasks((prev) => apply(prev));
                    setTodayTodos((prev) => apply(prev));
                    setHighPriority((prev) => apply(prev));
                    setOverdueTasks((prev) => apply(prev));
                    setInProgressTasks((prev) => apply(prev));
                },
            });
        },
        [openTodoDetail, refreshDashboard]
    );

    // ── 파생 계산 (Desktop / Mobile 모두 사용) ──────────────────
    // 양쪽에 중복 정의되어 있던 useMemo를 hook 내부로 통합.

    // weekly* / memberStats / today*Count 는 archived 무관 periodTasks 기반.
    // 자동 아카이브된 완료 항목도 통계에 살아 있어 사용자가 보상감을 잃지 않도록 함.

    const weeklyTasks = useMemo(() => {
        const { start, end } = getThisWeekRange();
        return periodTasks.filter((t) => {
            if (!t.dueDate) return false;
            const due = toDateFromYmd(t.dueDate);
            return due >= start && due <= end;
        });
    }, [periodTasks]);

    const weeklyCompletionRate = useMemo(() => {
        if (weeklyTasks.length === 0) return 0;
        const done = weeklyTasks.filter((t) => isPeriodTaskDone(t)).length;
        return Math.round((done / weeklyTasks.length) * 100);
    }, [weeklyTasks, isPeriodTaskDone]);

    const weeklyDelta = useMemo(() => {
        const { start, end } = getLastWeekRange();
        const lastWeekTasks = periodTasks.filter((t) => {
            if (!t.dueDate) return false;
            const due = toDateFromYmd(t.dueDate);
            return due >= start && due <= end;
        });
        if (lastWeekTasks.length === 0) return 0;
        const lastRate = Math.round(
            (lastWeekTasks.filter((t) => isPeriodTaskDone(t)).length / lastWeekTasks.length) * 100
        );
        return weeklyCompletionRate - lastRate;
    }, [periodTasks, weeklyCompletionRate, isPeriodTaskDone]);

    const weeklyBarData = useMemo(() => {
        return getWeekDates(new Date()).map((d) => {
            const dayTasks = periodTasks.filter((t) => t.dueDate && isSameDay(toDateFromYmd(t.dueDate), d));
            return {
                date: d,
                done: dayTasks.filter((t) => isPeriodTaskDone(t)).length,
                total: dayTasks.length,
            };
        });
    }, [periodTasks, isPeriodTaskDone]);

    // 오늘 마감(시작 전) 개수 — IN_PROGRESS는 todayInProgressCount에서 따로 세므로 제외.
    // (todayDue/todayInProgress/todayDone 세 카운트가 서로소가 되어 합계=오늘 전체가 됨)
    const todayDueCount = useMemo(() => {
        const today = new Date();
        return periodTasks.filter((t) => {
            // 커스텀 상태를 쓰는 워크스페이스에선 "IN_PROGRESS" 키가 없을 수 있다.
            // 문자열로 비교하면 진행 중인 항목이 '오늘 마감'으로 잘못 분류된다.
            if (!t.dueDate || isPeriodTaskDone(t) || statusCategoryOf(t.status) === "IN_PROGRESS") return false;
            return isSameDay(toDateFromYmd(t.dueDate), today);
        }).length;
    }, [periodTasks, isPeriodTaskDone]);

    const todayInProgressCount = useMemo(() => {
        const today = new Date();
        return periodTasks.filter((t) => {
            if (!t.dueDate || statusCategoryOf(t.status) !== "IN_PROGRESS") return false;
            return isSameDay(toDateFromYmd(t.dueDate), today);
        }).length;
    }, [periodTasks]);

    const todayDoneCount = useMemo(() => {
        const today = new Date();
        return periodTasks.filter((t) => {
            if (!isPeriodTaskDone(t) || !t.dueDate) return false;
            return isSameDay(toDateFromYmd(t.dueDate), today);
        }).length;
    }, [periodTasks, isPeriodTaskDone]);

    const dDayTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return allTasks
            .filter((t) => t.dueDate && !isTodoDone(t))
            .map((t) => {
                const due = toDateFromYmd(t.dueDate);
                return { ...t, dDiff: Math.round((due - today) / 86400000) };
            })
            .sort((a, b) => a.dDiff - b.dDiff)
            .slice(0, 4);
    }, [allTasks]);

    const memberStats = useMemo(() => {
        const { start, end } = getThisWeekRange();
        const stats = {};

        // 전체 멤버 우선 초기화 (태스크 없는 신규 멤버도 0%로 표시)
        userList.forEach((u) => {
            if (!u.email) return;
            stats[u.email] = {
                email: u.email,
                name: u.name || u.email.split("@")[0],
                total: 0,
                done: 0,
            };
        });

        periodTasks.forEach((task) => {
            if (!task.dueDate) return;
            const due = toDateFromYmd(task.dueDate);
            if (due < start || due > end) return;

            extractAssigneeEmails(task).forEach((email) => {
                if (!stats[email]) {
                    const info = userImageMap[email];
                    stats[email] = { email, name: info?.name || email.split("@")[0], total: 0, done: 0 };
                }
                stats[email].total++;
                if (isPeriodTaskDone(task)) stats[email].done++;
            });
        });

        return Object.values(stats)
            .map((s) => ({ ...s, rate: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0 }))
            .sort((a, b) => b.rate - a.rate);
    }, [periodTasks, userList, userImageMap, isPeriodTaskDone]);

    return {
        allTasks,
        recentActivity,
        userList,
        userImageMap,
        todayTodos,
        highPriority,
        overdueTasks,
        inProgressTasks,
        assignNotifications,
        mentionNotifications,
        presenceMap,
        isLoading,
        refreshDashboard,
        openTaskDetail,
        // ── 파생 ──
        // weeklyTasks는 periodTasks(doneAt 없음)에서 나오므로 완료 판정도 같이 내보낸다.
        isPeriodTaskDone,
        weeklyTasks,
        weeklyCompletionRate,
        weeklyDelta,
        weeklyBarData,
        todayDueCount,
        todayInProgressCount,
        todayDoneCount,
        dDayTasks,
        memberStats,
    };
}
