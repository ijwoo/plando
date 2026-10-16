import React from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { getGlassSx, fadeDividerSx } from "../../../../shared/ui/glassSx.js";
import { PriorityPill } from "../../../../shared/ui/common/Chips.jsx";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import Press from "../../../../shared/ui/primitives/Press.jsx";

function getDDayColor(diff) {
    if (diff <= 2) return "#FF5A5A"; // 지연(<0) 포함 — 빨강
    if (diff <= 5) return "#FF9500"; // 임박 — 주황
    return "#3D7BFF";                // 여유 — 파랑
}

function getDDayLabel(diff) {
    if (diff === 0) return "D-day";
    if (diff < 0) return `D+${Math.abs(diff)}`;
    return `D-${diff}`;
}

function formatDueDateKr(dateStr) {
    if (!dateStr) return "";
    const [, m, d] = dateStr.split("-");
    return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

/**
 * 마감 임박 태스크 (슬라이드 3번). mock에는 없는 우리 고유 섹션 — 기능 그대로 유지.
 * 시각만 새 토큰/Press 적용.
 */
export default function DDaySlide({ tasks, overdueCount, onTaskClick }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                ...getGlassSx(theme),
                borderColor: "transparent",
            }}
        >
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1.25 }}
                >
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-label-size)",
                            fontWeight: "var(--plando-type-label-weight)",
                            color: "text.secondary",
                        }}
                    >
                        마감 D-day
                    </Typography>
                    {overdueCount > 0 && (
                        <Box
                            sx={{
                                fontSize: 10,
                                fontWeight: 700,
                                px: 1, py: 0.4,
                                borderRadius: 999,
                                bgcolor: alpha("#FF5A5A", isDark ? 0.18 : 0.10),
                                color: "#FF5A5A",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {overdueCount}개 지연
                        </Box>
                    )}
                </Stack>

                {tasks.length === 0 ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ py: 2.5 }}>
                        <CheckCircleOutlineRoundedIcon sx={{ fontSize: 22, color: "text.disabled", mb: 0.5 }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.disabled" }}>
                            마감 예정 일정이 없어요
                        </Typography>
                    </Stack>
                ) : (
                    <Stack spacing={0}>
                        {tasks.map((task, i) => {
                            const color = getDDayColor(task.dDiff);
                            return (
                                <Press
                                    key={task.id}
                                    onClick={() => onTaskClick?.(task.id)}
                                    style={{
                                        ...(i > 0 ? fadeDividerSx(theme.palette.divider) : {}),
                                    }}
                                >
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={1.25}
                                        sx={{ py: 1, px: 0.5 }}
                                    >
                                        <Box
                                            sx={{
                                                minWidth: 44,
                                                height: 44,
                                                borderRadius: "10px",
                                                bgcolor: alpha(color, isDark ? 0.20 : 0.12),
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize: 13,
                                                    fontWeight: 800,
                                                    lineHeight: 1,
                                                    color,
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {getDDayLabel(task.dDiff)}
                                            </Typography>
                                            <Typography sx={{ fontSize: 8, fontWeight: 700, color, mt: 0.3 }}>
                                                마감
                                            </Typography>
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography
                                                sx={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    letterSpacing: "-0.01em",
                                                }}
                                            >
                                                {task.title}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontSize: 10,
                                                    color: "text.disabled",
                                                    mt: 0.25,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {formatDueDateKr(task.dueDate)}
                                            </Typography>
                                        </Box>
                                        <PriorityPill priority={task.priority} sx={{ flexShrink: 0 }} />
                                    </Stack>
                                </Press>
                            );
                        })}
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
}
