import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Box } from "@mui/material";
import moment from "moment";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import CloseFullscreenRoundedIcon from "@mui/icons-material/CloseFullscreenRounded";

import AddTodoModal from "../../todo/components/form/AddTodoModal.jsx";
import MobileFab from "../../../shared/ui/common/MobileFab.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { useLayout } from "../../../layouts/LayoutContext.jsx";
import ScopeFilterChip from "../components/ScopeFilterChip.jsx";
import { forEachEventDay, clipTimedEventToDay } from "../utils/calendarUtils.js";

import MobileCalendarMonthHeader from "../components/mobile/MobileCalendarMonthHeader.jsx";
import MobileMonthView from "../components/mobile/MobileMonthView.jsx";
import MobileDayView from "../components/mobile/MobileDayView.jsx";
import MobileWeekTimeline from "../components/mobile/MobileWeekTimeline.jsx";
import ViewSegmentControl from "../components/mobile/ViewSegmentControl.jsx";

const VIEW_TABS = [
    { key: "month", label: "월" },
    { key: "week", label: "주" },
    { key: "day", label: "일" },
];

// 풀스크린 토글 시 영역이 그대로 확대/축소되듯 (framer layout) — 주/일 뷰 루트
const MotionBox = motion(Box);
const FS_TRANSITION = { duration: 0.36, ease: [0.32, 0.72, 0, 1] };

// 설정의 "캘린더 기본 보기"를 초기 뷰로 사용 (없으면 월)
const VALID_VIEWS = ["month", "week", "day"];
function initialMobileView() {
    const v = localStorage.getItem("settings.calendarDefaultView");
    return VALID_VIEWS.includes(v) ? v : "month";
}

const EMPTY_EVENTS = [];

export default function CalendarPageMobile({ ctx }) {
    const {
        filteredEvents,
        date,
        setDate,
        selectedDate,
        setSelectedDate,
        // 자정 넘김 감지는 CalendarPage가 단일 소스 (데스크탑도 같이 갱신되어야 해서 위로 올림)
        today,
        showOnlyRecurring,
        setShowOnlyRecurring,
        selectedDateEvents,
        mobileSelectedDateLabel,
        onSelectEvent,
        onEventDrop,
        openAddWithDay,
        openAddWithTimeSlot,
        openAdd,
        setOpenAdd,
        task,
        setTask,
        handleAdd,
        isDark,
    } = ctx;

    const [mobileView, setMobileView] = useState(initialMobileView);

    // ── Day/Week navigation ──
    const goDay = useCallback((offset) => {
        setSelectedDate((prev) => {
            const d = new Date(prev);
            d.setDate(d.getDate() + offset);
            return d;
        });
    }, [setSelectedDate]);

    const [fullscreen, setFullscreen] = useState(false);

    // 풀스크린 = 몰입 모드 — 글로벌 Navbar/바텀네비까지 숨김 (이탈 시 복구)
    const { setImmersive } = useLayout();
    useEffect(() => {
        setImmersive(fullscreen);
        return () => setImmersive(false);
    }, [fullscreen, setImmersive]);

    // ── 세그먼트 컨트롤 + 풀스크린 토글 (모든 뷰 — 월: 그리드 확장+시트 숨김, 주/일: 크롬 숨겨 타임라인 확장) ──
    const segmentControl = (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Press
                as="span"
                onClick={() => setFullscreen((v) => !v)}
                haptic="light"
                pressScale={0.9}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    color: fullscreen ? "var(--plando-primary)" : "var(--plando-text-secondary)",
                }}
                aria-label={fullscreen ? "기본 보기" : "달력 크게 보기"}
            >
                {fullscreen
                    ? <CloseFullscreenRoundedIcon sx={{ fontSize: 18 }} />
                    : <OpenInFullRoundedIcon sx={{ fontSize: 18 }} />}
            </Press>
            <ViewSegmentControl value={mobileView} onChange={setMobileView} options={VIEW_TABS} />
        </Box>
    );

    // 날짜별 이벤트 그룹 (일 뷰의 3패널에서 사용 — 같은 날짜는 같은 array reference 반환)
    // 멀티데이 이벤트는 걸치는 모든 날짜에 포함 (월 뷰의 스팬 규칙과 동일).
    // 자정을 넘는 시간 이벤트는 해당 날짜 구간으로 클리핑해 타임라인에 표시.
    const eventsByDate = useMemo(() => {
        const map = new Map();
        (filteredEvents || []).forEach((ev) => {
            forEachEventDay(ev, (day) => {
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(ev.allDay ? ev : clipTimedEventToDay(ev, day));
            });
        });
        return map;
    }, [filteredEvents]);

    const eventsForDate = useCallback((d) => {
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        return eventsByDate.get(key) || EMPTY_EVENTS;
    }, [eventsByDate]);

    // ── 주 뷰 ──
    if (mobileView === "week") {
        return (
            <MotionBox layout transition={FS_TRANSITION} sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
                <MobileCalendarMonthHeader
                    year={selectedDate.getFullYear()}
                    month={selectedDate.getMonth()}
                    onPrev={() => goDay(-1)}
                    onNext={() => goDay(1)}
                    onToday={() => setSelectedDate(new Date())}
                    isToday={moment(selectedDate).isSame(moment(), "day")}
                    trailing={segmentControl}
                />
                <Box sx={{ display: "flex", justifyContent: "center", py: 0.25, "&:empty": { display: "none" } }}>
                    <ScopeFilterChip />
                </Box>
                <MobileWeekTimeline
                    date={selectedDate}
                    events={filteredEvents}
                    onSelectEvent={onSelectEvent}
                    onSelectDate={(d) => { setSelectedDate(d); setMobileView("day"); }}
                    onChangeDate={setSelectedDate}
                    onEventDrop={onEventDrop}
                    onCreateSlot={openAddWithTimeSlot}
                    isDark={isDark}
                />
                <MobileFab onClick={() => openAddWithDay(selectedDate)} />
                <AddTodoModal open={openAdd} onClose={() => setOpenAdd(false)} task={task} setTask={setTask} onSave={handleAdd} />
            </MotionBox>
        );
    }

    // ── 일 뷰 ──
    if (mobileView === "day") {
        return (
            <MotionBox layout transition={FS_TRANSITION} sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
                <MobileCalendarMonthHeader
                    year={selectedDate.getFullYear()}
                    month={selectedDate.getMonth()}
                    onPrev={() => goDay(-1)}
                    onNext={() => goDay(1)}
                    onToday={() => setSelectedDate(new Date())}
                    isToday={moment(selectedDate).isSame(moment(), "day")}
                    trailing={segmentControl}
                />
                <Box sx={{ display: "flex", justifyContent: "center", py: 0.25, "&:empty": { display: "none" } }}>
                    <ScopeFilterChip />
                </Box>
                <MobileDayView
                    date={selectedDate}
                    events={selectedDateEvents}
                    eventsForDate={eventsForDate}
                    onSelectEvent={onSelectEvent}
                    onEventDrop={onEventDrop}
                    onCreateSlot={openAddWithTimeSlot}
                    onChangeDate={setSelectedDate}
                    isDark={isDark}
                />
                <MobileFab onClick={() => openAddWithDay(selectedDate)} />
                <AddTodoModal open={openAdd} onClose={() => setOpenAdd(false)} task={task} setTask={setTask} onSave={handleAdd} />
            </MotionBox>
        );
    }

    // ── 월 뷰 (기본) ──
    return (
        <>
            <MobileMonthView
                date={date}
                setDate={setDate}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                today={today}
                filteredEvents={filteredEvents}
                selectedDateEvents={selectedDateEvents}
                mobileSelectedDateLabel={mobileSelectedDateLabel}
                showOnlyRecurring={showOnlyRecurring}
                setShowOnlyRecurring={setShowOnlyRecurring}
                onSelectEvent={onSelectEvent}
                segmentControl={segmentControl}
                fullscreen={fullscreen}
                onAddForSelectedDate={() => openAddWithDay(selectedDate)}
                scopeChip={<ScopeFilterChip />}
            />
            <AddTodoModal open={openAdd} onClose={() => setOpenAdd(false)} task={task} setTask={setTask} onSave={handleAdd} />
            {!fullscreen && <MobileFab onClick={() => openAddWithDay(selectedDate)} ariaLabel="일정 추가" />}
        </>
    );
}
