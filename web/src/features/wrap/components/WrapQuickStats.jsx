import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import NightlightRoundedIcon from "@mui/icons-material/NightlightRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";

const TONES = {
    blue:   { bg: "#E8F0FE", iconBg: "#2D6EF5" },
    amber:  { bg: "#FFF6E0", iconBg: "#FFB020" },
    purple: { bg: "#F1ECFF", iconBg: "#7C5CFF" },
    green:  { bg: "#E7F8F1", iconBg: "#10B981" },
};

const DARK_TONES = {
    blue:   { bg: "rgba(45,110,245,0.16)", iconBg: "rgba(45,110,245,0.45)" },
    amber:  { bg: "rgba(255,176,32,0.14)", iconBg: "rgba(255,176,32,0.42)" },
    purple: { bg: "rgba(124,92,255,0.14)", iconBg: "rgba(124,92,255,0.42)" },
    green:  { bg: "rgba(16,185,129,0.14)", iconBg: "rgba(16,185,129,0.42)" },
};

function StatCell({ icon, tone, label, value, sub, isDark }) {
    const preset = (isDark ? DARK_TONES : TONES)[tone] || TONES.blue;
    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                background: isDark ? "rgba(255,255,255,0.025)" : "var(--plando-surface-alt)",
                borderRadius: "var(--plando-radius-md)",
                padding: "16px 14px",
            }}
        >
            <Stack spacing={1.25}>
                <Box
                    sx={{
                        width: 30,
                        height: 30,
                        borderRadius: "var(--plando-radius-sm)",
                        background: preset.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Box
                        sx={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            background: preset.iconBg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#FFFFFF",
                        }}
                    >
                        {icon}
                    </Box>
                </Box>

                <Stack spacing={0.25}>
                    <Typography
                        sx={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: isDark
                                ? "rgba(255,255,255,0.55)"
                                : "var(--plando-text-secondary)",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {label}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 18,
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.2,
                            color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {value}
                    </Typography>
                    {sub ? (
                        <Typography
                            sx={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: isDark
                                    ? "rgba(255,255,255,0.42)"
                                    : "var(--plando-text-tertiary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {sub}
                        </Typography>
                    ) : (
                        <Box sx={{ height: 14 }} />
                    )}
                </Stack>
            </Stack>
        </Box>
    );
}

function formatHours(minutes) {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
}

/**
 * 빠른 통계 2x2 그리드 — 토스 머니라이프 풍.
 */
export default function WrapQuickStats({ stats }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    if (!stats) return null;

    const earliestVal = stats.earliestStart
        ? `${stats.earliestStart.dayLabel} ${stats.earliestStart.timeLabel}`
        : "—";
    const latestVal = stats.latestEnd
        ? `${stats.latestEnd.dayLabel} ${stats.latestEnd.timeLabel}`
        : "—";
    const longestVal = stats.longestTodo
        ? formatHours(stats.longestTodo.minutes)
        : "—";

    return (
        <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
                <StatCell
                    isDark={isDark}
                    icon={<EventRoundedIcon sx={{ fontSize: 13 }} />}
                    tone="blue"
                    label="하루 평균"
                    value={`${(stats.dailyAverage ?? 0).toFixed(1)}개`}
                    sub="이번 주 기준"
                />
                <StatCell
                    isDark={isDark}
                    icon={<WbSunnyRoundedIcon sx={{ fontSize: 13 }} />}
                    tone="amber"
                    label="첫 일정"
                    value={earliestVal}
                    sub={stats.earliestStart ? "가장 일찍 시작" : "시간 없는 일정만"}
                />
            </Stack>
            <Stack direction="row" spacing={1}>
                <StatCell
                    isDark={isDark}
                    icon={<NightlightRoundedIcon sx={{ fontSize: 13 }} />}
                    tone="purple"
                    label="마지막 일정"
                    value={latestVal}
                    sub={stats.latestEnd ? "가장 늦게 끝남" : "시간 없는 일정만"}
                />
                <StatCell
                    isDark={isDark}
                    icon={<HourglassBottomRoundedIcon sx={{ fontSize: 13 }} />}
                    tone="green"
                    label="가장 긴 일정"
                    value={longestVal}
                    sub={stats.longestTodo?.title || "—"}
                />
            </Stack>
        </Stack>
    );
}
