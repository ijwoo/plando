import React, { useMemo, useState } from "react";
import { useTodayTick } from "../../../shared/hooks/useTodayTick.js";
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    IconButton,
    Stack,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import { toDateFromYmd } from "../../calendar/utils/calendarUtils.js";
import { STATUS_LABEL } from "../../../shared/ui/tone.js";
import { weekdayHeader, getWeekDates, isSameDay, getStatusScheduleAccent } from "../utils/dashboardUtils.js";
import { getGlassSx, fadeDividerSx } from "../../../shared/ui/glassSx.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { PriorityPill } from "../../../shared/ui/common/Chips.jsx";
import { isTodoDone } from "../../../shared/utils/todoStatus.js";

const CALENDAR_SLOT_COUNT = 4;
const CALENDAR_LIST_HEIGHT = CALENDAR_SLOT_COUNT * 52 + (CALENDAR_SLOT_COUNT - 1) * 8;

/**
 * 미니 캘린더 + 선택 날짜 일정. mock의 MiniCalendar 스타일.
 * props 시그니처 동일 (Desktop / Mobile 둘 다 사용).
 */
export default function MiniCalendarAndScheduleCard({ allTasks, onTaskClick, onViewAll, sx }) {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const danger = theme.palette.error.main;

    // 마운트 시점에 고정하면 자정을 넘겨도 어제가 '오늘'로 남는다.
    const today = useTodayTick();
    const [weekOffset, setWeekOffset] = useState(0);

    const baseDate = useMemo(() => {
        const d = new Date(today);
        d.setDate(today.getDate() + weekOffset * 7);
        return d;
    }, [today, weekOffset]);

    const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
    // 일~토 요일 헤더 (weekDates와 같은 순서)
    const weekDayHeaders = weekdayHeader();
    const [selectedDate, setSelectedDate] = useState(today);

    const monthLabel = useMemo(() => {
        const first = weekDates[0];
        const last = weekDates[6];
        if (first.getMonth() === last.getMonth()) {
            return `${first.getFullYear()}년 ${first.getMonth() + 1}월`;
        }
        return `${first.getMonth() + 1}월 – ${last.getMonth() + 1}월 ${last.getFullYear()}`;
    }, [weekDates]);

    const selectedTodos = useMemo(() => {
        const sel = new Date(selectedDate);
        sel.setHours(0, 0, 0, 0);
        return allTasks.filter((t) => {
            if (!t.dueDate) return false;
            if (isTodoDone(t)) return false;
            const due = toDateFromYmd(t.dueDate);
            due.setHours(23, 59, 59, 999);
            const start = t.startAt ? toDateFromYmd(t.startAt) : null;
            return due >= sel && (start === null || start <= sel);
        });
    }, [allTasks, selectedDate]);

    const hasTodosOnDate = useMemo(() => {
        return (date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return allTasks.some((t) => {
                if (!t.dueDate) return false;
                if (isTodoDone(t)) return false;
                const due = toDateFromYmd(t.dueDate);
                due.setHours(23, 59, 59, 999);
                const start = t.startAt ? toDateFromYmd(t.startAt) : null;
                return due >= d && (start === null || start <= d);
            });
        };
    }, [allTasks]);

    const isMobile = !isDesktop;

    return (
        <Box
            sx={{
                borderRadius: "var(--plando-radius-card)",
                bgcolor: "background.paper",
                ...(isMobile ? getGlassSx(theme) : {}),
                boxShadow: "var(--plando-elev-1)",
                ...sx,
            }}
        >
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={1.75}>
                    {/* Month + nav */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography
                            sx={{
                                fontSize: "var(--plando-type-title3-size)",
                                fontWeight: 800,
                                letterSpacing: "var(--plando-type-title3-ls)",
                            }}
                        >
                            {monthLabel}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            {weekOffset !== 0 && (
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setWeekOffset(0);
                                        setSelectedDate(today);
                                    }}
                                    sx={{
                                        minWidth: 0,
                                        px: 1.2, py: 0.25,
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "primary.main",
                                        border: "1px solid",
                                        borderColor: "primary.main",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    오늘
                                </Button>
                            )}
                            <IconButton size="small" onClick={() => setWeekOffset((p) => p - 1)}>
                                <KeyboardArrowLeftRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                            </IconButton>
                            <IconButton size="small" onClick={() => setWeekOffset((p) => p + 1)}>
                                <KeyboardArrowRightRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                            </IconButton>
                        </Stack>
                    </Stack>

                    {/* Week strip */}
                    <Box>
                        <Grid container columns={7} sx={{ mb: 0.5 }}>
                            {weekDayHeaders.map(({ label, weekday }) => (
                                <Grid size={1} key={label}>
                                    <Typography
                                        align="center"
                                        sx={{
                                            fontWeight: 600,
                                            fontSize: 11,
                                            color: weekday === 0 ? danger : weekday === 6 ? "primary.main" : "text.disabled",
                                            letterSpacing: "-0.01em",
                                        }}
                                    >
                                        {label}
                                    </Typography>
                                </Grid>
                            ))}
                        </Grid>

                        <Grid container columns={7}>
                            {weekDates.map((date) => {
                                const isToday = isSameDay(date, today);
                                const isSelected = isSameDay(date, selectedDate);
                                const isSun = date.getDay() === 0;
                                const isSat = date.getDay() === 6;
                                const hasTodos = hasTodosOnDate(date);
                                return (
                                    <Grid size={1} key={date.toISOString()}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                py: 0.5,
                                                gap: 0.5,
                                            }}
                                        >
                                            <Press
                                                onClick={() => setSelectedDate(date)}
                                                pressScale={0.92}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: "50%",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: isSelected
                                                        ? primary
                                                        : isToday
                                                            ? alpha(primary, isDark ? 0.18 : 0.12)
                                                            : "transparent",
                                                    color: isSelected
                                                        ? "#fff"
                                                        : isSun
                                                            ? danger
                                                            : isSat
                                                                ? primary
                                                                : "inherit",
                                                    fontWeight: isSelected || isToday ? 800 : 500,
                                                    fontSize: 14,
                                                    boxShadow: isSelected ? `0 4px 12px ${alpha(primary, 0.35)}` : "none",
                                                    transition: "background 0.15s",
                                                }}
                                            >
                                                {date.getDate()}
                                            </Press>
                                            <Box
                                                sx={{
                                                    width: 4,
                                                    height: 4,
                                                    borderRadius: "50%",
                                                    bgcolor: hasTodos
                                                        ? isSelected ? alpha("#fff", 0.85) : "primary.main"
                                                        : "transparent",
                                                }}
                                            />
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>

                    {/* Selected day schedule */}
                    <Box sx={{ ...fadeDividerSx(theme.palette.divider), pt: 1.5 }}>
                        <Typography
                            sx={{
                                fontSize: "var(--plando-type-caption-size)",
                                fontWeight: 700,
                                color: "text.disabled",
                                mb: 1,
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
                        </Typography>
                        <Box
                            sx={{
                                minHeight: isDesktop ? CALENDAR_LIST_HEIGHT : undefined,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: selectedTodos.length === 0 ? "center" : "flex-start",
                            }}
                        >
                            {selectedTodos.length === 0 ? (
                                <Stack alignItems="center" justifyContent="center" spacing={0.5} sx={{ flex: 1, py: 1.5 }}>
                                    <EventAvailableRoundedIcon sx={{ fontSize: 22, color: "text.disabled" }} />
                                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.disabled" }}>
                                        일정이 없어요
                                    </Typography>
                                </Stack>
                            ) : (
                                <Stack spacing={0.75}>
                                    {selectedTodos.slice(0, CALENDAR_SLOT_COUNT).map((item) => {
                                        const accent = getStatusScheduleAccent(theme, item.status);
                                        return (
                                            <Press
                                                key={item.id}
                                                onClick={() => onTaskClick?.(item.id)}
                                                style={{
                                                    padding: "8px 10px",
                                                    borderRadius: 12,
                                                    background: "var(--plando-surface-faint)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                }}
                                            >
                                                {/* 좌측 status accent 세로 막대 (배경 제거 후 시각 단서 역할) */}
                                                <Box
                                                    sx={{
                                                        width: 3,
                                                        alignSelf: "stretch",
                                                        minHeight: 28,
                                                        borderRadius: 2,
                                                        bgcolor: accent,
                                                    }}
                                                />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography
                                                        sx={{
                                                            fontWeight: 700,
                                                            fontSize: 13,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                            letterSpacing: "-0.01em",
                                                        }}
                                                    >
                                                        {item.title}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: 10, color: "text.secondary", mt: 0.2 }}>
                                                        {STATUS_LABEL[item.status] ?? item.status}
                                                    </Typography>
                                                </Box>
                                                <PriorityPill priority={item.priority} sx={{ flexShrink: 0 }} />
                                            </Press>
                                        );
                                    })}
                                    {selectedTodos.length > CALENDAR_SLOT_COUNT && (
                                        <Button
                                            size="small"
                                            onClick={() => onViewAll?.(selectedDate)}
                                            sx={{
                                                borderRadius: 2,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: "primary.main",
                                                textTransform: "none",
                                                alignSelf: "flex-end",
                                                px: 1, py: 0.25,
                                                letterSpacing: "-0.01em",
                                            }}
                                        >
                                            전체 보기
                                        </Button>
                                    )}
                                </Stack>
                            )}
                        </Box>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
