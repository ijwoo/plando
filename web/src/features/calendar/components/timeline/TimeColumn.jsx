import React, { useRef, useEffect } from "react";
import { Box } from "@mui/material";
import { HOURS, HOUR_HEIGHT, BOTTOM_PAD, TIME_COL_WIDTH, minToPx, fmtAmPm } from "./timelineConstants.js";

/**
 * 좌측 고정 시간 컬럼 (주 뷰용).
 * - 본체 vertical scroll과 sync
 * - "오전 / 12:00" 2줄 스택형 라벨
 * - 드래그 중에는 해당 시간 라벨을 primary 색으로 강조
 * - 오늘이 보일 때 현재 시각을 red로 강조
 *
 * @param {{
 *   vScrollRef: React.RefObject,
 *   createDrag?: { startMin, endMin } | null,
 *   moveDrag?: { startMin } | null,
 *   nowMin?: number | null,   // 현재 시각 (분)
 * }} props
 */
export default function TimeColumn({ vScrollRef, createDrag, moveDrag, nowMin = null }) {
    const colRef = useRef(null);

    useEffect(() => {
        const v = vScrollRef.current;
        if (!v) return;
        const onScroll = () => {
            if (colRef.current) {
                colRef.current.scrollTop = v.scrollTop;
            }
        };
        v.addEventListener("scroll", onScroll);
        return () => v.removeEventListener("scroll", onScroll);
    }, [vScrollRef]);

    return (
        <Box
            ref={colRef}
            sx={{
                width: TIME_COL_WIDTH,
                flexShrink: 0,
                overflowY: "hidden",
                overflowX: "hidden",
                bgcolor: "background.default",
            }}
        >
            <Box sx={{ position: "relative", height: 24 * HOUR_HEIGHT + BOTTOM_PAD }}>
                {HOURS.map((h) => {
                    const hourMin = h * 60;
                    const hidden = (createDrag && (
                        Math.abs(hourMin - createDrag.startMin) < 30
                        || Math.abs(hourMin - createDrag.endMin) < 30
                    )) || (moveDrag && Math.abs(hourMin - moveDrag.startMin) < 30)
                       || (nowMin != null && Math.abs(hourMin - nowMin) < 30);
                    return (
                        <StackedTimeLabel
                            key={h}
                            min={hourMin}
                            extraSx={{ opacity: hidden ? 0 : 1, transition: "opacity 0.1s" }}
                        />
                    );
                })}
                {moveDrag && <StackedTimeLabel min={moveDrag.startMin} variant="primary" />}
                {createDrag && (
                    <>
                        <StackedTimeLabel min={createDrag.startMin} variant="primary" />
                        <StackedTimeLabel min={createDrag.endMin} variant="primary" />
                    </>
                )}
                {nowMin != null && <StackedTimeLabel min={nowMin} variant="now" />}
            </Box>
        </Box>
    );
}

/** 오전 / 12:00 2줄 라벨 — 정시 또는 드래그/현재 시간 표시용 */
function StackedTimeLabel({ min, variant = "default", extraSx = {} }) {
    const [period, time] = fmtAmPm(min).split(" ");
    const color = variant === "now" ? "var(--plando-red)"
        : variant === "primary" ? "var(--plando-primary)"
        : "var(--plando-text-tertiary)";
    const zIndex = variant === "default" ? "auto" : 11;
    const fontWeight = variant === "now" ? 700 : 600;
    return (
        <Box sx={{
            position: "absolute",
            top: minToPx(min),
            mt: min === 0 ? "2px" : "-12px",
            right: 0,
            width: "100%",
            pr: 1,
            textAlign: "right",
            lineHeight: 1.1,
            zIndex,
            ...extraSx,
        }}>
            <Box sx={{ fontSize: 8.5, fontWeight: 500, color, lineHeight: 1.1, letterSpacing: "0.02em" }}>
                {period}
            </Box>
            <Box sx={{ fontSize: 10.5, fontWeight, color, lineHeight: 1.1 }}>
                {time}
            </Box>
        </Box>
    );
}
