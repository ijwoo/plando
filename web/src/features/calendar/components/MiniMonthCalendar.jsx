import React, { useMemo } from "react";
import { Box, Stack, Typography, IconButton } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import moment from "moment";
import { weekdayHeader } from "../utils/weekStart.js";
import { forEachEventDay } from "../utils/calendarUtils.js";

const SUN = "var(--plando-red)";
const SAT = "var(--plando-primary)";
const PRIMARY = "var(--plando-primary)";
const PRIMARY_SOFT = "var(--plando-primary-soft)";
const PRIMARY_HOVER = "var(--plando-primary-hover)";
const TEXT_PRIMARY = "var(--plando-text-primary)";
const TEXT_SECONDARY = "text.secondary";
const TEXT_DISABLED = "var(--plando-text-disabled)";

// ── 데스크탑 오른쪽 패널: 미니 달력 ──
export default function MiniMonthCalendar({ date, selectedDate, events, onSelectDate, onNavigatePrev, onNavigateNext }) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const selKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;

    // Build 35 or 42 cells
    const cells = [];
    const leadingBlanks = firstDayOfMonth; // 일요일 시작이라 요일 인덱스가 곧 칼럼
    for (let i = leadingBlanks - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        cells.push({ day: d, inMonth: false, date: new Date(year, month - 1, d) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
    }
    const target = cells.length > 35 ? 42 : 35;
    let nd = 1;
    while (cells.length < target) {
        cells.push({ day: nd, inMonth: false, date: new Date(year, month + 1, nd) });
        nd++;
    }

    const eventDays = useMemo(() => {
        const set = new Set();
        for (const event of events) {
            if (!event.start) continue;
            // 인스턴트가 아니라 '날짜' 단위로 비교 — 시간 이벤트(예: 15:00–16:00)도 dot 표시
            // (MobileCalendarMonthGrid의 스팬 방식과 동일)
            forEachEventDay(event, (day) => {
                if (day.getFullYear() === year && day.getMonth() === month) {
                    set.add(day.getDate());
                }
            });
        }
        return set;
    }, [events, year, month]);

    const dowColor = (i) => (i === 0 ? SUN : i === 6 ? SAT : TEXT_SECONDARY);

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: TEXT_PRIMARY }}>
                    {moment(date).format("YYYY년 M월")}
                </Typography>
                <Stack direction="row" spacing={0.25}>
                    <IconButton size="small" onClick={onNavigatePrev} sx={{ width: 26, height: 26 }}>
                        <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton size="small" onClick={onNavigateNext} sx={{ width: 26, height: 26 }}>
                        <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Stack>
            </Stack>

            {/* Day of week header */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {weekdayHeader().map(({ label, weekday }) => (
                    <Typography
                        key={weekday}
                        sx={{
                            textAlign: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            color: dowColor(weekday),
                            py: 0.5,
                        }}
                    >
                        {label}
                    </Typography>
                ))}
            </Box>

            {/* Date cells */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {cells.map((cell, idx) => {
                    const cellKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
                    const isToday = cellKey === todayKey;
                    const isSelected = cellKey === selKey && cell.inMonth;
                    const hasEvents = cell.inMonth && eventDays.has(cell.day);
                    const cellDow = cell.date.getDay();

                    const dayColor = isToday
                        ? "#fff"
                        : !cell.inMonth ? TEXT_DISABLED
                        : cellDow === 0 ? SUN
                        : cellDow === 6 ? SAT
                        : TEXT_PRIMARY;

                    return (
                        <Box
                            key={idx}
                            onClick={() => onSelectDate(cell.date)}
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                py: "2px",
                                cursor: "pointer",
                            }}
                        >
                            <Box
                                sx={{
                                    width: 26, height: 26,
                                    borderRadius: "var(--plando-radius-pill)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: isToday ? PRIMARY
                                        : isSelected ? PRIMARY_SOFT
                                        : "transparent",
                                    outline: isSelected && !isToday
                                        ? `2px solid ${PRIMARY_SOFT}`
                                        : "none",
                                    fontSize: 11.5,
                                    fontWeight: isToday || isSelected ? 800 : 500,
                                    color: dayColor,
                                    transition: "background 0.15s",
                                    "&:hover": {
                                        bgcolor: isToday ? undefined : "var(--plando-surface-low)",
                                    },
                                }}
                            >
                                {cell.day}
                            </Box>
                            <Box sx={{ height: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {hasEvents && (
                                    <Box sx={{
                                        width: 4, height: 4,
                                        borderRadius: "var(--plando-radius-pill)",
                                        bgcolor: PRIMARY,
                                    }} />
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
