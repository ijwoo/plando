import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

function Donut({ size = 56, stroke = 8, ratio, color, isDark }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const dash = ratio * circ;
    const trackColor = isDark ? "rgba(255,255,255,0.08)" : "#E4E8EF";
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ - dash}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)" }}
            />
        </svg>
    );
}

/**
 * 비율 셀.
 * 한 쪽이 0이면 도넛 대신 한 줄 카피로 표현 (버그처럼 보이는 빈 원 방지).
 */
function RatioCell({ ratio, color, isDark, lonelyText, fullText }) {
    const p = ratio?.primary || 0;
    const s = ratio?.secondary || 0;
    const total = p + s;

    const cellBase = {
        flex: 1,
        minWidth: 0,
        background: isDark ? "rgba(255,255,255,0.025)" : "var(--plando-surface-alt)",
        borderRadius: "var(--plando-radius-md)",
        padding: "14px 14px",
    };

    // 둘 다 0 — 표시 안 함 (호출부에서 거름)
    if (total === 0) return null;

    // 한쪽 100% — 카피 fallback
    if (p === 0) {
        return (
            <Box sx={cellBase}>
                <Stack spacing={0.5}>
                    <Typography
                        sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: isDark ? "rgba(255,255,255,0.6)" : "var(--plando-text-secondary)",
                        }}
                    >
                        {ratio?.primaryLabel} / {ratio?.secondaryLabel}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                            letterSpacing: "-0.015em",
                        }}
                    >
                        {lonelyText}
                    </Typography>
                </Stack>
            </Box>
        );
    }
    if (s === 0) {
        return (
            <Box sx={cellBase}>
                <Stack spacing={0.5}>
                    <Typography
                        sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: isDark ? "rgba(255,255,255,0.6)" : "var(--plando-text-secondary)",
                        }}
                    >
                        {ratio?.primaryLabel} / {ratio?.secondaryLabel}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                            letterSpacing: "-0.015em",
                        }}
                    >
                        {fullText}
                    </Typography>
                </Stack>
            </Box>
        );
    }

    // 정상: 도넛
    const pct = Math.round((p / total) * 100);
    return (
        <Box sx={cellBase}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ position: "relative", display: "flex" }}>
                    <Donut size={56} stroke={8} ratio={p / total} color={color} isDark={isDark} />
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 900,
                            color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {pct}%
                    </Box>
                </Box>
                <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Box sx={{ width: 7, height: 7, borderRadius: 2, background: color }} />
                        <Typography
                            sx={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {ratio?.primaryLabel} {p}
                        </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Box
                            sx={{
                                width: 7,
                                height: 7,
                                borderRadius: 2,
                                background: isDark ? "rgba(255,255,255,0.22)" : "#CBD5E1",
                            }}
                        />
                        <Typography
                            sx={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: isDark
                                    ? "rgba(255,255,255,0.5)"
                                    : "var(--plando-text-tertiary)",
                            }}
                        >
                            {ratio?.secondaryLabel} {s}
                        </Typography>
                    </Stack>
                </Stack>
            </Stack>
        </Box>
    );
}

/**
 * 두 비율 카드 — 협업/단독 + 시간정한/종일.
 * 모두 0이면 자체 표시 안 함 (부모가 hasRatios 체크).
 */
export default function WrapRatioDual({ collab, timed }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    return (
        <Stack direction="row" spacing={1}>
            {collab ? (
                <RatioCell
                    ratio={collab}
                    color="var(--plando-primary)"
                    isDark={isDark}
                    lonelyText="이번 주는 혼자 달렸어요"
                    fullText="모두 함께한 일정이에요"
                />
            ) : null}
            {timed ? (
                <RatioCell
                    ratio={timed}
                    color="var(--plando-orange)"
                    isDark={isDark}
                    lonelyText="전부 종일/시간 미정"
                    fullText="모두 시간을 정해두셨어요"
                />
            ) : null}
        </Stack>
    );
}
