import React from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { getGlassSx, fadeDividerSx } from "../../../../shared/ui/glassSx.js";
import { weekdayHeader } from "../../utils/dashboardUtils.js";

/**
 * 이번 주 완료 추이 (슬라이드 2번).
 * mock의 stacked bar 스타일: 완료(filled primary) + 미완료(soft outline) 적층.
 * props 시그니처 동일.
 */
export default function WeeklyBarSlide({ weeklyCompletionRate, weeklyDelta, weeklyBarData }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const success = theme.palette.success.main;
    const danger = theme.palette.error.main;

    const isPositive = weeklyDelta >= 0;
    // 일~토 라벨·오늘 컬럼 (weeklyBarData의 요일 순서와 동일)
    const dayLabels = weekdayHeader();
    const todayDow = new Date().getDay();
    const totalDone = weeklyBarData.reduce((s, d) => s + d.done, 0);
    const totalAll = weeklyBarData.reduce((s, d) => s + d.total, 0);
    const totalTodo = totalAll - totalDone;
    const maxBar = Math.max(totalAll === 0 ? 1 : Math.max(...weeklyBarData.map((d) => d.total)), 1);

    const subtleBg = isDark ? "rgba(255,255,255,0.06)" : alpha(primary, 0.08);
    const todoFill = isDark ? "rgba(255,255,255,0.10)" : alpha(primary, 0.14);

    const deltaColor = isPositive ? success : danger;
    const deltaTint = isPositive
        ? alpha(success, isDark ? 0.18 : 0.12)
        : alpha(danger, isDark ? 0.18 : 0.12);

    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                ...getGlassSx(theme),
                borderColor: "transparent",
            }}
        >
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                {/* Header */}
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-label-size)",
                            fontWeight: "var(--plando-type-label-weight)",
                            color: "text.secondary",
                        }}
                    >
                        이번 주 완료
                    </Typography>
                    <Box
                        sx={{
                            fontSize: 10,
                            fontWeight: 700,
                            px: 1,
                            py: 0.4,
                            borderRadius: 999,
                            bgcolor: deltaTint,
                            color: deltaColor,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {isPositive ? "+" : ""}
                        {weeklyDelta}%
                    </Box>
                </Stack>

                {/* 목록(할 일 > 이번 주)과 집계 기준이 달라 헷갈리지 않도록 명시 — 통계는 보관된 완료 항목까지 포함 */}
                <Typography sx={{ fontSize: 10, fontWeight: 500, color: "text.disabled", letterSpacing: "-0.01em", mb: 0.75 }}>
                    이번 주 마감 기준 · 완료(보관) 포함
                </Typography>

                {/* Big number row */}
                <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mb: 1.25 }}>
                    <Typography
                        sx={{
                            fontSize: 26,
                            fontWeight: 800,
                            lineHeight: 1,
                            color: "text.primary",
                            letterSpacing: "-0.03em",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {totalDone}
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.disabled", whiteSpace: "nowrap" }}>
                        / {totalAll} 완료
                    </Typography>
                    <Typography sx={{ ml: "auto", fontSize: 11, fontWeight: 600, color: "text.secondary" }}>
                        {weeklyCompletionRate}%
                    </Typography>
                </Stack>

                {/* Stacked bars (완료 채움 + 미완료 outline) */}
                <Stack
                    direction="row"
                    alignItems="flex-end"
                    spacing="6px"
                    sx={{ height: 64, mb: 0.75 }}
                >
                    {weeklyBarData.map((day, i) => {
                        const isToday = i === todayDow;
                        const dayTodo = day.total - day.done;
                        const totalH = Math.max(8, (day.total / maxBar) * 56);
                        const doneH = day.total > 0 ? (day.done / day.total) * totalH : 0;
                        const todoH = totalH - doneH;
                        return (
                            <Box
                                key={i}
                                sx={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "4px",
                                    height: "100%",
                                    justifyContent: "flex-end",
                                }}
                            >
                                <Box
                                    sx={{
                                        width: "100%",
                                        maxWidth: 22,
                                        height: totalH,
                                        display: "flex",
                                        flexDirection: "column-reverse",
                                        borderRadius: "5px",
                                        overflow: "hidden",
                                        boxShadow: isToday
                                            ? `0 0 10px ${alpha(primary, 0.4)}`
                                            : "none",
                                    }}
                                >
                                    {doneH > 0 && (
                                        <Box
                                            sx={{
                                                height: doneH,
                                                bgcolor: "primary.main",
                                                opacity: isToday ? 1 : 0.9,
                                                borderRadius: dayTodo > 0 ? "0 0 5px 5px" : "5px",
                                                transition: "height 0.4s",
                                            }}
                                        />
                                    )}
                                    {todoH > 0 && (
                                        <Box
                                            sx={{
                                                height: todoH,
                                                bgcolor: isToday ? alpha(primary, 0.18) : todoFill,
                                                border: isToday ? `1px dashed ${alpha(primary, 0.5)}` : "none",
                                                boxSizing: "border-box",
                                                borderRadius: doneH > 0 ? "5px 5px 0 0" : "5px",
                                            }}
                                        />
                                    )}
                                    {day.total === 0 && (
                                        <Box
                                            sx={{
                                                height: 4,
                                                bgcolor: subtleBg,
                                                borderRadius: "5px",
                                            }}
                                        />
                                    )}
                                </Box>
                                <Typography
                                    sx={{
                                        fontSize: 9,
                                        fontWeight: isToday ? 800 : 600,
                                        color: isToday ? "primary.main" : "text.disabled",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    {dayLabels[i]?.label}
                                </Typography>
                            </Box>
                        );
                    })}
                </Stack>

                {/* Legend */}
                <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{
                        pt: 0.75,
                        ...fadeDividerSx(theme.palette.divider),
                    }}
                >
                    <LegendDot color={primary} label={`완료 ${totalDone}`} />
                    <LegendDot color={todoFill} label={`미완료 ${totalTodo}`} bordered />
                </Stack>
            </CardContent>
        </Card>
    );
}

function LegendDot({ color, label, bordered = false }) {
    return (
        <Stack direction="row" alignItems="center" spacing={0.6}>
            <Box
                sx={{
                    width: 8, height: 8,
                    borderRadius: "2px",
                    bgcolor: color,
                    border: bordered ? "1px solid" : "none",
                    borderColor: "divider",
                    boxSizing: "border-box",
                }}
            />
            <Typography
                sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.01em",
                }}
            >
                {label}
            </Typography>
        </Stack>
    );
}
