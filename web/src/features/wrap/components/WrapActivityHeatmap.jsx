import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { KO_DAYS } from "../data/mockWrapData.js";

const ROW_LABELS = ["새벽", "오전", "오후", "저녁"];

/**
 * 활동 히트맵 — 토스 만보기 풍.
 * grid: int[3][7] = bucket × day (오전/오후/저녁 × 일~토).
 * 셀에 숫자 박지 않고 색 진하기만으로 정보 전달.
 */
export default function WrapActivityHeatmap({ grid }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    if (!grid || grid.length === 0) return null;

    // 최대값 + 가장 활발했던 시간 위치
    let max = 0;
    let peak = { bucket: -1, day: -1 };
    for (let b = 0; b < grid.length; b++) {
        for (let d = 0; d < grid[b].length; d++) {
            const v = grid[b][d];
            if (v > max) { max = v; peak = { bucket: b, day: d }; }
        }
    }

    const cellSize = 28;
    const cellGap = 6;
    const labelColWidth = 32;

    const labelMuted = isDark ? "rgba(255,255,255,0.45)" : "var(--plando-text-tertiary)";
    const labelStrong = isDark ? "#E2E8F0" : "var(--plando-text-secondary)";

    // 5단계 부드러운 진하기
    const cellColor = (v) => {
        if (v === 0) return isDark ? "rgba(255,255,255,0.05)" : "#EDF1F7";
        if (max === 0) return isDark ? "rgba(255,255,255,0.05)" : "#EDF1F7";
        const ratio = v / max;
        if (ratio <= 0.2)  return isDark ? "rgba(45,110,245,0.22)" : "#D8E6FB";
        if (ratio <= 0.45) return isDark ? "rgba(45,110,245,0.42)" : "#A8C5F2";
        if (ratio <= 0.7)  return isDark ? "rgba(45,110,245,0.62)" : "#6E9DE8";
        if (ratio < 1)     return isDark ? "rgba(45,110,245,0.82)" : "#3F7BD9";
        return "var(--plando-primary)";
    };

    const peakHint = peak.bucket >= 0
        ? `${KO_DAYS[peak.day]}요일 ${ROW_LABELS[peak.bucket]}이 가장 활발했어요`
        : null;

    return (
        <Box>
            {/* 상단 요일 라벨 — 모두 같은 톤 (주말 강조 X) */}
            <Stack direction="row" spacing={`${cellGap}px`} sx={{ pl: `${labelColWidth}px`, mb: 1 }}>
                {KO_DAYS.map((d, i) => (
                    <Box
                        key={i}
                        sx={{
                            width: cellSize,
                            textAlign: "center",
                            fontSize: 11,
                            fontWeight: i === peak.day ? 800 : 600,
                            color: i === peak.day ? "var(--plando-primary)" : labelMuted,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {d}
                    </Box>
                ))}
            </Stack>

            {/* 3 행 (오전/오후/저녁) */}
            <Stack spacing={`${cellGap}px`}>
                {grid.map((row, bIdx) => (
                    <Stack key={bIdx} direction="row" alignItems="center" spacing={`${cellGap}px`}>
                        <Box
                            sx={{
                                width: labelColWidth,
                                fontSize: 11,
                                fontWeight: bIdx === peak.bucket ? 800 : 600,
                                color: bIdx === peak.bucket ? "var(--plando-primary)" : labelStrong,
                                letterSpacing: "-0.01em",
                                textAlign: "left",
                            }}
                        >
                            {ROW_LABELS[bIdx]}
                        </Box>
                        {row.map((v, dIdx) => (
                            <Box
                                key={dIdx}
                                sx={{
                                    width: cellSize,
                                    height: cellSize,
                                    borderRadius: "7px",
                                    background: cellColor(v),
                                    transition: "background 0.3s",
                                }}
                            />
                        ))}
                    </Stack>
                ))}
            </Stack>

            {/* peak hint + 범례 */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ mt: 2 }}
            >
                <Typography
                    sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isDark
                            ? "rgba(255,255,255,0.5)"
                            : "var(--plando-text-tertiary)",
                        letterSpacing: "-0.01em",
                    }}
                >
                    {peakHint || "활동 없음"}
                </Typography>

                <Stack direction="row" alignItems="center" spacing={0.5}>
                    {[0.0, 0.25, 0.5, 0.75, 1.0].map((r, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 12,
                                height: 12,
                                borderRadius: "3px",
                                background: cellColor(Math.ceil(r * Math.max(max, 1))),
                            }}
                        />
                    ))}
                </Stack>
            </Stack>
        </Box>
    );
}
