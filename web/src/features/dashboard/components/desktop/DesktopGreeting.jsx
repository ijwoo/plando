import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { getGreeting } from "../../utils/dashboardUtils.js";

/**
 * Desktop greeting row — Phase 12.
 * 날짜 pill + 컬러 강조 카운트 헤드라인 + 필터/새 할 일 액션.
 * Phase 11의 4 KPI 칩을 헤드라인 문장으로 흡수.
 */
export default function DesktopGreeting({
    userName,
    todayDueCount,
    todayInProgressCount,
}) {
    const theme = useTheme();
    const dateLabel = formatDateLabel(new Date());

    return (
        <Stack
            direction="row"
            alignItems="flex-end"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 0.5 }}
        >
            <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.75 }}>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            px: 1.25,
                            py: 0.5,
                            borderRadius: 999,
                            bgcolor: "var(--plando-primary-soft)",
                            color: "primary.main",
                            fontSize: "var(--plando-type-label-size)",
                            fontWeight: "var(--plando-type-label-weight)",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {dateLabel}
                    </Box>
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-caption-size)",
                            fontWeight: "var(--plando-type-caption-weight)",
                            color: "text.secondary",
                        }}
                    >
                        {getGreeting()}{userName ? `, ${userName} 님` : ""}
                    </Typography>
                </Stack>
                <Typography
                    sx={{
                        fontSize: "var(--plando-type-display-size)",
                        fontWeight: "var(--plando-type-display-weight)",
                        lineHeight: "var(--plando-type-display-lh)",
                        letterSpacing: "var(--plando-type-display-ls)",
                        color: "text.primary",
                    }}
                >
                    오늘 <Box component="span" sx={{ color: theme.palette.primary.main }}>{todayDueCount}건</Box>이 마감,{" "}
                    <Box component="span" sx={{ color: theme.palette.warning.main }}>{todayInProgressCount}건</Box>이 진행 중이에요
                </Typography>
            </Box>
        </Stack>
    );
}

function formatDateLabel(date) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${days[date.getDay()]}요일 · ${date.getMonth() + 1}월 ${date.getDate()}일`;
}
