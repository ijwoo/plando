import React from "react";
import { Box } from "@mui/material";
import { PRIORITY_LABEL as _PL, STATUS_LABEL as _SL } from "../../../shared/ui/tone.js";

/**
 * Chat-feature 공유 헬퍼.
 *
 * Phase 7 redesign 으로 다음은 모두 제거됨 — 호출처에서 표준 primitives / MUI icons 사용:
 *   I (자체 SVG 아이콘 12개)  → MUI Rounded 아이콘으로 대체
 *   T (rgba 색상 객체 2벌)    → plandoTokens.css 변수로 대체
 *   Glass wrapper            → CardSection / Box 직접 사용
 *
 * 남은 export:
 *   - TagChip: 메시지 결과 카드 안의 작은 chip (priority/date/assignee/category)
 *   - PRIORITY: 우선순위 라벨 (high/medium/low) — backward compat
 *   - STATUS_LABEL / PRIORITY_LABEL — re-export from shared tone.js
 */

// ── Tag chip — 결과 카드 안 작은 라벨용 ────────────────────────────
export function TagChip({ label, bg, color, icon }) {
    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: bg,
                color,
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "-0.1px",
            }}
        >
            {icon && (
                <Box component="span" sx={{ display: "inline-flex", opacity: 0.85 }}>
                    {icon}
                </Box>
            )}
            {label}
        </Box>
    );
}

// ── Priority labels (backward compat for ChatParsedCard) ──────────
export const PRIORITY = {
    high:   { label: "높음" },
    medium: { label: "중간" },
    low:    { label: "낮음" },
};

export const STATUS_LABEL   = _SL;
export const PRIORITY_LABEL = _PL;
