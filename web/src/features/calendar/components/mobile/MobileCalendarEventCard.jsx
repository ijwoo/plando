import React from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import moment from "moment";

import { statusColor } from "../../../../shared/ui/tone.js";
import Press from "../../../../shared/ui/primitives/Press.jsx";

export default function MobileCalendarEventCard({ event, onClick }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const resource = event?.resource ?? {};

    const statusHex = statusColor(theme, resource.status);

    const timeStr = event.start
        ? moment(event.start).format("HH:mm") === "00:00"
            ? "종일"
            : moment(event.start).format("HH:mm")
        : null;

    // 메모 본문은 TodoResponseDto의 `content` 필드다 — `description`은 서버에 없는 이름이라
    // 미리보기 줄이 한 번도 뜬 적이 없었다 (일 뷰 DayEventBlock은 처음부터 content를 읽는다).
    const description = resource.content?.trim() || null;

    return (
        <Press
            onClick={onClick}
            haptic="light"
            pressScale={0.99}
            style={{
                display: "flex",
                gap: 12,
                padding: "11px 6px",
                alignItems: "flex-start",
            }}
        >
            <Box
                sx={{
                    width: 4,
                    alignSelf: "stretch",
                    borderRadius: 3,
                    bgcolor: statusHex,
                    flexShrink: 0,
                    minHeight: 32,
                }}
            />

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "text.primary",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {event?.title}
                </Typography>
                {description && (
                    <Typography
                        sx={{
                            fontSize: 13,
                            color: isDark ? "rgba(255,255,255,0.5)" : "text.secondary",
                            mt: 0.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1.3,
                        }}
                    >
                        {description}
                    </Typography>
                )}
            </Box>

            {timeStr && (
                <Typography
                    sx={{
                        fontSize: 13,
                        color: "text.disabled",
                        fontWeight: 600,
                        flexShrink: 0,
                        pt: "1px",
                    }}
                >
                    {timeStr}
                </Typography>
            )}
        </Press>
    );
}
