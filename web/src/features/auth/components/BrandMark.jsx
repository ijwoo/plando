import React from "react";
import { Box, Stack, Typography } from "@mui/material";

/**
 * Plando 브랜드 마크 (앱 아이콘 + "Plan Do!" 텍스트).
 * Auth 페이지 4곳(Login/LoginMobile/Register/RegisterMobile)에 중복 정의됐던 걸 통합.
 *
 * Props:
 *   size: number (기본 36) — 데스크톱은 num size 사용
 *        | "normal" (markPx 32 / textPx 22) — 모바일 헤더 영역
 *        | "large"  (markPx 52 / textPx 34) — 모바일 hero
 */
export default function BrandMark({ size = 36 }) {
    let markPx, textPx, radius, gap;

    if (typeof size === "number") {
        // 데스크톱 (LoginPage / RegisterPage) — text 크기는 30 고정
        markPx = size;
        textPx = 30;
        radius = `${size * 0.22}px`;
        gap = 1;
    } else if (size === "large") {
        // 모바일 hero (LoginPageMobile method step)
        markPx = 52;
        textPx = 34;
        radius = "12px";
        gap = 1.25;
    } else {
        // "normal"  — 모바일 기본
        markPx = 32;
        textPx = 22;
        radius = "8px";
        gap = 1;
    }

    return (
        <Stack direction="row" alignItems="center" spacing={gap}>
            <Box
                sx={{
                    width: markPx,
                    height: markPx,
                    borderRadius: radius,
                    overflow: "hidden",
                    flexShrink: 0,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                }}
            >
                <Box
                    component="img"
                    src="/icon.png"
                    alt="Plan Do! 아이콘"
                    sx={{ width: "100%", height: "100%", display: "block" }}
                />
            </Box>
            <Typography
                sx={{
                    fontFamily: '"Manrope", "Pretendard", sans-serif',
                    fontWeight: 800,
                    letterSpacing: "-0.05em",
                    lineHeight: 1,
                    fontSize: textPx,
                    color: "#000",
                }}
            >
                Plan{" "}
                <Box component="span" sx={{ color: "#3b82f6" }}>
                    Do!
                </Box>
            </Typography>
        </Stack>
    );
}
