import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/**
 * 상태 분포 — 가로 stacked bar.
 * 예정(회색) / 진행 중(오렌지) / 완료(그린).
 */
export default function WrapStatusBreakdown({ data }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const todo = data?.todo || 0;
    const inProgress = data?.inProgress || 0;
    const done = data?.done || 0;
    const total = todo + inProgress + done;
    if (total === 0) return null;

    const segments = [
        { key: "done",       label: "완료",    count: done,       color: "var(--plando-green)" },
        { key: "inProgress", label: "진행 중", count: inProgress, color: "var(--plando-orange)" },
        { key: "todo",       label: "예정",    count: todo,       color: isDark ? "rgba(255,255,255,0.28)" : "#A3ADBE" },
    ];

    return (
        <Stack spacing={1.5}>
            <Box
                sx={{
                    display: "flex",
                    height: 14,
                    borderRadius: 999,
                    overflow: "hidden",
                    background: isDark ? "rgba(255,255,255,0.10)" : "#DEE3EC",
                }}
            >
                {segments.map((s) => (
                    s.count > 0 ? (
                        <Box
                            key={s.key}
                            sx={{
                                flexBasis: `${(s.count / total) * 100}%`,
                                background: s.color,
                                transition: "flex-basis 0.8s cubic-bezier(0.16,1,0.3,1)",
                            }}
                        />
                    ) : null
                ))}
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
                {segments.map((s) => (
                    <Stack key={s.key} direction="row" alignItems="center" spacing={0.5}>
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: s.color,
                            }}
                        />
                        <Typography
                            sx={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: isDark ? "rgba(255,255,255,0.75)" : "var(--plando-text-secondary)",
                            }}
                        >
                            {s.label}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: isDark ? "#F8FAFC" : "var(--plando-text-primary)",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {s.count}
                        </Typography>
                    </Stack>
                ))}
            </Stack>
        </Stack>
    );
}
