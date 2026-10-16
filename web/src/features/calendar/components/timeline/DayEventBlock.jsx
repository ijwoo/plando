import React from "react";
import { Box, Typography } from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import moment from "moment";
import { formatTimeAmPm } from "../../../../shared/utils/formatters.js";
import { useTheme } from "@mui/material/styles";
import { softOn, statusColor } from "../../../../shared/ui/tone.js";
import { pxToMin, fmtHHmm, EVENT_LEFT, EVENT_RIGHT_PAD } from "./timelineConstants.js";
import { calcBlockGeometry } from "./eventBlockGeometry.js";
import AssigneeAvatars from "./AssigneeAvatars.jsx";

const COL_GAP = 3;
const H_COMPACT = 36;
const H_RICH = 80;

/** 상태 accent — tone.js 단일 소스(알 수 없는 상태는 danger로 폴백). */
function useAccent(status) {
    const theme = useTheme();
    const base = statusColor(theme, status);
    return { color: base, soft: softOn(theme, base, 0.9) };
}

/**
 * 일 뷰용 풍부한 이벤트 카드 (Toss 톤).
 * - surface 배경 + 좌측 accent pill bar + elev shadow
 * - 높이 단계별 정보 표시:
 *   - 컴팩트(<36px or _ncol>=3): 제목만
 *   - 일반(36px+): 제목 + 시간 + 우측 아바타
 *   - rich(80px+): + 메모/장소
 */
export default function DayEventBlock({
    item, ghost = false, overrideTop, overrideDur,
    isDimmed = false, onTouchStart, onClick,
    eventLeft = EVENT_LEFT, eventRightPad = EVENT_RIGHT_PAD,
}) {
    const { _ncol, _invalid } = item;
    const { top, height: heightPx, leftCss, widthCss, zIndex } = calcBlockGeometry(item, {
        ghost, overrideTop, overrideDur, eventLeft, eventRightPad, colGap: COL_GAP,
    });

    const res = item.resource ?? {};
    const accent = useAccent(res.status);

    const isNarrow = _ncol >= 3;
    const isCompact = heightPx < H_COMPACT || isNarrow;
    const showTime = !isCompact;
    const showExtra = !isNarrow && heightPx >= H_RICH;

    const sM = moment(item.start), eM = moment(item.end);
    const timeText = ghost
        ? `${formatTimeAmPm(fmtHHmm(pxToMin(overrideTop)))} – ${formatTimeAmPm(fmtHHmm(pxToMin(overrideTop) + overrideDur))}`
        : `${formatTimeAmPm(sM.format("HH:mm"))} – ${formatTimeAmPm(eM.format("HH:mm"))}`;

    const memo = res.content?.trim();
    const location = res.locationName?.trim();
    const assignees = res.assignees;
    const hasAssignees = Array.isArray(assignees) && assignees.length > 0;

    return (
        <Box
            data-ev={ghost ? undefined : "1"}
            onTouchStart={ghost ? undefined : onTouchStart}
            onClick={ghost ? undefined : onClick}
            sx={{
                position: "absolute",
                top,
                height: Math.max(heightPx, 24),
                left: leftCss,
                width: widthCss,
                zIndex,
                opacity: isDimmed ? 0.15 : 1,
                transition: ghost
                    ? "none"
                    : `opacity var(--plando-dur-fast) var(--plando-ease),
                       transform var(--plando-dur-fast) var(--plando-ease)`,
                transform: ghost ? "scale(1.03)" : "none",
                overflow: "hidden",
                borderRadius: "var(--plando-radius-md)",
                bgcolor: "var(--plando-surface)",
                boxShadow: ghost
                    ? "var(--plando-shadow-raised)"
                    : "var(--plando-shadow-card)",
                "&:active": ghost ? {} : {
                    transform: "scale(0.98)",
                    boxShadow: "var(--plando-shadow-1)",
                },
                ...(_invalid && {
                    backgroundImage: `repeating-linear-gradient(
                        -45deg, transparent, transparent 4px,
                        var(--plando-surface-faint) 4px, var(--plando-surface-faint) 8px
                    )`,
                }),
            }}
        >
            {/* 좌측 accent pill bar */}
            <Box sx={{
                position: "absolute",
                left: 4, top: 6, bottom: 6,
                width: 3,
                bgcolor: accent.color,
                borderRadius: "var(--plando-radius-pill)",
            }} />

            {/* 콘텐츠 */}
            <Box sx={{
                pl: "14px",
                pr: isNarrow ? "var(--plando-space-1)" : "var(--plando-space-3)",
                py: isCompact ? "4px" : "6px",
                height: "100%",
                display: "flex",
                flexDirection: isCompact ? "row" : "column",
                alignItems: isCompact ? "center" : "flex-start",
                gap: isCompact ? "var(--plando-space-1)" : 0,
                overflow: "hidden",
            }}>
                {isCompact ? (
                    <Typography sx={titleSx({ isNarrow, isCompact: true })} noWrap>
                        {item.title}
                    </Typography>
                ) : (
                    <Box sx={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", minWidth: 0 }}>
                        <Typography sx={titleSx({ isNarrow, isCompact: false })} noWrap>
                            {item.title}
                        </Typography>
                        {hasAssignees && <AssigneeAvatars assignees={assignees} />}
                    </Box>
                )}

                {showTime && (
                    <Typography sx={{
                        fontSize: 11.5,
                        fontWeight: 400,
                        color: "var(--plando-text-tertiary)",
                        mt: "2px",
                        whiteSpace: "nowrap",
                    }}>
                        {timeText}
                    </Typography>
                )}

                {showExtra && (memo || location) && (
                    <Box sx={{ mt: "var(--plando-space-1)", width: "100%", overflow: "hidden" }}>
                        {memo && (
                            <Typography sx={{
                                fontSize: 11,
                                color: "var(--plando-text-tertiary)",
                                fontWeight: 400,
                                lineHeight: 1.4,
                                display: "-webkit-box",
                                WebkitLineClamp: heightPx >= 100 ? 2 : 1,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}>
                                {memo}
                            </Typography>
                        )}
                        {location && !memo && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                <PlaceOutlinedIcon sx={{ fontSize: 12, color: "var(--plando-text-disabled)" }} />
                                <Typography sx={{
                                    fontSize: 11,
                                    color: "var(--plando-text-tertiary)",
                                    fontWeight: 400,
                                }} noWrap>
                                    {location}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

function titleSx({ isNarrow, isCompact }) {
    return {
        fontSize: isNarrow ? 10 : (isCompact ? 11.5 : 13),
        fontWeight: 600,
        color: "var(--plando-text-primary)",
        lineHeight: 1.3,
        letterSpacing: "-0.01em",
        flex: 1,
        minWidth: 0,
    };
}
