import React from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { getGlassSx } from "../../../../shared/ui/glassSx.js";
import { statusColor } from "../../../../shared/ui/tone.js";

/**
 * 오늘 현황 요약 카드 (슬라이드 1번).
 * mock spec(Greeting + ProgressCard 통합형)에 맞춰 재작성. props 시그니처 동일.
 *
 * 시각: 인사말 → 진행률(% + 상태 pill + segmented bar + 3-stat legend).
 * 모든 값이 0이면 빈 상태 메시지 표시.
 */
export default function TodaySummarySlide({
    userName,
    greeting,
    dateStr,
    todayCount,
    inProgressCount,
    doneCount,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    // 프로세스 색은 tone.js statusColor 단일 source of truth
    const inProgressColor = statusColor(theme, "IN_PROGRESS");
    const doneColor = statusColor(theme, "DONE");

    const total = todayCount + inProgressCount + doneCount;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const statusMsg = pct < 30 ? "시작이 반" : pct < 70 ? "잘하고 있어요" : "거의 다 왔어요";

    const remainingDot = isDark ? "rgba(255,255,255,0.18)" : alpha(primary, 0.16);
    const segmentBg = isDark ? "rgba(255,255,255,0.06)" : alpha(primary, 0.06);

    return (
        <Card
            elevation={0}
            sx={{
                width: "100%",
                height: "100%",
                minHeight: 188,
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                position: "relative",
                overflow: "hidden",
                boxSizing: "border-box",
                ...getGlassSx(theme),
                borderColor: "transparent",
            }}
        >
            <CardContent
                sx={{
                    height: "100%",
                    minHeight: 188,
                    boxSizing: "border-box",
                    p: 2,
                    "&:last-child": { pb: 2 },
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* 인사 + 날짜 */}
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-caption-size)",
                            fontWeight: "var(--plando-type-caption-weight)",
                            color: "text.secondary",
                            lineHeight: 1.2,
                            letterSpacing: "var(--plando-type-caption-ls)",
                        }}
                    >
                        {dateStr}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-title2-size)",
                            fontWeight: "var(--plando-type-title2-weight)",
                            lineHeight: "var(--plando-type-title2-lh)",
                            letterSpacing: "var(--plando-type-title2-ls)",
                            mt: 0.5,
                            wordBreak: "keep-all",
                        }}
                    >
                        {greeting},
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-title2-size)",
                            fontWeight: "var(--plando-type-title2-weight)",
                            lineHeight: "var(--plando-type-title2-lh)",
                            letterSpacing: "var(--plando-type-title2-ls)",
                            wordBreak: "keep-all",
                        }}
                    >
                        <Box component="span" sx={{ color: "primary.main" }}>
                            {userName || ""}
                        </Box>
                        님
                    </Typography>
                </Box>

                {/* 진행률 영역 — total=0이어도 항상 표시 (0% / 0 0 0). */}
                <Box sx={{ mt: "auto", pt: 1.25 }}>
                    <Stack
                        direction="row"
                        alignItems="baseline"
                        justifyContent="space-between"
                        sx={{ mb: 0.75, gap: 1 }}
                    >
                        <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ minWidth: 0 }}>
                            <Typography
                                sx={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    lineHeight: 1,
                                    color: "text.primary",
                                    letterSpacing: "-0.02em",
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {pct}
                            </Typography>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1, color: "text.primary" }}>
                                %
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: 11,
                                    color: "text.disabled",
                                    ml: 0.75,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {doneCount}/{total} 완료
                            </Typography>
                        </Stack>
                        {/* total=0이면 status pill 숨김 (격려 메시지 부적절) */}
                        {total > 0 && (
                            <Box
                                sx={{
                                    px: 1, py: 0.4,
                                    borderRadius: 999,
                                    bgcolor: alpha(primary, isDark ? 0.18 : 0.10),
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "primary.main",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                }}
                            >
                                {statusMsg}
                            </Box>
                        )}
                    </Stack>

                    {/* segmented bar: done(primary) | inProgress(warning) | remaining(subtle).
                        total=0이면 모든 segment의 flex가 0이라 background bar만 보임. */}
                    <Box
                        sx={{
                            display: "flex",
                            gap: "3px",
                            height: 7,
                            borderRadius: 999,
                            overflow: "hidden",
                            bgcolor: segmentBg,
                        }}
                    >
                        {doneCount > 0 && (
                            <Box
                                sx={{
                                    flex: doneCount,
                                    bgcolor: doneColor,
                                    borderRadius: 999,
                                    transition: "flex 0.4s",
                                }}
                            />
                        )}
                        {inProgressCount > 0 && (
                            <Box
                                sx={{
                                    flex: inProgressCount,
                                    bgcolor: inProgressColor,
                                    borderRadius: 999,
                                    opacity: 0.85,
                                }}
                            />
                        )}
                        {todayCount > 0 && (
                            <Box
                                sx={{
                                    flex: todayCount,
                                    bgcolor: remainingDot,
                                    borderRadius: 999,
                                }}
                            />
                        )}
                    </Box>

                    {/* 3-stat legend — total=0이면 0/0/0 표시 */}
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1, gap: 1 }}>
                        <StatItem dot={remainingDot} label="오늘 마감" value={todayCount} />
                        <StatItem dot={inProgressColor} label="진행 중" value={inProgressCount} valueColor={inProgressColor} />
                        <StatItem dot={doneColor} label="완료" value={doneCount} valueColor={doneColor} />
                    </Stack>
                </Box>
            </CardContent>
        </Card>
    );
}

function StatItem({ dot, label, value, valueColor }) {
    return (
        <Stack alignItems="flex-start" spacing={0.4} sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.6}>
                <Box
                    sx={{
                        width: 7, height: 7,
                        borderRadius: "50%",
                        bgcolor: dot,
                        flexShrink: 0,
                    }}
                />
                <Typography
                    sx={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "text.disabled",
                        whiteSpace: "nowrap",
                        letterSpacing: "-0.01em",
                    }}
                >
                    {label}
                </Typography>
            </Stack>
            <Typography
                sx={{
                    fontSize: 18,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: valueColor || "text.primary",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                }}
            >
                {value}
            </Typography>
        </Stack>
    );
}
