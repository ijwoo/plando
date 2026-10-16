import React, { useRef, useEffect } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { softOn, statusColor } from "../../../../shared/ui/tone.js";
import { TIME_COL_WIDTH } from "../timeline/timelineConstants.js";

const PREVIEW_COUNT = 1;
const COLLAPSE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * 주 뷰 상단 종일 이벤트 행.
 * - 본체 horizontal scroll과 sync (allDayRef.scrollLeft)
 * - 미리보기 1개 + Collapse로 나머지 펼침
 *
 * @param {{
 *   days: Date[],
 *   buckets: Array<{ allDay: any[], timed: any[] }>,
 *   expanded: boolean,
 *   onToggle: () => void,
 *   onSelectEvent?: (ev) => void,
 *   bodyHScrollRef: React.RefObject,
 *   innerWidth: string,     // 본체 inner width와 동일
 *   cellWPercent: string,   // 본체 cellWPercent와 동일
 * }} props
 */
export default function AllDayRow({
    days, buckets, expanded, onToggle, onSelectEvent,
    bodyHScrollRef, innerWidth, cellWPercent,
}) {
    const allDayRef = useRef(null);

    useEffect(() => {
        const body = bodyHScrollRef.current;
        if (!body) return;
        const onScroll = () => {
            if (allDayRef.current) {
                allDayRef.current.scrollLeft = body.scrollLeft;
            }
        };
        body.addEventListener("scroll", onScroll);
        return () => body.removeEventListener("scroll", onScroll);
    }, [bodyHScrollRef]);

    const max = Math.max(...buckets.map((b) => b.allDay.length));
    const remaining = Math.max(0, max - PREVIEW_COUNT);
    const showToggle = max > PREVIEW_COUNT;

    return (
        <Box sx={{
            display: "flex",
            bgcolor: "var(--plando-surface)",
            boxShadow: "var(--plando-elev-2)",
            position: "relative",
            zIndex: 1,
        }}>
            <Box sx={{
                width: TIME_COL_WIDTH, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                py: "var(--plando-space-1)",
            }}>
                {showToggle ? (
                    <Typography
                        onClick={onToggle}
                        sx={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            color: "var(--plando-primary)",
                            cursor: "pointer",
                            "&:active": { opacity: 0.6 },
                        }}
                    >
                        {expanded ? "접기" : `+${remaining}`}
                    </Typography>
                ) : (
                    <Typography sx={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: "var(--plando-text-disabled)",
                    }}>
                        종일
                    </Typography>
                )}
            </Box>
            <Box
                ref={allDayRef}
                sx={{
                    flex: 1, minWidth: 0,
                    overflowX: "hidden",
                    overflowY: "hidden",
                }}
            >
                <Box sx={{ display: "flex", width: innerWidth, py: "var(--plando-space-1)" }}>
                    {days.map((d, i) => (
                        <Box key={i} sx={{
                            width: cellWPercent,
                            display: "flex", flexDirection: "column",
                            gap: "2px",
                            px: "1px",
                        }}>
                            {/* 미리보기 */}
                            {buckets[i].allDay.slice(0, PREVIEW_COUNT).map((ev) => (
                                <MiniAllDayChip key={ev.id} event={ev} onClick={() => onSelectEvent?.(ev)} />
                            ))}
                            {/* 펼침 */}
                            <Collapse in={expanded} timeout={260} easing={COLLAPSE_EASE}>
                                <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    {buckets[i].allDay.slice(PREVIEW_COUNT).map((ev) => (
                                        <MiniAllDayChip key={ev.id} event={ev} onClick={() => onSelectEvent?.(ev)} />
                                    ))}
                                </Box>
                            </Collapse>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

/** 종일 이벤트용 컴팩트 칩 — 상태 soft 배경 + 좌측 pill bar */
function MiniAllDayChip({ event, onClick }) {
    const theme = useTheme();
    const base = statusColor(theme, event.resource?.status);
    const accent = { color: base, soft: softOn(theme, base, 0.9) };
    return (
        <Box
            onClick={onClick}
            sx={{
                position: "relative",
                bgcolor: accent.soft,
                borderRadius: "var(--plando-radius-sm)",
                pl: "8px",
                pr: "4px",
                py: "2px",
                cursor: "pointer",
                overflow: "hidden",
                "&:active": { opacity: 0.7 },
                "&::before": {
                    content: '""',
                    position: "absolute",
                    left: 2, top: 3, bottom: 3,
                    width: 2.5,
                    bgcolor: accent.color,
                    borderRadius: "var(--plando-radius-pill)",
                },
            }}
        >
            <Typography sx={{
                fontSize: 9,
                fontWeight: 600,
                color: "var(--plando-text-primary)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
            }}>
                {event.title}
            </Typography>
        </Box>
    );
}
