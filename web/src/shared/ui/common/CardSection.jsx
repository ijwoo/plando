import React from "react";
import { Box } from "@mui/material";

/**
 * 토스 톤 카드 wrapper.
 * mock spec: border 없이 soft shadow + radius 18 + bg paper.
 * 기존에 흩어진 정의들 (AddTodoMobile.SectionCard / TodoDetailMobile.SCard /
 * TodoDetailOverviewTab.ContentCard / TodoDetailDesktop 인라인 Card variant=outlined)을 통일.
 *
 * Props:
 *   children
 *   sx?: 추가 sx
 *   padding?: 내부 padding (기본 18px)
 *   noShadow?: 컨텍스트 상 그림자 빠져야 할 때 true
 */
export default function CardSection({
    children,
    sx,
    padding = "18px",
    noShadow = false,
}) {
    return (
        <Box
            sx={{
                bgcolor: "background.paper",
                borderRadius: "var(--plando-radius-card)",
                p: padding,
                // mock spec: border 없이 1px ring + soft shadow.
                // shadow-1만 쓰면 light 모드에서 너무 흐릿해 카드 경계가 모호 → ring 토큰 사용.
                boxShadow: noShadow ? "none" : "var(--plando-shadow-card-ring)",
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}
