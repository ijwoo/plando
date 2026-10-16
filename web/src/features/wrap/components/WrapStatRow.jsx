import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const TONE_PRESETS = {
    amber:  { bg: "#FFF6E0", iconBg: "#FFB020", color: "#FFFFFF" },
    purple: { bg: "#F1ECFF", iconBg: "#7C5CFF", color: "#FFFFFF" },
    green:  { bg: "#E7F8F1", iconBg: "#10B981", color: "#FFFFFF" },
    blue:   { bg: "#E8F0FE", iconBg: "#2D6EF5", color: "#FFFFFF" },
};

const DARK_TONE_PRESETS = {
    amber:  { bg: "rgba(255,176,32,0.14)",  iconBg: "rgba(255,176,32,0.28)",  color: "#FFCB57" },
    purple: { bg: "rgba(124,92,255,0.14)",  iconBg: "rgba(124,92,255,0.28)",  color: "#C7B5FF" },
    green:  { bg: "rgba(16,185,129,0.14)",  iconBg: "rgba(16,185,129,0.28)",  color: "#5EE0B6" },
    blue:   { bg: "rgba(45,110,245,0.16)",  iconBg: "rgba(45,110,245,0.32)",  color: "#A6C2FF" },
};

/**
 * 토스 페이먼츠 row 톤 — 컬러 박스 아이콘 + 라벨/값.
 * 좌측: 컬러 박스 안 아이콘. 우측: 라벨 위 / 값 아래.
 */
export default function WrapStatRow({ icon, label, value, valueSub, tone = "blue" }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const preset = (isDark ? DARK_TONE_PRESETS : TONE_PRESETS)[tone] || TONE_PRESETS.blue;

    return (
        <Stack direction="row" alignItems="center" spacing={1.75}>
            {/* 컬러 아이콘 박스 */}
            <Box
                sx={{
                    width: 40,
                    height: 40,
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
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        background: preset.iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        lineHeight: 1,
                        boxShadow: isDark ? "none" : "0 1px 2px rgba(15,23,42,0.08)",
                    }}
                >
                    {icon}
                </Box>
            </Box>

            {/* 라벨/값 */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: isDark
                            ? "rgba(255,255,255,0.78)"
                            : "var(--plando-text-secondary)",
                        letterSpacing: "-0.01em",
                    }}
                >
                    {label}
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={0.5}>
                    <Typography
                        sx={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: isDark ? "#F8FAFC" : "var(--plando-text-primary)",
                            letterSpacing: "-0.015em",
                        }}
                    >
                        {value}
                    </Typography>
                    {valueSub ? (
                        <Typography
                            sx={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: isDark
                                    ? "rgba(255,255,255,0.6)"
                                    : "var(--plando-text-secondary)",
                            }}
                        >
                            {valueSub}
                        </Typography>
                    ) : null}
                </Stack>
            </Stack>
        </Stack>
    );
}
