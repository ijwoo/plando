import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { hideScrollbarSx } from "../../../shared/ui/glassSx.js";

/**
 * 이번 주 마일스톤/뱃지 — 작은 chip row.
 * 가로 스크롤 가능 (chip 4개 넘어가면).
 */
export default function WrapMilestones({ milestones = [] }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const chipBg = isDark ? "rgba(255,255,255,0.04)" : "var(--plando-surface-alt)";
    const chipBorder = isDark ? "rgba(255,255,255,0.06)" : "var(--plando-divider)";

    return (
        <Box
            sx={{
                display: "flex",
                gap: 1,
                overflowX: "auto",
                pb: 0.5,
                mx: -0.5,
                px: 0.5,
                ...hideScrollbarSx,
            }}
        >
            {milestones.map((m) => (
                <Stack
                    key={m.id}
                    direction="row"
                    alignItems="center"
                    spacing={0.75}
                    sx={{
                        flexShrink: 0,
                        background: chipBg,
                        border: `1px solid ${chipBorder}`,
                        borderRadius: 999,
                        padding: "8px 12px 8px 10px",
                    }}
                >
                    <Box sx={{ fontSize: 14, lineHeight: 1 }}>{m.emoji}</Box>
                    <Typography
                        sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                            letterSpacing: "-0.01em",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {m.label}
                    </Typography>
                </Stack>
            ))}
        </Box>
    );
}
