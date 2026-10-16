import React from "react";
import { Box, Stack, Typography, Avatar } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const RANK_TONES = [
    { bg: "#FFF6E0", color: "#B57D00", border: "#F2C863" },  // 1
    { bg: "#EDF1F7", color: "#5C6B85", border: "#C7D0E0" },  // 2
    { bg: "#FBEDE2", color: "#8C5A2E", border: "#E4B895" },  // 3
];

const DARK_RANK_TONES = [
    { bg: "rgba(255,176,32,0.18)", color: "#FFCB57", border: "rgba(255,176,32,0.4)" },
    { bg: "rgba(255,255,255,0.08)", color: "#B7BFCD", border: "rgba(255,255,255,0.18)" },
    { bg: "rgba(255,138,0,0.16)",  color: "#F2A977", border: "rgba(255,138,0,0.32)" },
];

/**
 * 함께한 사람 TOP 3 — 순위 메달 + 아바타 + 이름 + 횟수 막대.
 */
export default function WrapTopPeopleList({ people = [] }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const tones = isDark ? DARK_RANK_TONES : RANK_TONES;

    const max = Math.max(1, ...people.map((p) => p.count));
    const trackBg = isDark ? "rgba(255,255,255,0.10)" : "#DEE3EC";

    return (
        <Stack spacing={1.5}>
            {people.map((p, i) => {
                const tone = tones[i] || tones[2];
                const barW = (p.count / max) * 100;
                return (
                    <Stack key={p.name + i} direction="row" alignItems="center" spacing={1.5}>
                        {/* 순위 메달 */}
                        <Box
                            sx={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: tone.bg,
                                border: `1px solid ${tone.border}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 900,
                                color: tone.color,
                                flexShrink: 0,
                            }}
                        >
                            {i + 1}
                        </Box>

                        {/* 아바타 */}
                        <Avatar
                            src={p.profileImageUrl || undefined}
                            sx={{
                                width: 32,
                                height: 32,
                                bgcolor: isDark ? "rgba(45,110,245,0.22)" : "var(--plando-primary-soft)",
                                color: "var(--plando-primary)",
                                fontSize: 13,
                                fontWeight: 800,
                            }}
                        >
                            {p.name.slice(0, 1)}
                        </Avatar>

                        {/* 이름 + 막대 */}
                        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    {p.name}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: isDark
                                            ? "rgba(255,255,255,0.55)"
                                            : "var(--plando-text-secondary)",
                                    }}
                                >
                                    {p.count}회
                                </Typography>
                            </Stack>
                            <Box
                                sx={{
                                    height: 6,
                                    background: trackBg,
                                    borderRadius: 999,
                                    overflow: "hidden",
                                }}
                            >
                                <Box
                                    sx={{
                                        height: "100%",
                                        width: `${barW}%`,
                                        background: i === 0 ? "var(--plando-primary)" : (isDark ? "rgba(255,255,255,0.22)" : "var(--plando-text-tertiary)"),
                                        opacity: i === 0 ? 1 : 0.55,
                                        borderRadius: 999,
                                        transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
                                    }}
                                />
                            </Box>
                        </Stack>
                    </Stack>
                );
            })}
        </Stack>
    );
}
