import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";

const TONES = {
    blue:   { bg: "#E8F0FE", iconBg: "#2D6EF5" },
    amber:  { bg: "#FFF6E0", iconBg: "#FFB020" },
    green:  { bg: "#E7F8F1", iconBg: "#10B981" },
};
const DARK_TONES = {
    blue:   { bg: "rgba(45,110,245,0.16)", iconBg: "rgba(45,110,245,0.45)" },
    amber:  { bg: "rgba(255,176,32,0.14)", iconBg: "rgba(255,176,32,0.42)" },
    green:  { bg: "rgba(16,185,129,0.14)", iconBg: "rgba(16,185,129,0.42)" },
};

function formatHours(minutes) {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
}

function NotableRow({ icon, tone, label, todo, isDark, showDuration }) {
    const preset = (isDark ? DARK_TONES : TONES)[tone] || TONES.blue;
    if (!todo) return null;
    return (
        <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ py: 0.5 }}>
            <Box
                sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--plando-radius-sm)",
                    background: preset.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <Box
                    sx={{
                        width: 22,
                        height: 22,
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
            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: isDark ? "rgba(255,255,255,0.55)" : "var(--plando-text-secondary)",
                        letterSpacing: "-0.01em",
                    }}
                >
                    {label}
                </Typography>
                <Typography
                    sx={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                        letterSpacing: "-0.015em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {todo.title}
                </Typography>
                <Typography
                    sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isDark ? "rgba(255,255,255,0.42)" : "var(--plando-text-tertiary)",
                    }}
                >
                    {todo.dateLabel} {todo.dayLabel}요일 · {todo.timeLabel}
                    {showDuration && todo.minutes ? ` · ${formatHours(todo.minutes)}` : ""}
                </Typography>
            </Stack>
        </Stack>
    );
}

/**
 * 이번 주 특별한 순간 — 첫/마지막/가장 긴 일정.
 */
export default function WrapNotableTodos({ notable }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    if (!notable) return null;

    return (
        <Stack spacing={1.5}>
            <NotableRow
                tone="blue"
                icon={<FlightTakeoffRoundedIcon sx={{ fontSize: 14 }} />}
                label="이번 주 첫 일정"
                todo={notable.firstOfWeek}
                isDark={isDark}
            />
            <NotableRow
                tone="amber"
                icon={<FlagRoundedIcon sx={{ fontSize: 14 }} />}
                label="이번 주 마지막 일정"
                todo={notable.lastOfWeek}
                isDark={isDark}
            />
            <NotableRow
                tone="green"
                icon={<HourglassBottomRoundedIcon sx={{ fontSize: 14 }} />}
                label="가장 긴 일정"
                todo={notable.longest}
                isDark={isDark}
                showDuration
            />
        </Stack>
    );
}
