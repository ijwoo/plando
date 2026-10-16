// src/components/common/Chips.jsx
import React from "react";
import { Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { getStatusLabel, getPriorityLabel, priorityColor, softOn, statusColor } from "../tone.js";
import { PriorityTag } from "./Tags.jsx";

/**
 * 레거시 MUI Chip 형태의 상태/우선순위 칩.
 * 색 해석은 tone.js의 statusColor/priorityColor 단일 소스를 쓰고, 새 화면은
 * Tags.jsx의 StatusTag/PriorityTag를 쓴다.
 */
export function StatusChip({ status, size = "small", variant = "outlined", sx }) {
    const theme = useTheme();
    const label = getStatusLabel(status);
    const base = statusColor(theme, status);

    return (
        <Chip
            size={size}
            label={label}
            variant={variant}
            sx={{
                fontWeight: 800,
                bgcolor: softOn(theme, base, 0.7),
                borderColor: softOn(theme, base, 1.5),
                borderWidth: 1,
                color: "text.primary",
                ...sx,
            }}
        />
    );
}

export function PriorityChip({ priority, size = "small", variant = "outlined", sx }) {
    const theme = useTheme();
    const label = getPriorityLabel(priority);
    const base = priorityColor(theme, priority);

    return (
        <Chip
            size={size}
            label={label}
            variant={variant}
            sx={{
                fontWeight: 800,
                bgcolor: softOn(theme, base, 0.7),
                borderColor: softOn(theme, base, 1.5),
                borderWidth: 1,
                color: "text.primary",
                ...sx,
            }}
        />
    );
}

/**
 * 리디자인 표준 우선순위 pill. 이제 PriorityTag(size="xs", dot 없음)의 얇은 래퍼다.
 * 기존 호출부(19개 파일)를 건드리지 않기 위해 이름만 유지.
 */
export function PriorityPill({ priority, sx }) {
    return <PriorityTag priority={priority} size="xs" showDot={false} sx={{ fontWeight: 700, ...sx }} />;
}
