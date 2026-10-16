import React from "react";
import { useTheme } from "@mui/material/styles";
import { priorityColor } from "../../../../shared/ui/tone.js";

/**
 * 우선순위(HIGH/MEDIUM/LOW) → 화살표 아이콘.
 * HIGH: ↑ (red) / MEDIUM: = (orange) / LOW: ↓ (primary)
 *
 * 디테일 패널의 행 라벨/Menu 항목/vchip 등 다양한 위치에서 같은 모양으로 사용.
 */
const DIR = { HIGH: "up", MEDIUM: "eq", LOW: "down" };

export default function PrioIcon({ priority }) {
    const theme = useTheme();
    const dir = DIR[priority] ?? "eq";
    // 색은 tone.js priorityColor 단일 소스 (HIGH=빨강 / MEDIUM=주황 / LOW=테마 primary)
    const color = priority ? priorityColor(theme, priority) : "currentColor";
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            {dir === "up" && (
                <path d="M8 13V4M8 4l-3 3M8 4l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {dir === "eq" && (
                <path d="M3 6h10M3 10h10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
            )}
            {dir === "down" && (
                <path d="M8 3v9M8 12l-3-3M8 12l3-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            )}
        </svg>
    );
}
