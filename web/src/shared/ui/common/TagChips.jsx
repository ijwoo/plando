import React from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/** 할 일 목록/카드용 태그 칩 리스트. tags: [{id,name,color}]. max 초과분은 +N. */
export default function TagChips({ tags, max = 3, size = "sm" }) {
    if (!Array.isArray(tags) || tags.length === 0) return null;
    const shown = tags.slice(0, max);
    const extra = tags.length - shown.length;
    const fs = size === "sm" ? 10.5 : 11.5;
    const dot = size === "sm" ? 6 : 7;
    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0, overflow: "hidden" }}>
            {shown.map((t) => (
                <Box key={t.id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.375, px: 0.75, py: 0.125, borderRadius: 999, minWidth: 0, maxWidth: 120, bgcolor: alpha(t.color || "#94A3B8", 0.16) }}>
                    <Box sx={{ width: dot, height: dot, borderRadius: 999, bgcolor: t.color || "#94A3B8", flexShrink: 0 }} />
                    {/* 긴 태그명이 세로로 깨지지 않게 한 줄 말줄임 */}
                    <Typography sx={{ fontSize: fs, fontWeight: 700, color: "text.secondary", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{t.name}</Typography>
                </Box>
            ))}
            {extra > 0 && (
                <Typography sx={{ fontSize: fs, fontWeight: 700, color: "text.disabled", flexShrink: 0 }}>+{extra}</Typography>
            )}
        </Box>
    );
}
