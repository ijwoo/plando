import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import { isSameDay, weekdayHeader } from "../../utils/dashboardUtils.js";

/**
 * 이번 주 완료율 — SVG 원형 + 요일별 progress bar.
 * weeklyCompletionRate, weeklyBarData, weeklyDelta 모두 useDashboardData에서 도출.
 */
export default function CompletionRing({ rate, delta, weeklyBarData }) {
    const theme = useTheme();
    // 일~토 라벨 — weeklyBarData의 요일 순서와 동일하게 정렬됨
    const dayLabels = weekdayHeader();
    const accent = theme.palette.primary.main;
    const success = theme.palette.success.main;
    const danger = theme.palette.error.main;

    const r = 56;
    const c = 2 * Math.PI * r;
    const dash = c * (rate / 100);

    const done = (weeklyBarData ?? []).reduce((s, d) => s + d.done, 0);
    const total = (weeklyBarData ?? []).reduce((s, d) => s + d.total, 0);

    const deltaColor = delta > 0 ? success : delta < 0 ? danger : "text.disabled";
    const DeltaIcon = delta > 0 ? ArrowUpwardRoundedIcon : delta < 0 ? ArrowDownwardRoundedIcon : null;

    return (
        <Box
            sx={{
                bgcolor: "background.paper",
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                p: 2.5,
            }}
        >
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.25 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                    이번 주 완료율
                </Typography>
                {delta !== 0 && (
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.375,
                            px: 1,
                            py: 0.375,
                            borderRadius: 999,
                            bgcolor: alpha(delta > 0 ? success : danger, 0.10),
                            color: deltaColor,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: "-0.01em",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {DeltaIcon && <DeltaIcon sx={{ fontSize: 11 }} />}
                        {Math.abs(delta)}%
                    </Box>
                )}
            </Stack>

            {/* 목록(할 일 > 이번 주)과 집계 기준이 달라 헷갈리지 않도록 명시 — 통계는 보관된 완료 항목까지 포함 */}
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.disabled", letterSpacing: "-0.01em", mb: 1.75 }}>
                이번 주 마감 기준 · 완료(보관) 포함
            </Typography>

            <Stack direction="row" alignItems="center" spacing={2.25}>
                <Box sx={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
                    <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="70" cy="70" r={r} stroke="var(--plando-surface-low)" strokeWidth="14" fill="none" />
                        <circle
                            cx="70"
                            cy="70"
                            r={r}
                            stroke={accent}
                            strokeWidth="14"
                            fill="none"
                            strokeDasharray={`${dash} ${c}`}
                            strokeLinecap="round"
                            style={{ transition: "stroke-dasharray var(--plando-dur-slow) var(--plando-ease)" }}
                        />
                    </svg>
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "baseline" }}>
                            <Typography
                                sx={{
                                    fontSize: 32,
                                    fontWeight: 800,
                                    color: "text.primary",
                                    letterSpacing: "-0.04em",
                                    lineHeight: 1,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {rate}
                            </Typography>
                            <Typography sx={{ fontSize: 16, fontWeight: 800, color: "text.primary", ml: 0.25 }}>%</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", mt: 0.25 }}>
                            {done} / {total}건
                        </Typography>
                    </Box>
                </Box>

                <Stack spacing={1} sx={{ flex: 1 }}>
                    {(weeklyBarData ?? []).map((d, i) => {
                        const dayDone = d.done;
                        const dayTotal = d.total;
                        const dayPct = dayTotal > 0 ? Math.round((dayDone / dayTotal) * 100) : 0;
                        const isToday = isSameDay(d.date, new Date());
                        const barColor = dayPct === 100 ? success : isToday ? accent : "var(--plando-surface-strong)";
                        return (
                            <Stack key={i} direction="row" alignItems="center" spacing={1}>
                                <Typography
                                    sx={{
                                        width: 18,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        color: isToday ? "primary.main" : "text.disabled",
                                    }}
                                >
                                    {dayLabels[i]?.label}
                                </Typography>
                                <Box sx={{ flex: 1, height: 6, borderRadius: 999, bgcolor: "var(--plando-surface-low)", overflow: "hidden" }}>
                                    <Box
                                        sx={{
                                            height: "100%",
                                            width: `${dayPct}%`,
                                            bgcolor: barColor,
                                            borderRadius: 999,
                                            transition: "width var(--plando-dur-slow) var(--plando-ease)",
                                        }}
                                    />
                                </Box>
                                <Typography
                                    sx={{
                                        width: 34,
                                        textAlign: "right",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "text.secondary",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {dayPct}%
                                </Typography>
                            </Stack>
                        );
                    })}
                </Stack>
            </Stack>
        </Box>
    );
}
