import React, { useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { flushSync } from "react-dom";
import { Box } from "@mui/material";
import MobileDayTimeline from "./MobileDayTimeline.jsx";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const SWIPE_RATIO = 0.22;

/**
 * 일 뷰 3패널 스와이프 래퍼.
 * - 어제 / 오늘 / 내일 3개의 MobileDayTimeline을 가로로 배치
 * - 드래그 중 인접 날짜가 보임 (peek)
 * - 손 떼면 가까운 패널로 스냅 + selectedDate 업데이트
 */
export default function MobileDayView({
    date, events, eventsForDate,
    onSelectEvent, onEventDrop, onCreateSlot,
    onChangeDate,
    isDark,
}) {
    const containerRef = useRef(null);
    const trackRef = useRef(null);
    const swipeRef = useRef({ sx: 0, sy: 0, mode: null, dx: 0 });
    const isAnimatingRef = useRef(false);
    const needsResetRef = useRef(false);
    const innerDragActiveRef = useRef(false);

    const prevDate = useMemo(() => addDays(date, -1), [date]);
    const nextDate = useMemo(() => addDays(date, 1), [date]);

    // ── 트랙 위치: 마운트 시 중앙(-100%)으로 초기화 ──
    const setTrackRef = useCallback((node) => {
        trackRef.current = node;
        if (node) {
            node.style.transition = "none";
            node.style.transform = "translateX(-100%)";
        }
    }, []);

    // ── date 변경 후 트랙 위치 리셋 ──
    useLayoutEffect(() => {
        if (needsResetRef.current && trackRef.current) {
            trackRef.current.style.transition = "none";
            trackRef.current.style.transform = "translateX(-100%)";
            needsResetRef.current = false;
        }
    }, [date]);

    const animateChange = useCallback((dir) => {
        if (isAnimatingRef.current) return;
        isAnimatingRef.current = true;
        const track = trackRef.current;
        if (!track) { isAnimatingRef.current = false; return; }

        const newDate = addDays(date, dir);

        track.style.transition = `transform 0.32s ${EASE}`;
        track.style.transform = `translateX(${dir > 0 ? "-200%" : "0%"})`;

        setTimeout(() => {
            needsResetRef.current = true;
            flushSync(() => onChangeDate?.(newDate));
            isAnimatingRef.current = false;
        }, 320);
    }, [date, onChangeDate]);

    // ── 가로 스와이프 트래킹 ──
    const onTouchStart = (e) => {
        if (isAnimatingRef.current) return;
        swipeRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, mode: null, dx: 0 };
        if (trackRef.current) trackRef.current.style.transition = "none";
    };

    const onTouchMove = (e) => {
        if (isAnimatingRef.current) return;
        // inner DnD 활성 중이면 스와이프 모드 진입 차단 + 진행 중인 swipe도 취소
        if (innerDragActiveRef.current) {
            const s = swipeRef.current;
            if (s.mode === "h" && trackRef.current) {
                trackRef.current.style.transition = `transform 0.15s ${EASE}`;
                trackRef.current.style.transform = "translateX(-100%)";
            }
            swipeRef.current = { sx: 0, sy: 0, mode: null, dx: 0 };
            return;
        }
        const s = swipeRef.current;
        const dx = e.touches[0].clientX - s.sx;
        const dy = e.touches[0].clientY - s.sy;
        if (s.mode === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            s.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        }
        if (s.mode === "h") {
            s.dx = dx;
            if (trackRef.current) {
                trackRef.current.style.transform = `translateX(calc(-100% + ${dx}px))`;
            }
        }
    };

    const onTouchEnd = () => {
        if (isAnimatingRef.current) return;
        if (innerDragActiveRef.current) {
            swipeRef.current = { sx: 0, sy: 0, mode: null, dx: 0 };
            return;
        }
        const s = swipeRef.current;
        if (s.mode !== "h") return;
        const w = containerRef.current?.clientWidth || 390;
        if (s.dx < -w * SWIPE_RATIO) {
            animateChange(1);
        } else if (s.dx > w * SWIPE_RATIO) {
            animateChange(-1);
        } else if (trackRef.current) {
            trackRef.current.style.transition = `transform 0.25s ${EASE}`;
            trackRef.current.style.transform = "translateX(-100%)";
        }
    };

    const handleInnerDragActiveChange = useCallback((active) => {
        innerDragActiveRef.current = active;
    }, []);

    // 인접 일의 이벤트 필터링 (eventsForDate 함수가 있으면 사용, 없으면 전체 events 사용)
    const evFor = (d) => (typeof eventsForDate === "function" ? eventsForDate(d) : events);

    return (
        <Box
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            sx={{
                flex: 1, minHeight: 0,
                overflow: "hidden",
                position: "relative",
            }}
        >
            <Box ref={setTrackRef} sx={{ display: "flex", height: "100%", willChange: "transform" }}>
                <Box sx={{ flex: "0 0 100%", display: "flex", flexDirection: "column" }}>
                    <MobileDayTimeline
                        date={prevDate}
                        events={evFor(prevDate)}
                        onSelectEvent={onSelectEvent}
                        isDark={isDark}
                        disableSlideAnim
                    />
                </Box>
                <Box sx={{ flex: "0 0 100%", display: "flex", flexDirection: "column" }}>
                    <MobileDayTimeline
                        date={date}
                        events={evFor(date)}
                        onSelectEvent={onSelectEvent}
                        onEventDrop={onEventDrop}
                        onCreateSlot={onCreateSlot}
                        isDark={isDark}
                        disableSlideAnim
                        onDragActiveChange={handleInnerDragActiveChange}
                    />
                </Box>
                <Box sx={{ flex: "0 0 100%", display: "flex", flexDirection: "column" }}>
                    <MobileDayTimeline
                        date={nextDate}
                        events={evFor(nextDate)}
                        onSelectEvent={onSelectEvent}
                        isDark={isDark}
                        disableSlideAnim
                    />
                </Box>
            </Box>
        </Box>
    );
}

function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}
