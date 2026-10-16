import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { priorityColor } from "../../../shared/ui/tone.js";

// 색은 tone.js 단일 소스(빨/주/파)에서 파생
const ROW_DEFS = [
    { key: "high",   label: "높음", priority: "HIGH" },
    { key: "medium", label: "보통", priority: "MEDIUM" },
    { key: "low",    label: "낮음", priority: "LOW" },
];

/**
 * 우선순위 분포 — 3개 가로 막대.
 */
export default function WrapPriorityBreakdown({ data }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const ROWS = ROW_DEFS.map((r) => ({ ...r, color: priorityColor(theme, r.priority) }));

    if (!data) return null;
    const max = Math.max(1, data.high || 0, data.medium || 0, data.low || 0);
    const total = (data.high || 0) + (data.medium || 0) + (data.low || 0);
    if (total === 0) return null;

    const trackBg = isDark ? "rgba(255,255,255,0.10)" : "#DEE3EC";

    return (
        <Stack spacing={1.25}>
            {ROWS.map((r) => {
                const value = data[r.key] || 0;
                const barW = (value / max) * 100;
                const pct = total === 0 ? 0 : Math.round((value / total) * 100);
                return (
                    <Stack key={r.key} direction="row" alignItems="center" spacing={1.5}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ width: 56, flexShrink: 0 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
                            <Typography
                                sx={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {r.label}
                            </Typography>
                        </Stack>
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
                                    background: r.color,
                                    borderRadius: 999,
                                    transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
                                }}
                            />
                        </Box>
                        <Stack direction="row" alignItems="baseline" spacing={0.25} sx={{ width: 60, justifyContent: "flex-end" }}>
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
                                    color: isDark ? "rgba(255,255,255,0.4)" : "var(--plando-text-tertiary)",
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
