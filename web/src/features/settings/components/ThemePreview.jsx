import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

/** hex 상대 휘도 (0~1) — 배경이 밝은지 어두운지 판정 */
function luminance(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 테마 선택 미니 프리뷰 — 각 테마의 배경+accent로 작은 앱 화면 미니어처를 그린다.
 * (원형 스와치 대신 "이 테마가 어떤 느낌인지" 보여주는 방식 — VSCode/Notion식)
 *
 * theme: { key, label, color(배경), dot(accent) }
 */
export default function ThemePreview({ theme, selected, onClick }) {
    const bg = theme.color;
    const accent = theme.dot;
    const isLightBg = luminance(bg) > 0.5;

    const lineColor = isLightBg ? "rgba(0,0,0,0.13)" : "rgba(255,255,255,0.20)";
    const cardColor = isLightBg ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)";
    const cardBorder = isLightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";

    const Bar = ({ w }) => (
        <Box sx={{ height: 4, width: w, borderRadius: 2, bgcolor: lineColor }} />
    );

    return (
        <Box
            onClick={onClick}
            role="button"
            sx={{
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                "&:active .theme-frame": { transform: "scale(0.97)" },
            }}
        >
            <Box
                className="theme-frame"
                sx={{
                    position: "relative",
                    borderRadius: "var(--plando-radius-md)",
                    overflow: "hidden",
                    border: "2px solid",
                    borderColor: selected ? "primary.main" : "divider",
                    boxShadow: selected ? "0 0 0 1px var(--plando-primary)" : "none",
                    transition: "transform 0.12s, border-color 0.15s, box-shadow 0.15s",
                }}
            >
                {/* 미니 앱 화면 */}
                <Box sx={{ bgcolor: bg, height: 96, p: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
                    {/* 상단바: accent 점 + 타이틀 바 */}
                    <Stack direction="row" alignItems="center" sx={{ gap: 0.6, mb: 0.25 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: accent, flexShrink: 0 }} />
                        <Bar w="42%" />
                    </Stack>
                    {/* 카드 2개 (할 일 카드 느낌) */}
                    {[0, 1].map((i) => (
                        <Box
                            key={i}
                            sx={{
                                bgcolor: cardColor,
                                border: `1px solid ${cardBorder}`,
                                borderRadius: "6px",
                                p: 0.6,
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                            }}
                        >
                            <Box sx={{ width: 6, height: 6, borderRadius: "2px", bgcolor: accent, flexShrink: 0, opacity: i === 0 ? 1 : 0.5 }} />
                            <Stack spacing={0.4} sx={{ flex: 1 }}>
                                <Bar w={i === 0 ? "70%" : "55%"} />
                            </Stack>
                        </Box>
                    ))}
                </Box>

                {/* 선택 체크 */}
                {selected && (
                    <Box sx={{
                        position: "absolute", top: 5, right: 5,
                        width: 18, height: 18, borderRadius: "50%",
                        bgcolor: "primary.main", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }}>
                        <CheckRoundedIcon sx={{ fontSize: 13 }} />
                    </Box>
                )}
            </Box>

            <Typography
                align="center"
                sx={{
                    fontSize: 12,
                    fontWeight: selected ? 800 : 500,
                    color: selected ? "primary.main" : "text.secondary",
                }}
            >
                {theme.label}
            </Typography>
        </Box>
    );
}
