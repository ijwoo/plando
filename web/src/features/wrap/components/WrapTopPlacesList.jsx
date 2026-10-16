import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";

/**
 * 자주 간 곳 TOP N — 순위 + 장소명 + 횟수 막대.
 */
export default function WrapTopPlacesList({ places = [] }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    if (!places || places.length === 0) return null;
    const max = Math.max(1, ...places.map((p) => p.count));
    const trackBg = isDark ? "rgba(255,255,255,0.10)" : "#DEE3EC";

    return (
        <Stack spacing={1.5}>
            {places.map((p, i) => {
                const barW = (p.count / max) * 100;
                return (
                    <Stack key={p.name + i} direction="row" alignItems="center" spacing={1.5}>
                        <Box
                            sx={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: isDark
                                    ? "rgba(16,185,129,0.16)"
                                    : "var(--plando-green-soft)",
                                border: `1px solid ${isDark ? "rgba(16,185,129,0.32)" : "rgba(16,185,129,0.24)"}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 900,
                                color: "var(--plando-green)",
                                flexShrink: 0,
                            }}
                        >
                            {i + 1}
                        </Box>
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "var(--plando-radius-sm)",
                                background: isDark
                                    ? "rgba(16,185,129,0.16)"
                                    : "var(--plando-green-soft)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <PlaceRoundedIcon sx={{ fontSize: 17, color: "var(--plando-green)" }} />
                        </Box>
                        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                                    <Typography
                                        sx={{
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                            letterSpacing: "-0.01em",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {p.name}
                                    </Typography>
                                    {i === 0 ? (
                                        <Typography
                                            sx={{
                                                fontSize: 10,
                                                fontWeight: 800,
                                                color: "var(--plando-green)",
                                                background: isDark ? "rgba(16,185,129,0.16)" : "var(--plando-green-soft)",
                                                padding: "2px 6px",
                                                borderRadius: 999,
                                                letterSpacing: "-0.01em",
                                                flexShrink: 0,
                                            }}
                                        >
                                            🏕️ 베이스캠프
                                        </Typography>
                                    ) : null}
                                </Stack>
                                <Typography
                                    sx={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: isDark
                                            ? "rgba(255,255,255,0.55)"
                                            : "var(--plando-text-secondary)",
                                        flexShrink: 0,
                                        ml: 0.75,
                                    }}
                                >
                                    {p.count}번
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
                                        background: i === 0 ? "var(--plando-green)" : (isDark ? "rgba(255,255,255,0.22)" : "var(--plando-text-tertiary)"),
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
