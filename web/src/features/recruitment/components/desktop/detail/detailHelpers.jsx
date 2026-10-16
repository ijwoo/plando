/**
 * detail/ 페이지 공용 헬퍼
 * - SectionEyebrow: 작은 accent 라벨 + 큰 제목 (Toss .section-eyebrow + .section h2 톤)
 * - detailCardSx: 메인 컬럼/사이드 카드 wrapper (lift 없는 surface + shadow-card)
 */
import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { SHADOW } from "../../common/recruitmentSx";

/** 메인 컬럼 / 사이드 카드 wrapper (lift 없음) */
export const detailCardSx = {
    bgcolor: "background.paper",
    border: 0,
    borderRadius: 2,
    boxShadow: SHADOW.card,
    p: 3,
    mb: 2,
};

/**
 * 카드 상단 섹션 헤더 — eyebrow(작은 accent 라벨) + 제목 + 우측 hint/action
 */
export function SectionEyebrow({ eyebrow, title, hint, action, mb = 2 }) {
    return (
        <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            sx={{ mb }}
        >
            <Box sx={{ minWidth: 0 }}>
                {eyebrow && (
                    <Typography sx={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "primary.main",
                        letterSpacing: "-0.005em",
                        mb: 0.5,
                    }}>
                        {eyebrow}
                    </Typography>
                )}
                {title && (
                    <Typography sx={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "text.primary",
                        letterSpacing: "-0.025em",
                        lineHeight: 1.3,
                    }}>
                        {title}
                    </Typography>
                )}
            </Box>
            {(hint || action) && (
                <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0, mt: 0.5 }}>
                    {hint && (
                        <Typography sx={{
                            fontSize: 12,
                            color: "text.disabled",
                            fontWeight: 600,
                        }}>
                            {hint}
                        </Typography>
                    )}
                    {action}
                </Stack>
            )}
        </Stack>
    );
}

/**
 * 사이드바 카드 상단 라벨 — uppercase 작은 톤
 * 메인 컬럼의 SectionEyebrow보다 톤이 한 단계 약함
 */
export function SidebarEyebrow({ children, mb = 1.75 }) {
    return (
        <Typography sx={{
            fontSize: 11,
            fontWeight: 700,
            color: "text.disabled",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            mb,
        }}>
            {children}
        </Typography>
    );
}
