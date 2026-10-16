import React, { useMemo } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { getGlassSx } from "../../../../shared/ui/glassSx.js";

const DAY_LABELS = ["월", "", "수", "", "금", "", "일"];
const CELL = 13;
const GAP = 4;

function getLevel(count) {
    if (!count || count === 0) return 0;
    if (count <= 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
}

function getMostActiveDayLabel(dailyCounts, year, month) {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    let bestDay = null;
    let bestCount = 0;

    Object.entries(dailyCounts).forEach(([day, count]) => {
        const numDay = Number(day);
        if (!count || count <= 0) return;

        const date = new Date(year, month, numDay);
        const dow = date.getDay();

        if (count > bestCount) {
            bestCount = count;
            bestDay = dayNames[dow];
        }
    });

    return bestDay;
}

export default function ActivityHeatmapCard({ dailyCounts }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;

    const today = new Date();
    const todayDate = today.getDate();

    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const numCols = Math.ceil((firstDow + daysInMonth) / 7);

    const cols = Array.from({ length: numCols }, (_, col) =>
        Array.from({ length: 7 }, (_, row) => {
            const dayNum = col * 7 + row - firstDow + 1;
            if (dayNum < 1 || dayNum > daysInMonth) return null;
            return { day: dayNum, count: dailyCounts[dayNum] || 0 };
        })
    );

    const levelColors = [
        isDark ? "rgba(255,255,255,0.07)" : alpha(primary, 0.08),
        alpha(primary, 0.22),
        alpha(primary, 0.42),
        alpha(primary, 0.65),
        primary,
    ];

    const totalDone = useMemo(
        () => Object.values(dailyCounts).reduce((sum, count) => sum + (count || 0), 0),
        [dailyCounts]
    );

    const activeDays = useMemo(
        () => Object.values(dailyCounts).filter((count) => count > 0).length,
        [dailyCounts]
    );

    const bestDayLabel = useMemo(
        () => getMostActiveDayLabel(dailyCounts, year, month),
        [dailyCounts, year, month]
    );

    return (
        <Card elevation={0} sx={{ borderRadius: 3, boxShadow: "var(--plando-elev-1)", ...getGlassSx(theme), borderColor: "transparent" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Stack
                    direction="row"
                    spacing={3}
                    alignItems="center"
                    sx={{ minHeight: 100 }}
                >
                    <Box
                        sx={{
                            flexShrink: 0,
                            minWidth: 116,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                        }}
                    >
                        <Box sx={{ display: "flex", gap: `${GAP}px` }}>
                            <Stack sx={{ gap: `${GAP}px`, flexShrink: 0 }}>
                                {DAY_LABELS.map((lbl, i) => (
                                    <Typography
                                        key={i}
                                        sx={{
                                            fontSize: 8,
                                            color: "text.disabled",
                                            width: 12,
                                            height: CELL,
                                            lineHeight: `${CELL}px`,
                                            textAlign: "right",
                                        }}
                                    >
                                        {lbl}
                                    </Typography>
                                ))}
                            </Stack>

                            {cols.map((col, ci) => (
                                <Stack key={ci} sx={{ gap: `${GAP}px`, flexShrink: 0 }}>
                                    {col.map((cell, ri) => {
                                        const lv = cell === null ? -1 : getLevel(cell.count);
                                        const isToday = cell?.day === todayDate;

                                        return (
                                            <Box
                                                key={ri}
                                                sx={{
                                                    width: CELL,
                                                    height: CELL,
                                                    borderRadius: "3px",
                                                    bgcolor: cell === null ? "transparent" : levelColors[lv],
                                                    outline: isToday ? `1.5px solid ${primary}` : "none",
                                                    outlineOffset: "1px",
                                                }}
                                            />
                                        );
                                    })}
                                </Stack>
                            ))}
                        </Box>

                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing="4px"
                            sx={{ mt: 1, pl: 2 }}
                        >
                            <Typography sx={{ fontSize: 9, color: "text.disabled" }}>적음</Typography>
                            {levelColors.map((color, i) => (
                                <Box
                                    key={i}
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "2px",
                                        bgcolor: color,
                                    }}
                                />
                            ))}
                            <Typography sx={{ fontSize: 9, color: "text.disabled" }}>많음</Typography>
                        </Stack>
                    </Box>

                    <Stack
                        spacing={0.7}
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            justifyContent: "center",
                            pl: 0.5,
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: 12,
                                color: "text.secondary",
                                fontWeight: 700,
                                lineHeight: 1,
                            }}
                        >
                            이번 달 완료
                        </Typography>

                        <Typography
                            sx={{
                                fontSize: 32,
                                fontWeight: 900,
                                lineHeight: 1,
                                letterSpacing: "-0.03em",
                            }}
                        >
                            {totalDone}개
                        </Typography>

                        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.4 }}>
                            활동한 날{" "}
                            <Box component="span" sx={{ color: "primary.main", fontWeight: 800 }}>
                                {activeDays}일
                            </Box>
                        </Typography>

                        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.4 }}>
                            가장 활발한 요일{" "}
                            <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>
                                {bestDayLabel ? `${bestDayLabel}요일` : "-"}
                            </Box>
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}