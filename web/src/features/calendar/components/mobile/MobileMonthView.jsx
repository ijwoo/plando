import React, { useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import { Box, Chip, Stack, Typography, SwipeableDrawer } from "@mui/material";
import { hideScrollbarSx } from "../../../../shared/ui/glassSx.js";
import RepeatIcon from "@mui/icons-material/Repeat";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import moment from "moment";

import { isSameDay } from "../../utils/calendarUtils.js";
import { weekdayHeader } from "../../utils/weekStart.js";
import MobileCalendarMonthGrid from "./MobileCalendarMonthGrid.jsx";
import MobileCalendarMonthHeader from "./MobileCalendarMonthHeader.jsx";
import MobileCalendarEventCard from "./MobileCalendarEventCard.jsx";
import { Z } from "../../../../shared/ui/zIndex.js";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
// 풀스크린 전환 시 캘린더 영역이 "그 자리에서 확대되듯" — framer layout 애니메이션
const MotionBox = motion(Box);
const EXPANDED_TOP = 56;
const WK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const EMPTY_TEXT = "이 날은 일정이 없어요";

/**
 * 모바일 월 뷰 — 3패널 스와이프 + 바텀시트.
 * 월 뷰 전용 상태/핸들러를 모두 캡슐화.
 *
 * @param {{
 *   date: Date,
 *   setDate: (d: Date) => void,
 *   selectedDate: Date,
 *   setSelectedDate: (d: Date | ((prev: Date) => Date)) => void,
 *   today: Date,
 *   filteredEvents: any[],
 *   selectedDateEvents: any[],
 *   mobileSelectedDateLabel: string,
 *   showOnlyRecurring: boolean,
 *   setShowOnlyRecurring: (v: boolean | ((prev: boolean) => boolean)) => void,
 *   onSelectEvent: (ev: any) => void,
 *   segmentControl: React.ReactNode,
 *   isDark: boolean,
 * }} props
 */
export default function MobileMonthView({
    date, setDate,
    selectedDate, setSelectedDate,
    today,
    filteredEvents, selectedDateEvents,
    mobileSelectedDateLabel,
    showOnlyRecurring, setShowOnlyRecurring,
    onSelectEvent,
    segmentControl,
    fullscreen = false,        // 풀스크린 — 시트 숨김 + 그리드가 화면을 채움 (셀에 일정 라벨, 날짜 탭=오버레이 시트)
    onAddForSelectedDate,      // 풀스크린 오버레이 시트의 "일정 추가" (FAB이 숨어 있는 동안의 추가 동선)
    scopeChip = null,          // 스코프 표시 칩 (조용한 필터링 방지 — 헤더 아래 노출)
}) {
    const year = date.getFullYear();
    const month = date.getMonth();

    const prevDate = useMemo(() => new Date(year, month - 1, 1), [year, month]);
    const nextDate = useMemo(() => new Date(year, month + 1, 1), [year, month]);

    const containerRef = useRef(null);
    const calendarRef = useRef(null);
    const trackRef = useRef(null);
    const sheetRef = useRef(null);
    const agendaRef = useRef(null);

    const [expanded, setExpanded] = useState(false);
    const [collapsedTop, setCollapsedTop] = useState(350);
    const [pendingSelection, setPendingSelection] = useState(null);
    const dragRef = useRef({ active: false, startY: 0, startTop: 0 });
    const agendaDragRef = useRef(null);
    const isAnimatingRef = useRef(false);
    const needsResetRef = useRef(false);

    // ── Track reset after month change ──
    useLayoutEffect(() => {
        if (needsResetRef.current && trackRef.current) {
            trackRef.current.style.transition = "none";
            trackRef.current.style.transform = "translateX(-100%)";
            needsResetRef.current = false;
        }
    }, [year, month]);

    const setTrackRef = useCallback((node) => {
        trackRef.current = node;
        if (node) {
            node.style.transition = "none";
            node.style.transform = "translateX(-100%)";
        }
    }, []);

    // ── Measure calendar area ──
    useEffect(() => {
        const measure = () => {
            if (calendarRef.current) {
                setCollapsedTop(calendarRef.current.getBoundingClientRect().height);
            }
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (calendarRef.current) ro.observe(calendarRef.current);
        return () => ro.disconnect();
    }, [year, month]);

    useEffect(() => {
        if (sheetRef.current && !dragRef.current.active) {
            const top = expanded ? EXPANDED_TOP : collapsedTop;
            sheetRef.current.style.top = `${top}px`;
        }
    }, [collapsedTop, expanded]);

    // ── Month animation ──
    const animateMonthChange = useCallback((dir) => {
        if (isAnimatingRef.current) return;
        isAnimatingRef.current = true;

        const track = trackRef.current;
        if (!track) { isAnimatingRef.current = false; return; }

        const newDate = new Date(year, month + dir, 1);
        const newYear = newDate.getFullYear();
        const newMonth = newDate.getMonth();
        const newSelected = (today.getFullYear() === newYear && today.getMonth() === newMonth)
            ? today
            : newDate;

        flushSync(() => { setPendingSelection({ dir, date: newSelected }); });

        track.style.transition = `transform 0.34s ${EASE}`;
        track.style.transform = `translateX(${dir > 0 ? "-200%" : "0%"})`;

        setTimeout(() => {
            needsResetRef.current = true;
            flushSync(() => {
                setPendingSelection(null);
                setSelectedDate(newSelected);
                setDate(newDate);
            });
            isAnimatingRef.current = false;
        }, 340);
    }, [year, month, today, setDate, setSelectedDate]);

    // ── Sheet snap ──
    const snapTo = useCallback((toExpanded) => {
        setExpanded(toExpanded);
        const sheet = sheetRef.current;
        const cal = calendarRef.current;
        if (!sheet) return;

        const top = toExpanded ? EXPANDED_TOP : collapsedTop;
        sheet.style.transition = `top 0.42s ${EASE}`;
        sheet.style.top = `${top}px`;

        if (cal) {
            cal.style.transition = "opacity 0.35s, transform 0.35s";
            cal.style.opacity = toExpanded ? "0.25" : "1";
            cal.style.transform = toExpanded ? "scale(0.97)" : "scale(1)";
        }
    }, [collapsedTop]);

    // ── Drag handlers ──
    const handleDragStart = useCallback((clientY) => {
        const sheet = sheetRef.current;
        if (!sheet) return;
        dragRef.current = {
            active: true,
            startY: clientY,
            startTop: parseFloat(sheet.style.top) || collapsedTop,
        };
        sheet.style.transition = "none";
        if (agendaRef.current) agendaRef.current.style.overflowY = "hidden";
    }, [collapsedTop]);

    const handleDragMove = useCallback((clientY) => {
        if (!dragRef.current.active) return;
        const dy = clientY - dragRef.current.startY;
        let nt = dragRef.current.startTop + dy;
        nt = Math.max(EXPANDED_TOP, Math.min(collapsedTop, nt));

        const sheet = sheetRef.current;
        const cal = calendarRef.current;
        if (sheet) sheet.style.top = `${nt}px`;

        if (cal) {
            const prog = (collapsedTop - nt) / (collapsedTop - EXPANDED_TOP);
            cal.style.transition = "none";
            cal.style.opacity = String(1 - prog * 0.75);
            cal.style.transform = `scale(${1 - prog * 0.03})`;
        }
    }, [collapsedTop]);

    const handleDragEnd = useCallback(() => {
        if (!dragRef.current.active) return;
        dragRef.current.active = false;
        if (agendaRef.current) agendaRef.current.style.overflowY = "";
        const nt = parseFloat(sheetRef.current?.style.top);
        const mid = (collapsedTop + EXPANDED_TOP) / 2;
        snapTo(nt < mid);
    }, [collapsedTop, snapTo]);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragRef.current.active) return;
            handleDragMove(e.touches[0].clientY);
            if (e.cancelable) e.preventDefault();
        };
        const onEnd = () => handleDragEnd();
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onEnd);
        return () => {
            window.removeEventListener("touchmove", onMove);
            window.removeEventListener("touchend", onEnd);
        };
    }, [handleDragMove, handleDragEnd]);

    // ── Scroll to selected date group ──
    useEffect(() => {
        if (!expanded) {
            if (agendaRef.current) agendaRef.current.scrollTop = 0;
            return;
        }
        const timer = setTimeout(() => {
            if (!agendaRef.current) return;
            const key = moment(selectedDate).format("YYYY-MM-DD");
            const group = agendaRef.current.querySelector(`[data-day="${key}"]`);
            if (group) group.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
        return () => clearTimeout(timer);
    }, [expanded, selectedDate]);

    // ── Calendar horizontal swipe ──
    const swipeRef = useRef({ sx: 0, sy: 0, mode: null, dx: 0 });
    const onCalSwipeStart = (e) => {
        if (isAnimatingRef.current) return;
        swipeRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, mode: null, dx: 0 };
        if (trackRef.current) trackRef.current.style.transition = "none";
    };
    const onCalSwipeMove = (e) => {
        if (isAnimatingRef.current) return;
        const s = swipeRef.current;
        const dx = e.touches[0].clientX - s.sx;
        const dy = e.touches[0].clientY - s.sy;
        if (s.mode === null) s.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (s.mode === "h") {
            s.dx = dx;
            if (trackRef.current) {
                trackRef.current.style.transform = `translateX(calc(-100% + ${dx}px))`;
            }
        }
    };
    const onCalSwipeEnd = () => {
        if (isAnimatingRef.current) return;
        const s = swipeRef.current;
        if (s.mode !== "h") return;
        const w = containerRef.current?.clientWidth || 390;
        if (s.dx < -w * 0.22) {
            animateMonthChange(1);
        } else if (s.dx > w * 0.22) {
            animateMonthChange(-1);
        } else if (trackRef.current) {
            trackRef.current.style.transition = `transform 0.25s ${EASE}`;
            trackRef.current.style.transform = "translateX(-100%)";
        }
    };

    // ── Month events grouped ──
    const monthEventsGrouped = useMemo(() => {
        const monthStart = moment([year, month, 1]);
        const monthEnd = monthStart.clone().endOf("month");
        const eventsByDate = {};
        (filteredEvents ?? []).forEach((event) => {
            const start = moment(event.start).startOf("day");
            let end = event.end ? moment(event.end) : moment(event.start);
            if (end.format("HH:mm:ss") === "00:00:00" && !start.isSame(end, "day")) {
                end = end.clone().subtract(1, "minute");
            }
            const endDay = end.startOf("day");
            const cur = start.clone();
            while (cur.isSameOrBefore(endDay, "day")) {
                if (cur.isBetween(monthStart, monthEnd, "day", "[]")) {
                    const key = cur.format("YYYY-MM-DD");
                    if (!eventsByDate[key]) eventsByDate[key] = [];
                    eventsByDate[key].push(event);
                }
                cur.add(1, "day");
            }
        });
        return Object.keys(eventsByDate).sort().map((key) => {
            const d = moment(key);
            return {
                key,
                dateStr: d.format("M월 D일"),
                dow: WK_LABELS[d.day()] + "요일",
                isToday: d.isSame(moment(today), "day"),
                isSelected: d.isSame(moment(selectedDate), "day"),
                events: eventsByDate[key],
            };
        });
    }, [filteredEvents, year, month, today, selectedDate]);

    // ── Navigation / selection ──
    const onPrev = () => animateMonthChange(-1);
    const onNext = () => animateMonthChange(1);
    const onToday = () => { setDate(today); setSelectedDate(today); };
    const todayBtnDisabled = isSameDay(selectedDate, today) && isSameDay(date, today);

    const [fsSheetOpen, setFsSheetOpen] = useState(false);

    // 풀스크린 해제 시 오버레이 시트 상태도 정리 — 재진입에 시트가 멋대로 열리지 않게
    useEffect(() => {
        if (!fullscreen) setFsSheetOpen(false);
    }, [fullscreen]);

    const handleSelectDate = (d) => {
        setSelectedDate(d);
        if (d.getMonth() !== month || d.getFullYear() !== year) setDate(d);
        if (fullscreen) setFsSheetOpen(true); // 풀스크린 유지한 채 그날 일정을 오버레이 시트로
    };

    // ── Styles derived ──
    const getWeekdayColor = (i) => {
        if (i === 0) return "var(--plando-red)";
        if (i === 6) return "var(--plando-primary)";
        return "var(--plando-text-secondary)";
    };

    const sheetDateLabel = expanded ? `${month + 1}월` : mobileSelectedDateLabel;
    const sheetEventCount = expanded
        ? monthEventsGrouped.reduce((sum, g) => sum + g.events.length, 0)
        : selectedDateEvents.length;

    const sheetBg = "var(--plando-surface)";
    const grabberColor = "var(--plando-sheet-handle)";
    // 선택된 그룹: surface와 섞어서 불투명 톤 (sticky 헤더 비침 방지)
    const selectedGroupBg = "color-mix(in srgb, var(--plando-primary) 10%, var(--plando-surface))";

    return (
        <Box
            ref={containerRef}
            sx={{
                position: "relative",
                height: "100%",
                overflow: "hidden",
                bgcolor: "background.default",
                overscrollBehavior: "none",
            }}
        >
            {/* Calendar area — 풀스크린 토글 시 영역이 그대로 확대/축소되듯 (framer layout) */}
            <MotionBox ref={calendarRef} layout transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }} sx={fullscreen
                ? { position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }
                : { position: "relative", zIndex: 1 }}>
                <MobileCalendarMonthHeader
                    year={year}
                    month={month}
                    onPrev={onPrev}
                    onNext={onNext}
                    onToday={onToday}
                    isToday={todayBtnDisabled}
                    trailing={segmentControl}
                />

                {scopeChip && (
                    <Box sx={{ display: "flex", justifyContent: "center", pb: 0.5, "&:empty": { display: "none" } }}>
                        {scopeChip}
                    </Box>
                )}

                {/* Weekday row */}
                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    px: 1, pb: 0.5,
                }}>
                    {weekdayHeader().map(({ label, weekday }) => (
                        <Typography key={weekday} align="center" sx={{
                            fontSize: 13, fontWeight: 700, color: getWeekdayColor(weekday),
                        }}>
                            {label}
                        </Typography>
                    ))}
                </Box>

                {/* 3-panel track */}
                <Box
                    sx={{ overflow: "hidden", position: "relative", ...(fullscreen ? { flex: 1, minHeight: 0 } : {}) }}
                    onTouchStart={onCalSwipeStart}
                    onTouchMove={onCalSwipeMove}
                    onTouchEnd={onCalSwipeEnd}
                >
                    <Box ref={setTrackRef} sx={{ display: "flex", willChange: "transform", ...(fullscreen ? { height: "100%" } : {}) }}>
                        <Box sx={{ flex: "0 0 100%" }}>
                            <MobileCalendarMonthGrid
                                year={prevDate.getFullYear()}
                                month={prevDate.getMonth()}
                                selectedDate={pendingSelection?.dir === -1 ? pendingSelection.date : selectedDate}
                                today={today}
                                events={filteredEvents}
                                onSelect={handleSelectDate}
                                hideWeekdays
                                fill={fullscreen}
                            />
                        </Box>
                        <Box sx={{ flex: "0 0 100%" }}>
                            <MobileCalendarMonthGrid
                                year={year}
                                month={month}
                                selectedDate={selectedDate}
                                today={today}
                                events={filteredEvents}
                                onSelect={handleSelectDate}
                                hideWeekdays
                                fill={fullscreen}
                            />
                        </Box>
                        <Box sx={{ flex: "0 0 100%" }}>
                            <MobileCalendarMonthGrid
                                year={nextDate.getFullYear()}
                                month={nextDate.getMonth()}
                                selectedDate={pendingSelection?.dir === 1 ? pendingSelection.date : selectedDate}
                                today={today}
                                events={filteredEvents}
                                onSelect={handleSelectDate}
                                hideWeekdays
                                fill={fullscreen}
                            />
                        </Box>
                    </Box>
                </Box>
            </MotionBox>

            {/* Bottom Sheet — 풀스크린에선 숨김 */}
            <Box
                ref={sheetRef}
                sx={{
                    position: "absolute",
                    left: 0, right: 0, bottom: 0, top: collapsedTop,
                    bgcolor: sheetBg,
                    borderRadius: "26px 26px 0 0",
                    boxShadow: "var(--plando-shadow-nav)",
                    zIndex: 2,
                    display: fullscreen ? "none" : "flex", flexDirection: "column",
                }}
            >
                {/* Grabber */}
                <Box
                    onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
                    sx={{
                        py: 1.25,
                        display: "grid", placeItems: "center",
                        cursor: "grab", flexShrink: 0,
                        touchAction: "none",
                        "&:active": { cursor: "grabbing" },
                    }}
                >
                    <Box sx={{ width: 40, height: 5, borderRadius: 3, bgcolor: grabberColor }} />
                </Box>

                {/* Sheet header */}
                <Box
                    onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
                    sx={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        px: 2.75, pb: 1.75,
                        flexShrink: 0,
                        touchAction: "none",
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1.1}>
                        <CalendarTodayOutlinedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                        <Typography sx={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>
                            {sheetDateLabel}
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "text.disabled", fontWeight: 600 }}>
                            일정 {sheetEventCount}개
                        </Typography>
                    </Stack>
                    <Chip
                        icon={<RepeatIcon sx={{ fontSize: "13px !important" }} />}
                        label="반복만"
                        size="small"
                        onClick={() => setShowOnlyRecurring((v) => !v)}
                        color={showOnlyRecurring ? "primary" : "default"}
                        variant={showOnlyRecurring ? "filled" : "outlined"}
                        sx={{
                            fontWeight: 700, fontSize: 11.5, height: 28,
                            cursor: "pointer", flexShrink: 0,
                            "& .MuiChip-icon": { ml: 1, mr: 0.25 },
                            "& .MuiChip-label": { pl: 0.75, pr: 1.5 },
                        }}
                    />
                </Box>

                {/* Agenda */}
                <Box
                    ref={agendaRef}
                    onTouchStart={(e) => {
                        if (!expanded) return;
                        if (!agendaRef.current || agendaRef.current.scrollTop > 0) return;
                        agendaDragRef.current = { startY: e.touches[0].clientY, triggered: false };
                    }}
                    onTouchMove={(e) => {
                        const ad = agendaDragRef.current;
                        if (!ad || ad.triggered) return;
                        const dy = e.touches[0].clientY - ad.startY;
                        if (dy > 8 && agendaRef.current && agendaRef.current.scrollTop <= 0) {
                            ad.triggered = true;
                            handleDragStart(e.touches[0].clientY);
                        }
                    }}
                    onTouchEnd={() => { agendaDragRef.current = null; }}
                    sx={{
                        flex: 1, minHeight: 0,
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                        overscrollBehavior: "contain",
                        px: 2.25, pb: "120px",
                        ...hideScrollbarSx,
                    }}
                >
                    {expanded ? (
                        monthEventsGrouped.length === 0 ? (
                            <Box sx={{ py: 7.5, textAlign: "center", color: "text.disabled", fontSize: 15 }}>
                                {month + 1}월에는 일정이 없어요
                            </Box>
                        ) : (
                            monthEventsGrouped.map((group) => (
                                <Box
                                    key={group.key}
                                    data-day={group.key}
                                    sx={{
                                        mb: 0.75,
                                        ...(group.isSelected && {
                                            bgcolor: selectedGroupBg,
                                            borderRadius: "14px",
                                            mx: -0.75, px: 0.75, pb: 0.5,
                                        }),
                                    }}
                                >
                                    <Box sx={{
                                        position: "sticky", top: 0,
                                        bgcolor: group.isSelected ? selectedGroupBg : sheetBg,
                                        borderRadius: group.isSelected ? "14px 14px 0 0" : 0,
                                        py: 1.25, px: 0.5,
                                        display: "flex", alignItems: "baseline", gap: 1.1,
                                        zIndex: 1,
                                    }}>
                                        <Typography sx={{
                                            fontSize: 16, fontWeight: 800,
                                            color: (group.isToday || group.isSelected)
                                                ? "var(--plando-primary)"
                                                : "text.primary",
                                        }}>
                                            {group.dateStr}
                                        </Typography>
                                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.disabled" }}>
                                            {group.dow}
                                            {group.isToday && " · 오늘"}
                                            {group.isSelected && !group.isToday && " · 선택됨"}
                                        </Typography>
                                    </Box>
                                    {group.events.map((event) => (
                                        <MobileCalendarEventCard
                                            key={event.id}
                                            event={event}
                                            onClick={() => onSelectEvent(event)}
                                        />
                                    ))}
                                </Box>
                            ))
                        )
                    ) : selectedDateEvents.length === 0 ? (
                        <Box sx={{ py: 7.5, textAlign: "center", color: "text.disabled", fontSize: 15, fontWeight: 500 }}>
                            {showOnlyRecurring ? "반복 일정이 없어요" : EMPTY_TEXT}
                        </Box>
                    ) : (
                        selectedDateEvents.map((event) => (
                            <MobileCalendarEventCard
                                key={event.id}
                                event={event}
                                onClick={() => onSelectEvent(event)}
                            />
                        ))
                    )}
                </Box>
            </Box>

            {/* 풀스크린 중 날짜 탭 → 일정 오버레이 시트 (풀스크린 유지) */}
            {fullscreen && (
                <SwipeableDrawer
                    anchor="bottom"
                    open={fsSheetOpen}
                    onClose={() => setFsSheetOpen(false)}
                    onOpen={() => setFsSheetOpen(true)}
                    disableSwipeToOpen
                    sx={{ zIndex: Z.SHEET }}
                    PaperProps={{
                        sx: {
                            borderTopLeftRadius: 26,
                            borderTopRightRadius: 26,
                            maxHeight: "55vh",
                            bgcolor: sheetBg,
                            backgroundImage: "none",
                        },
                    }}
                >
                    <Box sx={{ py: 1.25, display: "grid", placeItems: "center" }}>
                        <Box sx={{ width: 40, height: 5, borderRadius: 3, bgcolor: grabberColor }} />
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", px: 2.75, pb: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1.1}>
                            <CalendarTodayOutlinedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                            <Typography sx={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>
                                {mobileSelectedDateLabel}
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: "text.disabled", fontWeight: 600 }}>
                                일정 {selectedDateEvents.length}개
                            </Typography>
                        </Stack>
                    </Box>
                    <Box sx={{ overflowY: "auto", px: 2.25, pb: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
                        {selectedDateEvents.length === 0 ? (
                            <Box sx={{ py: 5, textAlign: "center", color: "text.disabled", fontSize: 15, fontWeight: 500 }}>
                                이 날은 일정이 없어요
                            </Box>
                        ) : (
                            selectedDateEvents.map((event) => (
                                <MobileCalendarEventCard
                                    key={event.id}
                                    event={event}
                                    onClick={() => onSelectEvent(event)}
                                />
                            ))
                        )}
                        {onAddForSelectedDate && (
                            <Box
                                component="button"
                                onClick={() => { setFsSheetOpen(false); onAddForSelectedDate(); }}
                                sx={{
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
                                    width: "100%", mt: 1, py: 1.5,
                                    border: "1px dashed", borderColor: "divider", borderRadius: "14px",
                                    background: "transparent", cursor: "pointer", fontFamily: "inherit",
                                    color: "text.secondary", fontSize: 14, fontWeight: 600,
                                }}
                            >
                                + 일정 추가
                            </Box>
                        )}
                    </Box>
                </SwipeableDrawer>
            )}
        </Box>
    );
}
