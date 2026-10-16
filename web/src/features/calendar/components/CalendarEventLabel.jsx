import React from "react";
import { Box, Typography } from "@mui/material";
import { formatTimeAmPm } from "../../../shared/utils/formatters.js";
import moment from "moment";

export default function CalendarEventLabel({ event, firstEventId, isMobile = false }) {
    const isDemo = String(event?.id) === String(firstEventId);
    const timeStr = !event.allDay && event.start ? formatTimeAmPm(moment(event.start).format("HH:mm")) : null;

    return (
        <Box
            data-tour={isDemo ? "calendar-event-demo" : undefined}
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                minWidth: 0,
            }}
        >
            {timeStr && (
                <Typography
                    component="span"
                    sx={{
                        fontSize: isMobile ? 9 : 10,
                        fontWeight: 600,
                        opacity: 0.75,
                        flexShrink: 0,
                    }}
                >
                    {timeStr}
                </Typography>
            )}
            <Typography
                component="span"
                sx={{
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                }}
            >
                {event.title}
            </Typography>
        </Box>
    );
}