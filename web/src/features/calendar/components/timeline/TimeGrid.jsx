import React from "react";
import { Box, Typography } from "@mui/material";
import { HOURS, HOUR_HEIGHT, minToPx, GRID_LABEL_SX, fmtAmPm } from "./timelineConstants.js";

export default function TimeGrid({ isDark, nowMin = null, gridLineLeft = 52 }) {
    return (
        <>
            {HOURS.map((h) => (
                <Box key={h} sx={{ position: "absolute", top: h * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT }}>
                    <Box sx={{
                        position: "absolute", top: 0, left: gridLineLeft, right: 0,
                        height: "0.5px",
                        bgcolor: "var(--plando-divider)",
                        opacity: 0.5,
                    }} />
                    <Typography sx={{ ...GRID_LABEL_SX, mt: h === 0 ? "2px" : "-6px" }}>
                        {fmtAmPm(h * 60)}
                    </Typography>
                </Box>
            ))}

            {nowMin != null && (
                <Box sx={{
                    position: "absolute",
                    top: minToPx(nowMin),
                    left: 0, right: 0,
                    zIndex: 4,
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                }}>
                    {/* 왼쪽 dot */}
                    <Box sx={{
                        position: "absolute",
                        left: gridLineLeft - 3,
                        width: 5, height: 5,
                        borderRadius: "var(--plando-radius-pill)",
                        bgcolor: "var(--plando-red)",
                    }} />

                    {/* 선 — dot부터 뱃지 앞까지 */}
                    <Box sx={{
                        position: "absolute",
                        left: gridLineLeft,
                        right: 60,
                        height: "1.5px",
                        bgcolor: "var(--plando-red)",
                    }} />

                    {/* 시간 뱃지 — 선 중앙에 걸침 */}
                    <Box sx={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        px: "6px", py: "1.5px",
                        bgcolor: "var(--plando-red)",
                        borderRadius: "var(--plando-radius-sm)",
                    }}>
                        <Typography sx={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#fff",
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                        }}>
                            {fmtAmPm(nowMin)}
                        </Typography>
                    </Box>
                </Box>
            )}
        </>
    );
}
