import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { getGroupMeta } from "../../utils/groupTasksByDueDate.js";

/**
 * Sticky 그룹 헤더. 클릭 시 collapse 토글.
 * 색상 dot + 제목 + 부제목 + 카운트.
 */
export default function TaskGroupHeader({ groupId, count, collapsed, onToggle }) {
    const meta = getGroupMeta(groupId);
    return (
        <Box
            onClick={onToggle}
            sx={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 2.25,
                py: 1.25,
                bgcolor: "var(--plando-surface-alt)",
                borderBottom: "1px solid",
                borderColor: "divider",
                cursor: "pointer",
                userSelect: "none",
                "&:hover": { bgcolor: "var(--plando-surface-low)" },
            }}
        >
            <ChevronRightRoundedIcon
                sx={{
                    fontSize: 14,
                    color: "text.disabled",
                    transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                    transition: "transform var(--plando-dur-fast) var(--plando-ease)",
                }}
            />
            <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: meta.color }} />
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                {meta.title}
            </Typography>
            <Box
                sx={{
                    px: 0.875,
                    py: 0.125,
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "text.disabled",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {count}
            </Box>
            <Box sx={{ flex: 1 }} />
        </Box>
    );
}
