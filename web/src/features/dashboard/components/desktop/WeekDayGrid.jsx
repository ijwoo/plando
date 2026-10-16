import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import HeaderActionButton from "../../../../shared/ui/common/HeaderActionButton.jsx";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { getWeekDates, isSameDay, weekdayHeader } from "../../utils/dashboardUtils.js";
import { toDateFromYmd } from "../../../calendar/utils/calendarUtils.js";
import { getStatusLabel, softOn, statusColor } from "../../../../shared/ui/tone.js";
import { resolveAssigneeLabel } from "../../../../shared/utils/assigneeUtils.js";
import { isTodoDone } from "../../../../shared/utils/todoStatus.js";

/** 상태 accent — tone.js 단일 소스에서 color/soft 파생 */
function useStatusToken(status) {
    const theme = useTheme();
    const color = statusColor(theme, status);
    return { color, soft: softOn(theme, color, 0.9) };
}

/** 정렬용 우선순위 (high → low). 색칠과 무관하게 카드 순서만. */
function priorityRank(p) {
    return p === "HIGH" ? 0 : p === "MEDIUM" ? 1 : p === "LOW" ? 2 : 3;
}

/**
 * 7-요일 컬럼 그리드. 시간 단위 필드가 없어서 mockup의 시간×요일을 요일 컬럼으로 변경.
 * 각 컬럼에 그날 마감인 todo 카드 stack. 오늘은 헤더 강조 + 컬럼 bg tint.
 */
export default function WeekDayGrid({ allTasks, onTaskClick, onAddTask }) {
    const theme = useTheme();
    const accent = theme.palette.primary.main;
    const today = new Date();
    const weekDates = getWeekDates(today);
    // 일~토 요일 라벨 (weekDates와 같은 순서)
    const dayLabels = weekdayHeader();
    const monthLabel = `${weekDates[0].getMonth() + 1}월 ${weekDates[0].getDate()}일–${weekDates[6].getDate()}일`;

    const tasksByDay = weekDates.map((d) =>
        (allTasks || [])
            .filter((t) => t.dueDate && isSameDay(toDateFromYmd(t.dueDate), d))
            .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    );

    return (
        <Box
            sx={{
                bgcolor: "background.paper",
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                p: 2.5,
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                    이번 주 일정
                </Typography>
                <Box
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        px: 1.25,
                        py: 0.375,
                        borderRadius: 999,
                        bgcolor: "var(--plando-primary-soft)",
                        color: "primary.main",
                        fontSize: 11.5,
                        fontWeight: 800,
                    }}
                >
                    {today.getFullYear()}년 {monthLabel}
                </Box>
                <Box sx={{ flex: 1 }} />
                <HeaderActionButton variant="ghost" icon={<AddRoundedIcon sx={{ fontSize: 15 }} />} onClick={onAddTask}>
                    일정 추가
                </HeaderActionButton>
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
                {weekDates.map((d, di) => {
                    const isToday = isSameDay(d, today);
                    const isSat = d.getDay() === 6;
                    const isSun = d.getDay() === 0;
                    const headerColor = isSun ? "error.main" : isSat ? "primary.main" : "text.disabled";
                    const dayTasks = tasksByDay[di];
                    return (
                        <Box
                            key={di}
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                                bgcolor: isToday ? alpha(accent, 0.04) : "transparent",
                                borderRadius: "var(--plando-radius-md)",
                                p: 0.875,
                                border: "1px solid",
                                borderColor: isToday ? alpha(accent, 0.18) : "transparent",
                                minHeight: 220,
                            }}
                        >
                            <Stack alignItems="center" spacing={0.25} sx={{ pb: 0.75, borderBottom: "1px solid", borderColor: isToday ? alpha(accent, 0.2) : "divider" }}>
                                <Typography
                                    sx={{
                                        fontSize: 10.5,
                                        fontWeight: 800,
                                        letterSpacing: "0.04em",
                                        color: headerColor,
                                    }}
                                >
                                    {dayLabels[di]?.label}
                                </Typography>
                                <Box
                                    sx={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 999,
                                        bgcolor: isToday ? accent : "transparent",
                                        color: isToday ? "primary.contrastText" : "text.primary",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 13,
                                        fontWeight: 800,
                                        letterSpacing: "-0.02em",
                                    }}
                                >
                                    {d.getDate()}
                                </Box>
                            </Stack>

                            <Stack spacing={0.625}>
                                {dayTasks.slice(0, 5).map((t) => (
                                    <DayCard key={t.id} task={t} onClick={() => onTaskClick?.(t.id)} />
                                ))}
                                {dayTasks.length === 0 && (
                                    <Box sx={{ flex: 1, minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Typography sx={{ fontSize: 10.5, color: "text.disabled", fontWeight: 600 }}>
                                            일정 없음
                                        </Typography>
                                    </Box>
                                )}
                                {dayTasks.length > 5 && (
                                    <Typography sx={{ fontSize: 10.5, color: "text.disabled", fontWeight: 700, textAlign: "center", pt: 0.25 }}>
                                        +{dayTasks.length - 5}건 더
                                    </Typography>
                                )}
                            </Stack>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

function DayCard({ task, onClick }) {
    const isDone = isTodoDone(task);
    const tone = useStatusToken(task.status);
    const assigneeLabel = resolveAssigneeLabel(task);

    return (
        <Box
            onClick={onClick}
            sx={{
                px: 0.875,
                py: 0.625,
                borderRadius: "var(--plando-radius-sm)",
                bgcolor: tone.soft,
                borderLeft: "3px solid",
                borderColor: tone.color,
                cursor: "pointer",
                transition: "transform var(--plando-dur-fast) var(--plando-ease)",
                "&:hover": { transform: "translateY(-1px)" },
            }}
        >
            <Typography
                sx={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: isDone ? "text.disabled" : "text.primary",
                    textDecoration: isDone ? "line-through" : "none",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {task.title}
            </Typography>
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: tone.color, mt: 0.25, opacity: 0.85 }}>
                {getStatusLabel(task.status)}{assigneeLabel ? ` · ${assigneeLabel}` : ""}
            </Typography>
        </Box>
    );
}
