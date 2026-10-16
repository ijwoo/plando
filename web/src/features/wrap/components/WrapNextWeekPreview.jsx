import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";

/**
 * 다음 주 미리보기 — 카드 안 미니 박스.
 * 일정 수 / 가장 바쁜 요일 / 자주 갈 장소.
 */
export default function WrapNextWeekPreview({ data }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    if (!data) return null;

    const bg = isDark ? "rgba(45,110,245,0.08)" : "linear-gradient(180deg, #F1F6FF 0%, #FFFFFF 100%)";
    const borderColor = isDark ? "rgba(45,110,245,0.18)" : "var(--plando-primary-soft-2)";

    return (
        <Box
            sx={{
                background: bg,
                borderRadius: "var(--plando-radius-md)",
                padding: "16px 16px",
                border: `1px solid ${borderColor}`,
            }}
        >
            <Stack spacing={1.5}>
                <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                    <Typography
                        sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "var(--plando-primary)",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        다음 주 ({data.rangeLabel})
                    </Typography>
                    <Stack direction="row" alignItems="baseline" spacing={0.25}>
                        <Typography
                            sx={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                letterSpacing: "-0.025em",
                                lineHeight: 1,
                            }}
                        >
                            {data.totalCount}
                        </Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>
                            건 예정
                        </Typography>
                    </Stack>
                </Stack>

                {data.totalCount === 0 ? (
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>
                        아직 잡힌 일정이 없어요. 이번 주 패턴으로 다음 주를 그려보세요.
                    </Typography>
                ) : (
                    <Stack spacing={0.75}>
                        {data.busiestDay ? (
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <LocalFireDepartmentRoundedIcon sx={{ fontSize: 14, color: "var(--plando-orange)" }} />
                                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>
                                    가장 바쁜 날 —{" "}
                                    <Box component="span" sx={{ color: "text.primary", fontWeight: 800 }}>
                                        {data.busiestDay.label}
                                    </Box>
                                </Typography>
                            </Stack>
                        ) : null}
                        {data.topPlace ? (
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <PlaceRoundedIcon sx={{ fontSize: 14, color: "var(--plando-green)" }} />
                                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>
                                    자주 갈 곳 —{" "}
                                    <Box component="span" sx={{ color: "text.primary", fontWeight: 800 }}>
                                        {data.topPlace.name}
                                    </Box>
                                </Typography>
                            </Stack>
                        ) : null}
                    </Stack>
                )}
            </Stack>
        </Box>
    );
}
