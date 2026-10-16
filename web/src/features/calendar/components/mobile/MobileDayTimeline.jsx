import React, { useMemo, useRef, useEffect, useState } from "react";
import { Box, Collapse, Stack, Typography } from "@mui/material";
import moment from "moment";
import { hideScrollbarSx } from "../../../../shared/ui/glassSx.js";
import { sanitize, assignColumns } from "../../utils/eventLayout.js";
import {
    HOUR_HEIGHT, BOTTOM_PAD, EVENT_LEFT, EVENT_RIGHT_PAD,
    minToPx, DRAG_LABEL_SX, fmtAmPm,
} from "../timeline/timelineConstants.js";
import { TimeGrid, TimelineEventBlock, useTimelineDnD, useDateSlideAnim } from "../timeline/index.js";
import MobileCalendarEventCard from "./MobileCalendarEventCard.jsx";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function dragLabelSx(min) {
    return { ...DRAG_LABEL_SX, top: minToPx(min), mt: min === 0 ? "2px" : "-6px", color: "var(--plando-primary)" };
}

export default function MobileDayTimeline({
    date, events,
    onSelectEvent, onEventDrop, onCreateSlot,
    isDark, onSwipe,
    disableSlideAnim = false,
    onDragActiveChange,
}) {
    const scrollRef = useRef(null);
    const gridRef = useRef(null);
    const containerRef = useRef(null);
    const slideRef = useRef(null);
    useDateSlideAnim(disableSlideAnim ? { current: null } : slideRef, date);

    const isToday = moment(date).isSame(moment(), "day");
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const { allDayEvents, timedEvents } = useMemo(() => {
        const ad = [], td = [];
        (events || []).forEach((ev) => (ev.allDay ? ad : td).push(ev));
        return { allDayEvents: ad, timedEvents: td };
    }, [events]);

    const laidOut = useMemo(() => assignColumns(sanitize(timedEvents)), [timedEvents]);

    const { moveDrag, createDrag, isDragActive, onGridTouchStart, onEventTouchStart, onTouchEnd } =
        useTimelineDnD({
            scrollRef, gridRef, containerRef,
            getDateAt: () => date,
            onCreateSlot, onEventDrop, onSwipe,
        });

    useEffect(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTop = (isToday ? Math.max(now.getHours() - 1, 0) : 8) * HOUR_HEIGHT;
    }, [date]);

    // DnD 활성 여부를 부모에 알림 (3패널 스와이프 차단용)
    useEffect(() => {
        onDragActiveChange?.(isDragActive);
    }, [isDragActive, onDragActiveChange]);

    return (
        <Box ref={containerRef} sx={{
            flex: 1, minHeight: 0,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            bgcolor: "background.default",
        }}>
        <Box ref={slideRef} sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {/* ── 날짜 헤더 ── */}
            <Box sx={{ px: "var(--plando-space-5)", pt: "var(--plando-space-3)", pb: "var(--plando-space-2)" }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    {/* 날짜 원형 뱃지 (오늘이면 primary) */}
                    <Box sx={{
                        width: 40, height: 40,
                        borderRadius: "var(--plando-radius-pill)",
                        bgcolor: isToday ? "var(--plando-primary)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <Typography sx={{
                            fontSize: 20, fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: isToday ? "#fff" : "var(--plando-text-primary)",
                            lineHeight: 1,
                        }}>
                            {date.getDate()}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography sx={{
                            fontSize: "var(--plando-type-title3-size)",
                            fontWeight: "var(--plando-type-title3-weight)",
                            color: "var(--plando-text-primary)",
                            lineHeight: 1.2,
                        }}>
                            {DOW[date.getDay()]}요일
                        </Typography>
                        <Typography sx={{
                            fontSize: "var(--plando-type-caption-size)",
                            fontWeight: "var(--plando-type-caption-weight)",
                            color: "var(--plando-text-tertiary)",
                            lineHeight: 1.3,
                        }}>
                            {date.getFullYear()}년 {date.getMonth() + 1}월
                        </Typography>
                    </Box>
                </Stack>
            </Box>

            {/* ── 종일 이벤트 ── */}
            {allDayEvents.length > 0 && (
                <AllDaySection events={allDayEvents} onSelectEvent={onSelectEvent} />
            )}

            {/* ── 타임라인 ── */}
            <Box
                ref={scrollRef}
                onTouchStart={onGridTouchStart}
                onTouchEnd={onTouchEnd}
                sx={{
                    flex: 1, minHeight: 0, overflowY: "auto",
                    position: "relative",
                    WebkitOverflowScrolling: "touch",
                    ...hideScrollbarSx,
                }}
            >
                <Box ref={gridRef} sx={{ position: "relative", height: 24 * HOUR_HEIGHT + BOTTOM_PAD }}>
                    <TimeGrid isDark={isDark} nowMin={isToday ? nowMin : null} />

                    {/* 이벤트 이동 인디케이터 */}
                    {moveDrag && (
                        <Typography sx={dragLabelSx(moveDrag.startMin)}>
                            {fmtAmPm(moveDrag.startMin)}
                        </Typography>
                    )}

                    {/* 새 일정 생성 블록 */}
                    {createDrag && (() => {
                        const topPx = minToPx(createDrag.startMin);
                        const htPx = Math.max(minToPx(createDrag.endMin - createDrag.startMin), 20);
                        return (
                            <>
                                <Typography sx={dragLabelSx(createDrag.startMin)}>
                                    {fmtAmPm(createDrag.startMin)}
                                </Typography>
                                <Typography sx={dragLabelSx(createDrag.endMin)}>
                                    {fmtAmPm(createDrag.endMin)}
                                </Typography>
                                <Box sx={{
                                    position: "absolute", top: topPx, height: htPx,
                                    left: EVENT_LEFT, right: EVENT_RIGHT_PAD,
                                    bgcolor: "var(--plando-primary-soft)",
                                    border: "2px dashed var(--plando-primary)",
                                    borderRadius: "var(--plando-radius-md)", zIndex: 8,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <Typography sx={{
                                        fontSize: "var(--plando-type-caption-size)",
                                        fontWeight: "var(--plando-type-label-weight)",
                                        color: "var(--plando-primary)",
                                    }}>
                                        {fmtAmPm(createDrag.startMin)} – {fmtAmPm(createDrag.endMin)}
                                    </Typography>
                                </Box>
                            </>
                        );
                    })()}

                    {/* 이벤트 블록 */}
                    {laidOut.map((item) => (
                        <TimelineEventBlock
                            key={item.id}
                            item={item}
                            isDimmed={moveDrag?.ev.id === item.id}
                            onTouchStart={(e) => onEventTouchStart(e, item)}
                            onClick={() => onSelectEvent?.(item)}
                        />
                    ))}

                    {/* 이벤트 이동 고스트 */}
                    {moveDrag && (() => {
                        const item = laidOut.find((i) => i.id === moveDrag.ev.id);
                        if (!item) return null;
                        return (
                            <TimelineEventBlock
                                key={`ghost-${item.id}`}
                                item={{ ...item, _col: 0, _ncol: 1 }}
                                ghost
                                overrideTop={minToPx(moveDrag.startMin)}
                                overrideDur={moveDrag.dur}
                            />
                        );
                    })()}
                </Box>
            </Box>
        </Box>
        </Box>
    );
}

// ── 종일 이벤트 접기/펼치기 ──

const PREVIEW_COUNT = 1;

function AllDaySection({ events, onSelectEvent }) {
    const [expanded, setExpanded] = useState(false);
    const collapsible = events.length > PREVIEW_COUNT;
    const previewEvents = events.slice(0, PREVIEW_COUNT);
    const extraEvents = events.slice(PREVIEW_COUNT);
    const remaining = events.length - PREVIEW_COUNT;

    return (
        <Box sx={{
            mx: "var(--plando-space-4)",
            mb: "var(--plando-space-2)",
            px: "var(--plando-space-3)",
            py: "var(--plando-space-2)",
            bgcolor: "var(--plando-surface)",
            borderRadius: "var(--plando-radius-md)",
            boxShadow: "var(--plando-shadow-card)",
        }}>
            <Box sx={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                mb: "var(--plando-space-1)",
            }}>
                <Typography sx={{
                    fontSize: "var(--plando-type-caption-size)",
                    fontWeight: "var(--plando-type-label-weight)",
                    color: "var(--plando-text-tertiary)",
                }}>
                    종일 · {events.length}
                </Typography>
                {collapsible && (
                    <Typography
                        onClick={() => setExpanded((v) => !v)}
                        sx={{
                            fontSize: "var(--plando-type-caption-size)",
                            fontWeight: "var(--plando-type-label-weight)",
                            color: "var(--plando-primary)",
                            cursor: "pointer",
                            "&:active": { opacity: 0.6 },
                        }}
                    >
                        {expanded ? "접기" : `+${remaining}개 더보기`}
                    </Typography>
                )}
            </Box>
            {previewEvents.map((ev) => (
                <MobileCalendarEventCard key={ev.id} event={ev} onClick={() => onSelectEvent?.(ev)} />
            ))}
            <Collapse in={expanded} timeout={260} easing="cubic-bezier(0.32, 0.72, 0, 1)">
                <Box>
                    {extraEvents.map((ev) => (
                        <MobileCalendarEventCard key={ev.id} event={ev} onClick={() => onSelectEvent?.(ev)} />
                    ))}
                </Box>
            </Collapse>
        </Box>
    );
}
