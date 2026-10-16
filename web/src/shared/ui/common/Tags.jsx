import React from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    getPriorityLabel,
    getStatusLabel,
    priorityColor,
    readableOn,
    softOn,
    statusColor,
} from "../tone.js";

/**
 * 상태/우선순위 태그 — 앱 전체의 단일 렌더러.
 *
 * 시각 언어는 데스크탑 TaskRow의 StatusPill/PriorityPill을 기준으로 삼았다.
 * (dot + 라벨 / soft alpha 배경 / pill radius) — 가장 최근에 다듬은 형태이자
 * BoardCard MiniPill·Chips.PriorityPill이 이미 같은 언어의 축소판이라
 * 이걸 표준으로 올리면 나머지가 size 프롭만으로 흡수된다.
 *
 * 공통 props:
 *   size:    "xs" | "sm" | "md"                      (기본 "sm")
 *   variant: "dot" | "soft" | "solid" | "outlined"   (기본 "soft")
 *   color:   base 색 override — 워크스페이스 커스텀 상태의 colorOf(key) hex를 넘긴다
 *   label:   라벨 override — 커스텀 상태의 label(key)를 넘긴다
 *   showDot: soft/outlined에서 dot 표시 여부 (기본 true)
 */

const SIZES = {
    xs: { fontSize: 10.5, px: 0.875, py: 0.125, dot: 4, soloDot: 6, gap: 0.375 },
    sm: { fontSize: 11.5, px: 1.125, py: 0.375, dot: 5, soloDot: 7, gap: 0.625 },
    md: { fontSize: 12.5, px: 1.25, py: 0.5, dot: 6, soloDot: 9, gap: 0.75 },
};

function ColorTag({ base, label, size = "sm", variant = "soft", showDot = true, sx }) {
    const theme = useTheme();
    const s = SIZES[size] ?? SIZES.sm;

    if (variant === "dot") {
        return (
            <Box
                sx={{
                    width: s.soloDot,
                    height: s.soloDot,
                    borderRadius: "50%",
                    flexShrink: 0,
                    bgcolor: base,
                    ...sx,
                }}
            />
        );
    }

    const isSolid = variant === "solid";
    const isOutlined = variant === "outlined";
    const dot = showDot && !isSolid;

    return (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: s.gap,
                px: s.px,
                py: s.py,
                borderRadius: 999,
                fontSize: s.fontSize,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1.4,
                whiteSpace: "nowrap",
                minWidth: 0,
                ...(isSolid
                    ? { bgcolor: base, color: readableOn(base) }
                    : isOutlined
                        ? {
                            bgcolor: "transparent",
                            border: "1px solid",
                            borderColor: softOn(theme, base, 1.5),
                            color: "text.primary",
                        }
                        : { bgcolor: softOn(theme, base), color: base }),
                ...sx,
            }}
        >
            {dot && (
                <Box sx={{ width: s.dot, height: s.dot, borderRadius: 999, bgcolor: base, flexShrink: 0 }} />
            )}
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {label}
            </Box>
        </Box>
    );
}

/**
 * 상태 태그. 커스텀 워크플로 상태는 StatusContext의 colorOf/label 결과를
 * color/label 프롭으로 넘기면 그대로 쓰고, 없으면 tone.js statusColor()로 폴백한다
 * (알 수 없는 키 → danger, 모바일과 동일).
 */
export function StatusTag({ status, color, label, ...rest }) {
    const theme = useTheme();
    return <ColorTag base={color ?? statusColor(theme, status)} label={label ?? getStatusLabel(status)} {...rest} />;
}

/** 우선순위 태그. HIGH=빨강 / MEDIUM=주황 / LOW(및 미지정)=테마 primary. */
export function PriorityTag({ priority, color, label, ...rest }) {
    const theme = useTheme();
    return <ColorTag base={color ?? priorityColor(theme, priority)} label={label ?? getPriorityLabel(priority)} {...rest} />;
}

export default StatusTag;
