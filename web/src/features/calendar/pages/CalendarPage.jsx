import React, { useCallback, useEffect, useMemo, useState } from "react";
import { momentLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import moment from "moment";
import "moment/locale/ko";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTodayTick } from "../../../shared/hooks/useTodayTick.js";

import { useNavigate, useLocation } from "react-router-dom";

import { deleteTodo } from "../../todo/api/todoApi.js";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";

import useCalendarData from "../hooks/useCalendarData.js";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";
import { usePageRefresh } from "../../../shared/hooks/usePageRefresh.js";
import { getCalendarSx } from "../utils/calendarSx.js";
import { getCalendarEventProps, getCalendarDayProps } from "../utils/calendarStyleProps.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { getCalendarFormats } from "../utils/calendarUtils.js";

import CalendarPageMobile from "./CalendarPageMobile.jsx";
import CalendarPageDesktop from "./CalendarPageDesktop.jsx";
import AccessErrorBanner from "../../../shared/ui/common/AccessErrorBanner.jsx";

moment.locale("ko");

// moment의 ko 로케일은 기본이 일요일 시작(dow: 0)이라 별도 override가 필요 없다.
// 미니 달력·모바일 그리드(weekStart.js)와 동일하게 항상 일요일 시작.
const localizer = momentLocalizer(moment);

const calendarMessages = {
    date: "날짜",
    time: "시간",
    event: "일정",
    allDay: "하루 종일",
    week: "주",
    work_week: "업무 주",
    day: "일",
    month: "월",
    previous: "이전",
    next: "다음",
    yesterday: "어제",
    tomorrow: "내일",
    today: "오늘",
    agenda: "목록",
    noEventsInRange: "이 기간에 일정이 없습니다",
    showMore: (total) => `+${total}개 더보기`,
};

const calendarFormats = getCalendarFormats();

export default function CalendarPage() {
    const theme = useTheme();
    const { toneOf: statusToneOf } = useStatuses();
    const isDark = theme.palette.mode === "dark";
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const nav = useNavigate();
    const location = useLocation();
    const initialDate = location.state?.date ? new Date(location.state.date) : new Date();
    const [view, setView] = useState(location.state?.date ? "day" : "month");
    const [date, setDate] = useState(initialDate);
    const [selectedDate, setSelectedDate] = useState(initialDate);

    const [showOnlyRecurring, setShowOnlyRecurring] = useState(false);
    const { matchesActiveProject } = useActiveProject();

    // 자정 넘김 감지 — 구현은 shared/hooks/useTodayTick 에 하나만 둔다.
    // 예전엔 이 로직이 캘린더에 인라인으로 들어 있어 홈 화면에는 없었고, 그래서 홈의
    // 미니 달력·날짜 문구는 자정을 넘겨도 어제에 머물렀다. 한 벌만 유지한다.
    const today = useTodayTick();

    // 사이드바 캘린더 패널(다가오는 일정)에서 /calendar로 날짜를 넘겨 점프 — 이미 캘린더 페이지에 있을 때도 반영
    useEffect(() => {
        const d = location.state?.date;
        if (!d) return;
        const nd = new Date(d);
        if (Number.isNaN(nd.getTime())) return;
        setDate(nd);
        setSelectedDate(nd);
        setView("day");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    const {
        setTodos,
        events,
        statusCount,
        refresh,
        openAdd,
        setOpenAdd,
        task,
        setTask,
        handleAdd,
        openAddWithRange,
        openAddWithDay,
        openAddWithTimeSlot,
        saveEventRange,
        accessError,
        loaded,
    } = useCalendarData(nav);

    const filteredEvents = useMemo(
        () => {
            // 상단 네비 글로벌 프로젝트 필터 (event.resource = todo)
            let list = events.filter((e) => matchesActiveProject(e.resource ?? {}));
            if (showOnlyRecurring) {
                list = list.filter((e) => e.resource?.hasRecurrence || e.resource?.recurrenceSourceId);
            }
            return list;
        },
        [events, showOnlyRecurring, matchesActiveProject]
    );

    usePageRefresh(refresh);

    const firstEventId = useMemo(() => events?.[0]?.id ?? null, [events]);

    const openTodoDetail = useOpenTodoDetail();

    const onSelectEvent = useCallback(
        async (event) => {
            const todo = event?.resource;
            if (!todo?.id) return;
            await openTodoDetail(todo.id, {
                onDelete: async (todoId) => {
                    await deleteTodo(todoId);
                    await refresh();
                },
                onPatchLocal: (patch) => {
                    setTodos((prev) =>
                        prev.map((t) => (t.id === todo.id ? { ...t, ...patch } : t))
                    );
                },
            });
        },
        [openTodoDetail, refresh, setTodos]
    );

    const onSelectSlot = useCallback(
        ({ start, end, action }) => {
            if (!start || !end) return;

            setSelectedDate(start);

            // "전 종일" 선택(=월 뷰 드래그/클릭)인지 판별. start뿐 아니라 end도 자정이어야 함.
            // (주/일 뷰의 시간 그리드 드래그는 start가 00:00이어도 end는 자정이 아님 — 예: 00:00 → 02:00.
            //  start만 검사하면 자정에서 시작하는 시간 이벤트가 잘못 all-day로 처리되어 마감일이 전날로 어긋남)
            const isAllDayRange =
                start.getHours() === 0 && start.getMinutes() === 0 &&
                end.getHours() === 0 && end.getMinutes() === 0;

            if (action === "click") {
                if (!isAllDayRange) {
                    openAddWithTimeSlot(start, end);
                    return;
                }
                openAddWithDay(start);
                return;
            }

            if (!isAllDayRange) {
                openAddWithTimeSlot(start, end);
                return;
            }
            openAddWithRange(start, end);
        },
        [openAddWithDay, openAddWithRange, openAddWithTimeSlot]
    );

    const onDrillDown = useCallback(
        (date) => {
            setSelectedDate(date);
        },
        []
    );

    // 보이는 달(monthDate)에 오늘이 포함되면 오늘, 아니면 1일을 선택 날짜로.
    // (모바일 MobileMonthView.animateMonthChange와 동일한 정책)
    const syncSelectedToMonth = useCallback((monthDate) => {
        const t = new Date();
        if (
            t.getFullYear() === monthDate.getFullYear() &&
            t.getMonth() === monthDate.getMonth()
        ) {
            return t;
        }
        return new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    }, []);

    // react-big-calendar 네비게이션. 월 뷰는 선택 날짜를 새 달로 동기화하고,
    // 주/일 뷰는 포커스된 날짜(nextDate)를 그대로 선택 날짜로 사용한다.
    // (월 변경 후 selectedDate가 이전 달에 남아 우측 패널이 엉뚱한 날짜의
    //  일정을 보여주던 문제 방지)
    const onNavigate = useCallback(
        (nextDate) => {
            setDate(nextDate);
            setSelectedDate(view === "month" ? syncSelectedToMonth(nextDate) : nextDate);
        },
        [view, syncSelectedToMonth]
    );

    // 미니 달력 이전/다음(항상 월 단위) — date와 selectedDate를 함께 갱신.
    const onNavigateMonth = useCallback(
        (delta) => {
            const next = new Date(date.getFullYear(), date.getMonth() + delta, 1);
            setDate(next);
            setSelectedDate(syncSelectedToMonth(next));
        },
        [date, syncSelectedToMonth]
    );

    const onEventDrop = useCallback(
        async ({ event, start, end }) => {
            await saveEventRange(event, start, end);
        },
        [saveEventRange]
    );

    const onEventResize = useCallback(
        async ({ event, start, end }) => {
            await saveEventRange(event, start, end);
        },
        [saveEventRange]
    );

    // 이벤트 색은 StatusContext가 단일 소스 — 커스텀 상태의 사용자 지정 색까지 그대로 반영된다.
    // (예전엔 calendarStyleProps가 자체 색 맵을 들고 있어 커스텀 상태가 전부 빨강이었다)
    const resolveTone = useCallback((key) => statusToneOf(theme, key), [statusToneOf, theme]);

    const eventPropGetter = useCallback(
        (event) => getCalendarEventProps(event, resolveTone),
        [resolveTone]
    );

    const dayPropGetter = useCallback(
        (dateValue) => getCalendarDayProps(dateValue, theme),
        [theme]
    );

    const calendarSx = useMemo(
        () => getCalendarSx(isDark, isMobile),
        [isDark, isMobile]
    );

    const views = isMobile ? ["month"] : ["month", "week", "day", "agenda"];
    const currentView = isMobile ? "month" : view;

    const selectedDateEvents = useMemo(() => {
        return (filteredEvents ?? []).filter((event) => {
            const selected = moment(selectedDate).startOf("day");
            const start = moment(event.start);
            let end = event.end ? moment(event.end) : moment(event.start);

            if (
                end.format("HH:mm:ss") === "00:00:00" &&
                !start.isSame(end, "day")
            ) {
                end = end.clone().subtract(1, "minute");
            }

            const startDay = start.clone().startOf("day");
            const endDay = end.clone().startOf("day");

            return (
                selected.isSame(startDay, "day") ||
                selected.isSame(endDay, "day") ||
                (selected.isAfter(startDay, "day") && selected.isBefore(endDay, "day"))
            );
        });
    }, [filteredEvents, selectedDate]);

    const mobileSelectedDateLabel = useMemo(() => {
        return moment(selectedDate).format("M월 D일");
    }, [selectedDate]);

    const ctx = {
        isDark, filteredEvents, loaded, firstEventId, calendarSx,
        currentView, views, date, setDate, selectedDate, setSelectedDate, today,
        showOnlyRecurring, setShowOnlyRecurring,
        selectedDateEvents, mobileSelectedDateLabel,
        statusCount,
        onSelectEvent, onSelectSlot, onDrillDown, onNavigate, onNavigateMonth, onEventDrop, onEventResize,
        eventPropGetter, dayPropGetter,
        openAddWithDay, openAddWithRange, openAddWithTimeSlot,
        openAdd, setOpenAdd, task, setTask, handleAdd,
        setView,
        localizer, calendarMessages, calendarFormats,
    };

    return (
        <>
            {/* 403 — 세션은 유지하고 안내만 (워크스페이스 전환으로 복구) */}
            <AccessErrorBanner message={accessError} />
            {isMobile ? <CalendarPageMobile ctx={ctx} /> : <CalendarPageDesktop ctx={ctx} />}
        </>
    );
}
