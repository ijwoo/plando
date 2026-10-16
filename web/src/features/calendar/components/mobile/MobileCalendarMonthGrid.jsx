import React, { useMemo } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import moment from "moment";

import { alpha } from "@mui/material/styles";
import { statusColor } from "../../../../shared/ui/tone.js";
import { isSameDay, toYmd } from "../../utils/calendarUtils.js";
import { weekdayHeader } from "../../utils/weekStart.js";
import Press from "../../../../shared/ui/primitives/Press.jsx";

function getWeekdayColor(dow, theme) {
    if (dow === 0) return theme.palette.error.main;       // 일요일
    if (dow === 6) return theme.palette.primary.main;     // 토요일 (테마 primary 따라감)
    return theme.palette.text.secondary;
}

function buildCells(year, month) {
    const first = new Date(year, month, 1);
    const startDow = first.getDay(); // 일요일 시작이라 요일 인덱스가 곧 칼럼
    const dim = new Date(year, month + 1, 0).getDate();
    const prevDim = new Date(year, month, 0).getDate();

    // 5주로 충분한 달은 5주 (35 cells), 그 외 6주 (42 cells)
    const totalWithLeading = startDow + dim;
    const rowsNeeded = totalWithLeading > 35 ? 6 : 5;
    const targetCells = rowsNeeded * 7;

    const cells = [];
    for (let i = startDow - 1; i >= 0; i--) {
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        cells.push({ date: new Date(prevYear, prevMonth, prevDim - i), muted: true });
    }
    for (let d = 1; d <= dim; d++) {
        cells.push({ date: new Date(year, month, d), muted: false });
    }
    let next = 1;
    while (cells.length < targetCells) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        cells.push({ date: new Date(nextYear, nextMonth, next), muted: true });
        next += 1;
    }
    return cells;
}

/**
 * 모바일 캘린더 월 grid (자체 구현 — react-big-calendar 의존성 없음).
 *
 * Props:
 *   year, month: 0-indexed 표시 기준
 *   selectedDate: Date — 강조 표시
 *   today: Date
 *   events: react-big-calendar 형식 이벤트 배열 (event.start, event.end, event.resource)
 *   onSelect: (date) => void
 */
export default function MobileCalendarMonthGrid({
    year,
    month,
    selectedDate,
    today,
    events = [],
    onSelect,
    hideWeekdays = false,
    fill = false, // 풀스크린 — 행이 화면을 채우고 셀에 일정 제목 라벨 표시
}) {
    const theme = useTheme();
    const primary = theme.palette.primary.main;

    const cells = useMemo(() => buildCells(year, month), [year, month]);

    // 날짜별 이벤트 — dot(status 집합) + fill 모드 라벨(제목)용
    const eventsByYmd = useMemo(() => {
        const map = {};
        events.forEach((event) => {
            const start = moment(event.start).startOf("day");
            let end = event.end ? moment(event.end) : moment(event.start);
            if (
                end.format("HH:mm:ss") === "00:00:00" &&
                !moment(event.start).isSame(end, "day")
            ) {
                end = end.clone().subtract(1, "minute");
            }
            const endDay = end.startOf("day");
            const cur = start.clone();
            while (cur.isSameOrBefore(endDay, "day")) {
                const key = cur.format("YYYY-MM-DD");
                if (!map[key]) map[key] = [];
                map[key].push({ title: event.title, status: event.resource?.status });
                cur.add(1, "day");
            }
        });
        return map;
    }, [events]);

    return (
        <Box sx={fill ? { pb: "calc(env(safe-area-inset-bottom, 0px) + 12px)", height: "100%", display: "flex", flexDirection: "column" } : { pb: 0.5 }}>
            {!hideWeekdays && (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        px: 1,
                        pb: 1,
                    }}
                >
                    {weekdayHeader().map(({ label, weekday }) => (
                        <Typography
                            key={weekday}
                            align="center"
                            sx={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: getWeekdayColor(weekday, theme),
                            }}
                        >
                            {label}
                        </Typography>
                    ))}
                </Box>
            )}

            {/* 6주 grid */}
            <Box sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                px: 1,
                ...(fill ? { flex: 1, minHeight: 0, gridAutoRows: "1fr" } : {}),
            }}>
                {cells.map((c, idx) => {
                    const isToday = isSameDay(c.date, today);
                    const isSelected = isSameDay(c.date, selectedDate);
                    const dow = c.date.getDay();
                    const ymd = toYmd(c.date);
                    const dayEvents = eventsByYmd[ymd] ?? [];
                    const statuses = [...new Set(dayEvents.map((e) => e.status).filter(Boolean))].slice(0, 3);
                    const labelMax = 2;
                    const labels = fill && !c.muted ? dayEvents.slice(0, labelMax) : [];
                    const moreCount = fill && !c.muted ? Math.max(0, dayEvents.length - labelMax) : 0;

                    const dayColor = isToday
                        ? "#fff"
                        : c.muted
                            ? theme.palette.text.disabled
                            : dow === 0
                                ? theme.palette.error.main
                                : dow === 6
                                    ? primary
                                    : theme.palette.text.primary;

                    return (
                        <Press
                            key={idx}
                            onClick={() => !c.muted && onSelect?.(c.date)}
                            haptic={c.muted ? false : "light"}
                            pressScale={c.muted ? 1 : 0.92}
                            disabled={c.muted}
                            style={fill ? {
                                padding: "4px 2px 2px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "stretch",
                                justifyContent: "flex-start",
                                gap: 2,
                                minHeight: 0,
                                overflow: "hidden",
                                // 행 구분선 — 풀스크린에서 달력 그리드 구조가 분명히 보이게
                                borderTop: idx >= 7 ? `1px solid ${theme.palette.divider}` : "none",
                                cursor: c.muted ? "default" : "pointer",
                            } : {
                                aspectRatio: "1 / 1.18",
                                padding: "8px 0 4px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                gap: 4,
                                cursor: c.muted ? "default" : "pointer",
                            }}
                        >
                            <Box
                                sx={{
                                    alignSelf: "center",
                                    width: fill ? 26 : 34,
                                    height: fill ? 26 : 34,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: isToday ? primary : "transparent",
                                    boxShadow: isSelected && !isToday && !c.muted
                                        ? `0 0 0 2px ${primary}`
                                        : "none",
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: fill ? 13.5 : 16,
                                        fontWeight: isToday ? 800 : 700,
                                        color: dayColor,
                                        opacity: c.muted ? 0.5 : 1,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {c.date.getDate()}
                                </Typography>
                            </Box>

                            {fill ? (
                                <Stack spacing={"2px"} sx={{ minHeight: 0, overflow: "hidden" }}>
                                    {labels.map((ev, li) => {
                                        const c2 = statusColor(theme, ev.status);
                                        return (
                                            <Box
                                                key={li}
                                                sx={{
                                                    fontSize: 9.5,
                                                    fontWeight: 700,
                                                    lineHeight: 1.5,
                                                    px: "4px",
                                                    borderRadius: "4px",
                                                    bgcolor: alpha(c2, theme.palette.mode === "dark" ? 0.22 : 0.13),
                                                    color: c2,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    textAlign: "left",
                                                }}
                                            >
                                                {ev.title}
                                            </Box>
                                        );
                                    })}
                                    {moreCount > 0 && (
                                        <Box sx={{ fontSize: 9, fontWeight: 700, color: "text.disabled", textAlign: "left", px: "4px" }}>
                                            +{moreCount}
                                        </Box>
                                    )}
                                </Stack>
                            ) : (
                                <Stack direction="row" spacing={0.4} sx={{ height: 6 }}>
                                    {!c.muted && statuses.map((status, di) => (
                                        <Box
                                            key={di}
                                            sx={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: "50%",
                                                bgcolor: statusColor(theme, status),
                                            }}
                                        />
                                    ))}
                                </Stack>
                            )}
                        </Press>
                    );
                })}
            </Box>
        </Box>
    );
}
