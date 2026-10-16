import React, { useMemo, useRef, useEffect, useState, useCallback, useLayoutEffect } from "react";
import { Box } from "@mui/material";
import { sanitize, assignColumns } from "../../utils/eventLayout.js";
import { hideScrollbarSx } from "../../../../shared/ui/glassSx.js";
import {
    HOUR_HEIGHT, BOTTOM_PAD, HOURS, TIME_COL_WIDTH,
    minToPx,
} from "../timeline/timelineConstants.js";
import TimeColumn from "../timeline/TimeColumn.jsx";
import { TimelineEventBlock, useTimelineDnD } from "../timeline/index.js";
import MobileWeekStrip, { VISIBLE_DAYS, RANGE_DAYS } from "./MobileWeekStrip.jsx";
import AllDayRow from "./AllDayRow.jsx";
import { isSameDay, toYmd, forEachEventDay, clipTimedEventToDay } from "../../utils/calendarUtils.js";

const TOTAL_DAYS = RANGE_DAYS * 2 + VISIBLE_DAYS;

export default function MobileWeekTimeline({
    date, events,
    onSelectEvent, onSelectDate, onChangeDate,
    onEventDrop, onCreateSlot,
    isDark,
}) {
    const containerRef = useRef(null);
    const stripApiRef = useRef(null);     // MobileWeekStrip의 imperative ref
    const bodyHScrollRef = useRef(null);  // 본체 horizontal scroll container
    const bodyVScrollRef = useRef(null);  // 본체 vertical scroll container
    const gridRef = useRef(null);
    const syncingRef = useRef(false);

    // baseDate: 본체용 (strip과 동일 범위)
    const baseDateRef = useRef(null);
    if (!baseDateRef.current) {
        const d = new Date(date);
        d.setDate(d.getDate() - RANGE_DAYS);
        d.setHours(0, 0, 0, 0);
        baseDateRef.current = d;
    }

    const days = useMemo(() => Array.from({ length: TOTAL_DAYS }, (_, i) => {
        const d = new Date(baseDateRef.current);
        d.setDate(d.getDate() + i);
        return d;
    }), [baseDateRef.current.getTime()]);

    const today = useMemo(() => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    }, []);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    // 모든 63일에 대한 이벤트 분류 — 멀티데이 이벤트는 걸치는 모든 날짜에 버킷팅
    // (월 뷰의 스팬 규칙과 동일. 자정을 넘는 시간 이벤트는 날짜별 구간으로 클리핑)
    const dayBuckets = useMemo(() => {
        const buckets = days.map(() => ({ allDay: [], timed: [] }));
        const idxByYmd = new Map(days.map((d, i) => [toYmd(d), i]));
        (events || []).forEach((ev) => {
            forEachEventDay(ev, (day) => {
                const idx = idxByYmd.get(toYmd(day));
                if (idx === undefined) return;
                if (ev.allDay) buckets[idx].allDay.push(ev);
                else buckets[idx].timed.push(clipTimedEventToDay(ev, day));
            });
        });
        return buckets.map((b) => ({
            allDay: b.allDay,
            timed: assignColumns(sanitize(b.timed)),
        }));
    }, [events, days]);

    // 외부 date가 days 밖이면 baseDate 재설정
    useLayoutEffect(() => {
        const idx = days.findIndex((d) => isSameDay(d, date));
        if (idx === -1) {
            const newBase = new Date(date);
            newBase.setDate(newBase.getDate() - RANGE_DAYS);
            newBase.setHours(0, 0, 0, 0);
            baseDateRef.current = newBase;
        }
    }, [date.getTime(), days]);

    // date 변경 시 본체 scrollLeft도 위치 동기화
    useLayoutEffect(() => {
        const el = bodyHScrollRef.current;
        if (!el) return;
        const cellW = el.clientWidth / VISIBLE_DAYS;
        if (cellW === 0) return;
        const idx = days.findIndex((d) => isSameDay(d, date));
        if (idx === -1) return;
        const target = idx * cellW;
        if (Math.abs(el.scrollLeft - target) > 2) {
            syncingRef.current = true;
            el.scrollLeft = target;
            setTimeout(() => { syncingRef.current = false; }, 50);
        }
    }, [date.getTime(), days]);

    // 본체 vertical 초기 스크롤
    useEffect(() => {
        if (!bodyVScrollRef.current) return;
        bodyVScrollRef.current.scrollTop = Math.max(new Date().getHours() - 1, 0) * HOUR_HEIGHT;
    }, []);

    // ── Scroll Sync: strip ↔ bodyH ──
    const onStripScrollChange = useCallback((scrollLeft, isProgrammatic) => {
        if (isProgrammatic || syncingRef.current) return;
        const body = bodyHScrollRef.current;
        if (body && Math.abs(body.scrollLeft - scrollLeft) > 1) {
            syncingRef.current = true;
            body.scrollLeft = scrollLeft;
            requestAnimationFrame(() => { syncingRef.current = false; });
        }
    }, []);

    const onBodyHScroll = useCallback((e) => {
        if (syncingRef.current) return;
        const strip = stripApiRef.current;
        if (strip && Math.abs(strip.el.scrollLeft - e.currentTarget.scrollLeft) > 1) {
            syncingRef.current = true;
            strip.scrollTo(e.currentTarget.scrollLeft);
            requestAnimationFrame(() => { syncingRef.current = false; });
        }
    }, []);

    // 본체 스크롤 종료 시 date 업데이트
    const bodyScrollEndTimerRef = useRef(null);
    const onBodyHScrollEnd = useCallback((scrollLeft) => {
        clearTimeout(bodyScrollEndTimerRef.current);
        bodyScrollEndTimerRef.current = setTimeout(() => {
            const el = bodyHScrollRef.current;
            if (!el) return;
            const cellW = el.clientWidth / VISIBLE_DAYS;
            const idx = Math.round(el.scrollLeft / cellW);
            const newDate = days[idx];
            if (newDate && !isSameDay(newDate, date)) {
                onChangeDate?.(newDate);
            }
        }, 140);
    }, [days, date, onChangeDate]);

    // ── DnD ──
    const getColIdx = useCallback((clientX) => {
        const el = bodyHScrollRef.current;
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        const cellW = el.clientWidth / VISIBLE_DAYS;
        const rel = clientX - r.left + el.scrollLeft;
        return Math.max(0, Math.min(TOTAL_DAYS - 1, Math.floor(rel / cellW)));
    }, []);

    const getDateAt = useCallback((clientX) => {
        return days[getColIdx(clientX)];
    }, [days, getColIdx]);

    const { moveDrag, createDrag, onGridTouchStart, onEventTouchStart, onTouchEnd } =
        useTimelineDnD({
            scrollRef: bodyVScrollRef, gridRef, containerRef,
            getDateAt, getColIdx,
            onCreateSlot, onEventDrop,
        });

    const [allDayExpanded, setAllDayExpanded] = useState(false);
    const maxAllDay = useMemo(() => Math.max(...dayBuckets.map((b) => b.allDay.length), 0), [dayBuckets]);
    const hasAllDay = maxAllDay > 0;

    // gridRef는 9x viewport 너비라서, 1셀 = gridRef의 1/TOTAL_DAYS
    const cellWPercent = `calc(100% / ${TOTAL_DAYS})`;
    const innerWidth = `calc(100% * ${TOTAL_DAYS} / ${VISIBLE_DAYS})`;

    // ── Virtualization: 가시 영역 ± 14일만 렌더 ──
    const [visibleStart, setVisibleStart] = useState(() => {
        const idx = days.findIndex((d) => isSameDay(d, date));
        return Math.max(0, (idx === -1 ? RANGE_DAYS : idx) - 14);
    });
    const VISIBLE_RANGE = 28; // 가시 ±14
    const visibleEnd = Math.min(TOTAL_DAYS, visibleStart + VISIBLE_RANGE);

    useEffect(() => {
        const el = bodyHScrollRef.current;
        if (!el) return;
        let raf = 0;
        const update = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const cellW = el.clientWidth / VISIBLE_DAYS;
                if (!cellW) return;
                const leftIdx = Math.floor(el.scrollLeft / cellW);
                const next = Math.max(0, leftIdx - 7);
                setVisibleStart((prev) => (Math.abs(prev - next) > 3 ? next : prev));
            });
        };
        el.addEventListener("scroll", update);
        update();
        return () => { el.removeEventListener("scroll", update); cancelAnimationFrame(raf); };
    }, []);

    const visibleIndices = useMemo(() => {
        const arr = [];
        for (let i = visibleStart; i < visibleEnd; i++) arr.push(i);
        return arr;
    }, [visibleStart, visibleEnd]);

    return (
        <Box ref={containerRef} sx={{
            flex: 1, minHeight: 0,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            bgcolor: "background.default",
        }}>
            {/* 날짜 strip */}
            <Box sx={{
                display: "flex",
                bgcolor: "var(--plando-surface)",
                boxShadow: "var(--plando-elev-2)",
                position: "relative",
                zIndex: 2,
            }}>
                <Box sx={{ width: TIME_COL_WIDTH, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <MobileWeekStrip
                        ref={stripApiRef}
                        date={date}
                        onChange={onChangeDate}
                        onSelectDate={onSelectDate}
                        today={today}
                        onScrollChange={onStripScrollChange}
                    />
                </Box>
            </Box>

            {/* 종일 행 — 본체 horizontal scroll과 sync */}
            {hasAllDay && (
                <AllDayRow
                    days={days}
                    buckets={dayBuckets}
                    expanded={allDayExpanded}
                    onToggle={() => setAllDayExpanded((v) => !v)}
                    onSelectEvent={onSelectEvent}
                    bodyHScrollRef={bodyHScrollRef}
                    innerWidth={innerWidth}
                    cellWPercent={cellWPercent}
                />
            )}

            {/* 본체: 시간 컬럼(고정) + horizontal scroll된 이벤트 영역 */}
            <Box sx={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                {/* 시간 컬럼 — 본체 vertical과 sync */}
                <TimeColumn
                    vScrollRef={bodyVScrollRef}
                    createDrag={createDrag}
                    moveDrag={moveDrag}
                    nowMin={days.findIndex((d) => isSameDay(d, today)) >= 0 ? nowMin : null}
                />

                {/* 이벤트 영역: vertical scroll → horizontal scroll → 63일 컬럼 */}
                <Box
                    ref={bodyVScrollRef}
                    sx={{
                        flex: 1, minWidth: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        WebkitOverflowScrolling: "touch",
                        ...hideScrollbarSx,
                    }}
                >
                    <Box
                        ref={bodyHScrollRef}
                        onTouchStart={onGridTouchStart}
                        onTouchEnd={(e) => { onTouchEnd(e); onBodyHScrollEnd(); }}
                        onScroll={(e) => { onBodyHScroll(e); onBodyHScrollEnd(); }}
                        sx={{
                            overflowX: "auto",
                            overflowY: "hidden",
                            scrollSnapType: "x mandatory",
                            WebkitOverflowScrolling: "touch",
                            ...hideScrollbarSx,
                        }}
                    >
                        <Box
                            ref={gridRef}
                            sx={{
                                position: "relative",
                                width: innerWidth,
                                height: 24 * HOUR_HEIGHT + BOTTOM_PAD,
                            }}
                        >
                            {/* 시간 가로 그리드 선 — 전 영역 */}
                            {HOURS.map((h) => (
                                <React.Fragment key={h}>
                                    <Box sx={{
                                        position: "absolute", top: h * HOUR_HEIGHT,
                                        left: 0, right: 0, height: "0.5px",
                                        bgcolor: "var(--plando-divider)", opacity: 0.5,
                                    }} />
                                </React.Fragment>
                            ))}

                            {/* 오늘 컬럼 배경 강조 */}
                            {(() => {
                                const todayIdx = days.findIndex((d) => isSameDay(d, today));
                                if (todayIdx === -1) return null;
                                return (
                                    <Box sx={{
                                        position: "absolute",
                                        top: 0, bottom: 0,
                                        left: `calc(${todayIdx} * ${cellWPercent})`,
                                        width: cellWPercent,
                                        bgcolor: "var(--plando-primary-soft)",
                                        opacity: 0.4,
                                        pointerEvents: "none",
                                    }} />
                                );
                            })()}

                            {/* 현재 시각 선 */}
                            {(() => {
                                const todayIdx = days.findIndex((d) => isSameDay(d, today));
                                if (todayIdx === -1) return null;
                                return (
                                    <Box sx={{
                                        position: "absolute",
                                        top: minToPx(nowMin),
                                        left: `calc(${todayIdx} * ${cellWPercent})`,
                                        width: cellWPercent,
                                        height: "1.5px",
                                        bgcolor: "var(--plando-red)",
                                        zIndex: 4,
                                        "&::before": {
                                            content: '""', position: "absolute",
                                            left: -3, top: -2,
                                            width: 6, height: 6,
                                            borderRadius: "var(--plando-radius-pill)",
                                            bgcolor: "var(--plando-red)",
                                        },
                                    }} />
                                );
                            })()}

                            {/* 생성 드래그 인디케이터 */}
                            {createDrag && (() => {
                                const topPx = minToPx(createDrag.startMin);
                                const htPx = Math.max(minToPx(createDrag.endMin - createDrag.startMin), 20);
                                return (
                                    <Box sx={{
                                        position: "absolute", top: topPx, height: htPx,
                                        left: `calc(${createDrag.colIdx} * ${cellWPercent} + 1px)`,
                                        width: `calc(${cellWPercent} - 2px)`,
                                        bgcolor: "var(--plando-primary-soft)",
                                        border: "2px dashed var(--plando-primary)",
                                        borderRadius: "var(--plando-radius-sm)", zIndex: 8,
                                    }} />
                                );
                            })()}

                            {/* 요일별 이벤트 (virtualized) */}
                            {visibleIndices.map((dayIdx) => (
                                <Box
                                    key={`day-${dayIdx}`}
                                    sx={{
                                        position: "absolute",
                                        top: 0, bottom: 0,
                                        left: `calc(${dayIdx} * ${cellWPercent} + 1px)`,
                                        width: `calc(${cellWPercent} - 2px)`,
                                    }}
                                >
                                    {dayBuckets[dayIdx].timed.map((item) => (
                                        <TimelineEventBlock
                                            key={item.id}
                                            item={item}
                                            variant="week"
                                            isDimmed={moveDrag?.ev.id === item.id}
                                            onTouchStart={(e) => onEventTouchStart(e, item)}
                                            onClick={() => onSelectEvent?.(item)}
                                            eventLeft={0}
                                            eventRightPad={0}
                                        />
                                    ))}
                                </Box>
                            ))}

                            {/* 스냅 타겟 — 모든 일 (실제 렌더는 빈 div) */}
                            {days.map((_, dayIdx) => (
                                <Box
                                    key={`snap-${dayIdx}`}
                                    sx={{
                                        position: "absolute",
                                        top: 0, height: 1,
                                        left: `calc(${dayIdx} * ${cellWPercent})`,
                                        width: cellWPercent,
                                        scrollSnapAlign: "start",
                                        pointerEvents: "none",
                                    }}
                                />
                            ))}

                            {/* 이동 고스트 */}
                            {moveDrag && (() => {
                                const item = dayBuckets
                                    .flatMap((b) => b.timed)
                                    .find((i) => i.id === moveDrag.ev.id);
                                if (!item) return null;
                                return (
                                    <Box sx={{
                                        position: "absolute",
                                        top: 0, bottom: 0,
                                        left: `calc(${moveDrag.colIdx} * ${cellWPercent} + 1px)`,
                                        width: `calc(${cellWPercent} - 2px)`,
                                    }}>
                                        <TimelineEventBlock
                                            item={{ ...item, _col: 0, _ncol: 1 }}
                                            variant="week"
                                            ghost
                                            overrideTop={minToPx(moveDrag.startMin)}
                                            overrideDur={moveDrag.dur}
                                            eventLeft={0}
                                            eventRightPad={0}
                                        />
                                    </Box>
                                );
                            })()}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

