import React from "react";
import { Button } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * 앱 공통 액션 버튼 사다리 (보드/목록/개요 헤더 + 설정 카드 내부 액션 공용).
 * 기존 인라인 중복(h40·fw800 채운 버튼)을 통일 + 리디자인 — 더 작고(h36) 가벼운(fw700)
 * 톤에 프라이머리 소프트 섀도우로 정돈.
 *
 * variant:
 *  - "primary"   : 페이지 주 CTA (채운 프라이머리 + 소프트 섀도우)
 *  - "secondary" : 보조 (외곽선)
 *  - "ghost"     : 카드 인라인 add (은은한 틴트, 섀도우 없음, 더 작게) — 주 CTA와 경쟁 안 하게
 *  - "danger"    : 파괴적 액션 공용 톤 (초기화·로그아웃·탈퇴·삭제·연동 해제).
 *                  채운 빨강/주황을 섞어 쓰던 걸 하나로 통일 — 틴트+빨강 테두리로
 *                  위험은 분명히 알리되 주 CTA보다 한 단계 낮게.
 */
export default function HeaderActionButton({ variant = "primary", icon, children, sx, ...props }) {
    const isPrimary = variant === "primary";
    const isGhost = variant === "ghost";
    const VARIANT_SX = {
        primary: {
            boxShadow: (t) => `0 2px 10px ${alpha(t.palette.primary.main, 0.28)}`,
            "&:hover": { boxShadow: (t) => `0 4px 14px ${alpha(t.palette.primary.main, 0.36)}` },
        },
        ghost: {
            color: "primary.main",
            bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.16 : 0.09),
            "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.24 : 0.15) },
        },
        danger: {
            color: "error.main",
            border: "1px solid",
            borderColor: (t) => alpha(t.palette.error.main, t.palette.mode === "dark" ? 0.36 : 0.26),
            bgcolor: (t) => alpha(t.palette.error.main, t.palette.mode === "dark" ? 0.14 : 0.06),
            "&:hover": {
                bgcolor: (t) => alpha(t.palette.error.main, t.palette.mode === "dark" ? 0.22 : 0.11),
                borderColor: (t) => alpha(t.palette.error.main, 0.5),
            },
            "&.Mui-disabled": { opacity: 0.45 },
        },
        secondary: {
            color: "text.secondary",
            border: "1px solid",
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover", borderColor: "text.disabled" },
        },
    };
    const variantSx = VARIANT_SX[variant] ?? VARIANT_SX.secondary;
    return (
        <Button
            variant={isPrimary ? "contained" : "text"}
            disableElevation
            startIcon={icon}
            sx={{
                height: isGhost ? 32 : 36,
                px: isGhost ? 1.5 : 1.75,
                borderRadius: "var(--plando-radius-md)",
                // 타입 스케일 토큰으로 고정 (12.5 같은 스케일 밖 값 제거)
                fontSize: isGhost ? "var(--plando-type-caption-size)" : "var(--plando-type-label-size)",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                textTransform: "none",
                flexShrink: 0,
                "& .MuiButton-startIcon": { mr: 0.5 },
                ...variantSx,
                ...sx,
            }}
            {...props}
        >
            {children}
        </Button>
    );
}
