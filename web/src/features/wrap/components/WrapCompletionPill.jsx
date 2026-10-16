import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/**
 * 소화율 progress 미니 박스 — 메인 카드 헤드 영역.
 * 분모는 "지난 일정" 만 (미래 일정 제외).
 * 캘린더에서는 todo와 달리 미래 일정이 미완료가 아니기 때문.
 */
export default function WrapCompletionPill({ pastDone, pastTotal, pastRate, totalAll }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const bg = isDark ? "rgba(255,255,255,0.06)" : "#EEF2F8";
    const trackBg = isDark ? "rgba(255,255,255,0.14)" : "#D5DBE5";

    // 미래 일정 수 — 안내 카피용
    const futureCount = Math.max(0, (totalAll || 0) - (pastTotal || 0));

    // 모든 일정이 미래면(주 초반 회고) 별도 카피
    if (pastTotal === 0) {
        return (
            <Box
                sx={{
                    background: bg,
                    borderRadius: "var(--plando-radius-md)",
                    padding: "16px 16px",
                }}
            >
                <Stack spacing={0.5}>
                    <Typography
                        sx={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        아직 지난 일정이 없어요
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: isDark ? "rgba(255,255,255,0.6)" : "var(--plando-text-secondary)",
                        }}
                    >
                        주말에 다시 들러서 한 주를 돌아봐요
                    </Typography>
                </Stack>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                background: bg,
                borderRadius: "var(--plando-radius-md)",
                padding: "16px 16px",
            }}
        >
            <Stack spacing={1.25}>
                <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                    <Stack direction="row" alignItems="baseline" spacing={0.5}>
                        <Typography
                            sx={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            소화율
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: isDark ? "rgba(255,255,255,0.4)" : "var(--plando-text-tertiary)",
                            }}
                        >
                            (지난 일정 중)
                        </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="baseline" spacing={0.25}>
                        <Typography
                            sx={{
                                fontSize: 22,
                                fontWeight: 800,
                                letterSpacing: "-0.025em",
                                color: "var(--plando-primary)",
                                lineHeight: 1,
                            }}
                        >
                            {pastRate}
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "var(--plando-primary)" }}>
                            %
                        </Typography>
                    </Stack>
                </Stack>

                <Box
                    sx={{
                        height: 8,
                        background: trackBg,
                        borderRadius: 999,
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            height: "100%",
                            width: `${pastRate}%`,
                            background: "var(--plando-primary)",
                            borderRadius: 999,
                            transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
                        }}
                    />
                </Box>

                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: "wrap" }}>
                    <Typography
                        sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: isDark ? "rgba(255,255,255,0.7)" : "var(--plando-text-secondary)",
                        }}
                    >
                        지난 {pastTotal}건 중 {pastDone}건 마무리
                    </Typography>
                    {futureCount > 0 ? (
                        <Typography
                            sx={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: isDark ? "rgba(255,255,255,0.4)" : "var(--plando-text-tertiary)",
                            }}
                        >
                            앞으로 {futureCount}건
                        </Typography>
                    ) : null}
                </Stack>
            </Stack>
        </Box>
    );
}
