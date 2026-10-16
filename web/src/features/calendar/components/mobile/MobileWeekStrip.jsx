import React, { useRef, useEffect, useLayoutEffect, useMemo, useImperativeHandle, forwardRef } from "react";
import { Box, Typography } from "@mui/material";
import { isSameDay } from "../../utils/calendarUtils.js";
import { hideScrollbarSx } from "../../../../shared/ui/glassSx.js";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const VISIBLE_DAYS = 7;
const RANGE_DAYS = 28;

/**
 * 가로 스크롤 가능한 날짜 스트립.
 * - 7일 가시, 좌우 28일씩 버퍼 (총 63일)
 * - scroll-snap으로 1일 단위 스냅
 * - 외부에서 스크롤 동기화 가능 (ref.current.el로 native element 노출)
 */
const MobileWeekStrip = forwardRef(function MobileWeekStrip({ date, onChange, onSelectDate, today, onScrollChange }, ref) {
    const scrollRef = useRef(null);
    const programmaticScrollRef = useRef(false);
    const scrollEndTimerRef = useRef(null);

    const baseDateRef = useRef(null);
    if (!baseDateRef.current) {
        const d = new Date(date);
        d.setDate(d.getDate() - RANGE_DAYS);
        d.setHours(0, 0, 0, 0);
        baseDateRef.current = d;
    }

    const days = useMemo(() => Array.from({ length: RANGE_DAYS * 2 + VISIBLE_DAYS }, (_, i) => {
        const d = new Date(baseDateRef.current);
        d.setDate(d.getDate() + i);
        return d;
    }), [baseDateRef.current.getTime()]);

    useImperativeHandle(ref, () => ({
        el: scrollRef.current,
        scrollTo: (left) => {
            if (scrollRef.current) {
                programmaticScrollRef.current = true;
                scrollRef.current.scrollLeft = left;
                setTimeout(() => { programmaticScrollRef.current = false; }, 50);
            }
        },
        days,
    }), [days]);

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const cellW = el.clientWidth / VISIBLE_DAYS;
        if (cellW === 0) return;

        let idx = days.findIndex((d) => isSameDay(d, date));
        if (idx === -1) {
            const newBase = new Date(date);
            newBase.setDate(newBase.getDate() - RANGE_DAYS);
            newBase.setHours(0, 0, 0, 0);
            baseDateRef.current = newBase;
            idx = RANGE_DAYS;
        }
        const target = idx * cellW;
        if (Math.abs(el.scrollLeft - target) > 2) {
            programmaticScrollRef.current = true;
            el.scrollLeft = target;
            setTimeout(() => { programmaticScrollRef.current = false; }, 50);
        }
    }, [date.getTime(), days]);

    const handleScroll = (e) => {
        onScrollChange?.(e.currentTarget.scrollLeft, programmaticScrollRef.current);
        if (programmaticScrollRef.current) return;
        clearTimeout(scrollEndTimerRef.current);
        scrollEndTimerRef.current = setTimeout(() => {
            const el = scrollRef.current;
            if (!el) return;
            const cellW = el.clientWidth / VISIBLE_DAYS;
            const idx = Math.round(el.scrollLeft / cellW);
            const newDate = days[idx];
            if (newDate && !isSameDay(newDate, date)) {
                onChange?.(newDate);
            }
        }, 140);
    };

    useEffect(() => () => clearTimeout(scrollEndTimerRef.current), []);

    return (
        <Box
            ref={scrollRef}
            onScroll={handleScroll}
            sx={{
                display: "flex",
                overflowX: "auto",
                overflowY: "hidden",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                py: "var(--plando-space-2)",
                bgcolor: "var(--plando-surface)",
                ...hideScrollbarSx,
            }}
        >
            {days.map((d, i) => (
                <DayCell key={i} date={d} today={today} onClick={() => onSelectDate?.(d)} />
            ))}
        </Box>
    );
});

function DayCell({ date, today, onClick }) {
    const isToday = isSameDay(date, today);
    const dow = date.getDay();
    const isSunday = dow === 0;
    const isSaturday = dow === 6;

    return (
        <Box
            onClick={onClick}
            sx={{
                flex: `0 0 calc(100% / ${VISIBLE_DAYS})`,
                scrollSnapAlign: "start",
                display: "flex", flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                cursor: "pointer",
                "&:active": { opacity: 0.6 },
            }}
        >
            <Typography sx={{
                fontSize: 10,
                fontWeight: 600,
                color: isToday
                    ? "var(--plando-primary)"
                    : isSunday ? "var(--plando-red)"
                    : isSaturday ? "var(--plando-primary)"
                    : "var(--plando-text-tertiary)",
                lineHeight: 1,
            }}>
                {DOW[dow]}
            </Typography>
            <Box sx={{
                width: 28, height: 28,
                borderRadius: "var(--plando-radius-pill)",
                bgcolor: isToday ? "var(--plando-primary)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <Typography sx={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isToday ? "#fff" : "var(--plando-text-primary)",
                    lineHeight: 1,
                }}>
                    {date.getDate()}
                </Typography>
            </Box>
        </Box>
    );
}

export default MobileWeekStrip;
export { VISIBLE_DAYS, RANGE_DAYS };
