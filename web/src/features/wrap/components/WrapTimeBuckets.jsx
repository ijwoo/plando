import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import WbTwilightRoundedIcon from "@mui/icons-material/WbTwilightRounded";
import NightsStayRoundedIcon from "@mui/icons-material/NightsStayRounded";
import BedtimeRoundedIcon from "@mui/icons-material/BedtimeRounded";

const ITEMS = [
    { key: "dawn",      label: "새벽",  hint: "00–06시", icon: BedtimeRoundedIcon,    color: "#5B5FE9" },
    { key: "morning",   label: "오전",  hint: "06–12시", icon: WbSunnyRoundedIcon,    color: "#FFB020" },
    { key: "afternoon", label: "오후",  hint: "12–18시", icon: WbTwilightRoundedIcon, color: "#FF7A45" },
    { key: "evening",   label: "저녁",  hint: "18–24시", icon: NightsStayRoundedIcon, color: "#7C5CFF" },
];

/**
 * 시간대별 일정 분포 — 오전/오후/저녁 가로 막대 3개.
 * 메인 카드 안에 들어가는 미니 섹션.
 */
export default function WrapTimeBuckets({ buckets }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...Object.values(buckets));
    const trackBg = isDark ? "rgba(255,255,255,0.10)" : "#DEE3EC";
    const peakKey = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0];

    return (
        <Stack spacing={1.5}>
            {ITEMS.map((item) => {
                const value = buckets[item.key] || 0;
                const pct = total === 0 ? 0 : Math.round((value / total) * 100);
                const barW = max === 0 ? 0 : (value / max) * 100;
                const isPeak = item.key === peakKey;
                const Icon = item.icon;

                return (
                    <Stack key={item.key} direction="row" alignItems="center" spacing={1.5}>
                        {/* 시간대 아이콘 + 라벨 */}
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.75}
                            sx={{ width: 72, flexShrink: 0 }}
                        >
                            <Box sx={{ display: "flex", color: item.color }}>
                                <Icon sx={{ fontSize: 16 }} />
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {item.label}
                            </Typography>
                        </Stack>

                        {/* 막대 */}
                        <Box
                            sx={{
                                flex: 1,
                                height: 8,
                                background: trackBg,
                                borderRadius: 999,
                                overflow: "hidden",
                            }}
                        >
                            <Box
                                sx={{
                                    height: "100%",
                                    width: `${barW}%`,
                                    background: isPeak ? item.color : (isDark ? "rgba(255,255,255,0.22)" : "var(--plando-text-tertiary)"),
                                    opacity: isPeak ? 1 : 0.5,
                                    borderRadius: 999,
                                    transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
                                }}
                            />
                        </Box>

                        {/* 값 */}
                        <Stack direction="row" alignItems="baseline" spacing={0.25} sx={{ width: 56, justifyContent: "flex-end" }}>
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 800,
                                    color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {value}
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: isDark
                                        ? "rgba(255,255,255,0.4)"
                                        : "var(--plando-text-tertiary)",
                                }}
                            >
                                ({pct}%)
                            </Typography>
                        </Stack>
                    </Stack>
                );
            })}
        </Stack>
    );
}
