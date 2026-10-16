import React from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import Press from "../../../../shared/ui/primitives/Press.jsx";

export default function MobileCalendarMonthHeader({
    year,
    month,
    onPrev,
    onNext,
    onToday,
    isToday = false,
    trailing = null,
}) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 2.5,
                pt: 1.25,
                pb: 1,
            }}
        >
            {/* Left: title + 오늘 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
                    <Typography
                        sx={{
                            fontSize: 21,
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: "text.primary",
                            lineHeight: 1,
                        }}
                    >
                        {month + 1}월
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "text.disabled",
                            letterSpacing: "-0.01em",
                            lineHeight: 1,
                        }}
                    >
                        {year}년
                    </Typography>
                </Box>
                <Press
                    onClick={onToday}
                    haptic="light"
                    pressScale={0.94}
                    disabled={isToday}
                    style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        border: `1px solid ${theme.palette.divider}`,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        color: isToday ? theme.palette.text.disabled : theme.palette.text.secondary,
                        whiteSpace: "nowrap",
                    }}
                >
                    오늘
                </Press>
            </Box>

            {/* Right: arrows + trailing (segment control) */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Press
                    onClick={onPrev}
                    haptic="light"
                    pressScale={0.86}
                    style={{
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: theme.palette.text.secondary,
                    }}
                    aria-label="이전 달"
                >
                    <KeyboardArrowLeftRoundedIcon sx={{ fontSize: 20 }} />
                </Press>
                <Press
                    onClick={onNext}
                    haptic="light"
                    pressScale={0.86}
                    style={{
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: theme.palette.text.secondary,
                    }}
                    aria-label="다음 달"
                >
                    <KeyboardArrowRightRoundedIcon sx={{ fontSize: 20 }} />
                </Press>
                {trailing}
            </Box>
        </Box>
    );
}
