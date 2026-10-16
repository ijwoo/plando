import React from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { softOn, statusColor } from "../../../../shared/ui/tone.js";
import { EVENT_LEFT, EVENT_RIGHT_PAD } from "./timelineConstants.js";
import { calcBlockGeometry } from "./eventBlockGeometry.js";

const COL_GAP_WEEK = 1;

/** 상태 accent — tone.js 단일 소스(알 수 없는 상태는 danger로 폴백). */
function useAccent(status) {
    const theme = useTheme();
    const base = statusColor(theme, status);
    return { color: base, soft: softOn(theme, base, 0.9) };
}

/**
 * 주 뷰용 컴팩트 이벤트 블록.
 * - soft 배경 + 좌측 accent bar + 제목만 (좁은 컬럼 최적화)
 */
export default function WeekEventBlock({
    item, ghost = false, overrideTop, overrideDur,
    isDimmed = false, onTouchStart, onClick,
    eventLeft = EVENT_LEFT, eventRightPad = EVENT_RIGHT_PAD,
}) {
    const { _invalid } = item;
    const { top, height: heightPx, leftCss, widthCss, zIndex } = calcBlockGeometry(item, {
        ghost, overrideTop, overrideDur, eventLeft, eventRightPad, colGap: COL_GAP_WEEK,
    });

    const res = item.resource ?? {};
    const accent = useAccent(res.status);

    return (
        <Box
            data-ev={ghost ? undefined : "1"}
            onTouchStart={ghost ? undefined : onTouchStart}
            onClick={ghost ? undefined : onClick}
            sx={{
                position: "absolute",
                top,
                height: Math.max(heightPx, 18),
                left: leftCss,
                width: widthCss,
                zIndex,
                opacity: isDimmed ? 0.15 : 1,
                overflow: "hidden",
                borderRadius: "5px",
                bgcolor: accent.soft,
                boxShadow: ghost ? "var(--plando-shadow-3)" : "var(--plando-elev-2)",
                transform: ghost ? "scale(1.04)" : "none",
                transition: ghost ? "none" : "transform var(--plando-dur-fast) var(--plando-ease)",
                cursor: "pointer",
                "&:active": ghost ? {} : { transform: "scale(0.97)" },
                ...(_invalid && {
                    backgroundImage: `repeating-linear-gradient(
                        -45deg, transparent, transparent 3px,
                        var(--plando-surface-faint) 3px, var(--plando-surface-faint) 6px
                    )`,
                }),
            }}
        >
            <Box sx={{
                position: "absolute",
                left: 2, top: 3, bottom: 3,
                width: 2.5,
                bgcolor: accent.color,
                borderRadius: "var(--plando-radius-pill)",
            }} />
            <Typography sx={{
                fontSize: 9.5,
                fontWeight: 600,
                color: "var(--plando-text-primary)",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                pl: "7px",
                pr: "3px",
                pt: "2px", pb: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: heightPx >= 36 ? 2 : 1,
                WebkitBoxOrient: "vertical",
                wordBreak: "break-all",
            }}>
                {item.title}
            </Typography>
        </Box>
    );
}
