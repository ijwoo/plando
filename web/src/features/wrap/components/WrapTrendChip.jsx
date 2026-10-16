import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";

/**
 * 지난주 대비 변화량 chip.
 * 증가: primary 톤 / 감소: 회색 톤 / 동일: 회색.
 * size: "sm" | "md"
 */
export default function WrapTrendChip({ delta, suffix = "", size = "sm" }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const isUp = delta > 0;
    const isSame = delta === 0;

    const fontSize = size === "md" ? 12.5 : 11.5;
    const padding = size === "md" ? "5px 10px 5px 8px" : "3px 8px 3px 6px";
    const iconSize = size === "md" ? 13 : 12;

    let bg, color, icon;
    if (isSame) {
        bg = isDark ? "rgba(255,255,255,0.06)" : "var(--plando-gray-soft)";
        color = isDark ? "rgba(255,255,255,0.55)" : "var(--plando-text-secondary)";
        icon = <RemoveRoundedIcon sx={{ fontSize: iconSize }} />;
    } else if (isUp) {
        bg = isDark ? "rgba(45,110,245,0.18)" : "var(--plando-primary-soft)";
        color = "var(--plando-primary)";
        icon = <ArrowUpwardRoundedIcon sx={{ fontSize: iconSize }} />;
    } else {
        bg = isDark ? "rgba(255,255,255,0.06)" : "var(--plando-gray-soft)";
        color = isDark ? "rgba(255,255,255,0.55)" : "var(--plando-text-secondary)";
        icon = <ArrowDownwardRoundedIcon sx={{ fontSize: iconSize }} />;
    }

    return (
        <Stack
            direction="row"
            alignItems="center"
            spacing={0.25}
            sx={{
                display: "inline-flex",
                background: bg,
                color,
                padding,
                borderRadius: 999,
            }}
        >
            {icon}
            <Typography
                sx={{
                    fontSize,
                    fontWeight: 800,
                    letterSpacing: "-0.01em",
                    lineHeight: 1,
                }}
            >
                {Math.abs(delta)}{suffix}
            </Typography>
        </Stack>
    );
}
