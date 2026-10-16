import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { KO_DAYS } from "../data/mockWrapData.js";

/**
 * 흰 카드 안에 들어가는 미니 요일 막대 그래프.
 * 토스 만보기 스타일 — 굵고 둥근 막대.
 */
export default function WrapWeekdayBars({ counts = [], highlightIndex = -1 }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const max = Math.max(1, ...counts);

    const baseBar = isDark ? "rgba(255,255,255,0.12)" : "#DEE3EC";
    const labelMuted = isDark ? "rgba(255,255,255,0.6)" : "var(--plando-text-secondary)";
    const labelStrong = isDark ? "#F1F5F9" : "var(--plando-text-primary)";

    return (
        <Box>
            <Stack
                direction="row"
                alignItems="flex-end"
                justifyContent="space-between"
                spacing={1}
                sx={{ height: 70 }}
            >
                {counts.map((c, i) => {
                    const h = max === 0 ? 0 : (c / max) * 100;
                    const isPeak = i === highlightIndex;
                    return (
                        <Stack
                            key={i}
                            alignItems="center"
                            sx={{ flex: 1, height: "100%" }}
                            justifyContent="flex-end"
                        >
                            <Box
                                sx={{
                                    width: "100%",
                                    maxWidth: 28,
                                    height: `${h}%`,
                                    background: isPeak
                                        ? "var(--plando-primary)"
                                        : baseBar,
                                    borderRadius: 5,
                                    minHeight: 6,
                                    transition: "height 0.8s cubic-bezier(0.16,1,0.3,1)",
                                }}
                            />
                        </Stack>
                    );
                })}
            </Stack>
            <Stack
                direction="row"
                justifyContent="space-between"
                spacing={1}
                sx={{ mt: 1.25 }}
            >
                {KO_DAYS.map((d, i) => (
                    <Box key={i} sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
                        <Typography
                            sx={{
                                fontSize: 12,
                                fontWeight: i === highlightIndex ? 800 : 700,
                                color: i === highlightIndex ? "var(--plando-primary)" : labelMuted,
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {d}
                        </Typography>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
}
