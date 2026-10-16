import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/**
 * 이번 주 키워드 — 일정 제목에서 자주 등장한 단어 chip.
 * 빈도순 정렬. 가장 큰 거 강조.
 */
export default function WrapKeywords({ keywords = [] }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    if (!keywords || keywords.length === 0) return null;

    const max = Math.max(...keywords.map((k) => k.count));

    return (
        <Box
            sx={{
                display: "flex",
                gap: 0.75,
                flexWrap: "wrap",
            }}
        >
            {keywords.map((k) => {
                const isTop = k.count === max;
                return (
                    <Stack
                        key={k.word}
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        sx={{
                            background: isTop
                                ? (isDark ? "rgba(45,110,245,0.22)" : "var(--plando-primary-soft)")
                                : (isDark ? "rgba(255,255,255,0.05)" : "var(--plando-surface-alt)"),
                            border: isTop
                                ? `1px solid ${isDark ? "rgba(45,110,245,0.42)" : "var(--plando-primary-soft-2)"}`
                                : `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "var(--plando-divider)"}`,
                            borderRadius: 999,
                            padding: "6px 11px 6px 11px",
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: 13,
                                fontWeight: isTop ? 800 : 700,
                                color: isTop
                                    ? "var(--plando-primary)"
                                    : (isDark ? "#F1F5F9" : "var(--plando-text-primary)"),
                                letterSpacing: "-0.01em",
                            }}
                        >
                            #{k.word}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: isTop
                                    ? "var(--plando-primary)"
                                    : (isDark ? "rgba(255,255,255,0.4)" : "var(--plando-text-tertiary)"),
                                opacity: isTop ? 0.7 : 1,
                            }}
                        >
                            {k.count}
                        </Typography>
                    </Stack>
                );
            })}
        </Box>
    );
}
