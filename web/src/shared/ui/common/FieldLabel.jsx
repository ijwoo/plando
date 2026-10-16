import React from "react";
import { Box, Typography } from "@mui/material";

/**
 * 카드 안 필드/섹션 라벨.
 * 기존 AddTodoMobile.Label / TodoDetailMobile.SLabel / TodoDetailOverviewTab.SectionLabel /
 * TodoDetailDesktop.SLabel — 4벌 정의가 흩어져있던 걸 통일.
 *
 * mock 톤(toss): 12.5px / 700 / no uppercase / 6px gap with optional leading icon.
 *
 * Props:
 *   icon?: ReactNode (보통 12-13px svg/MUI icon)
 *   children: label text
 *   sx?: 추가 sx
 *   mb?: 라벨 아래 여백 (기본 8px)
 */
export default function FieldLabel({ icon, children, sx, mb = "8px" }) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: 12.5,
                fontWeight: 700,
                color: "text.secondary",
                letterSpacing: "-0.1px",
                mb,
                ...sx,
            }}
        >
            {icon && (
                <Box
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        color: "text.disabled",
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </Box>
            )}
            <Typography
                component="span"
                sx={{
                    fontSize: "inherit",
                    fontWeight: "inherit",
                    color: "inherit",
                    letterSpacing: "inherit",
                    lineHeight: 1.2,
                }}
            >
                {children}
            </Typography>
        </Box>
    );
}
