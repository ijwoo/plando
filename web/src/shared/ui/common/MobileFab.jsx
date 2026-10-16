import React from "react";
import { alpha, useTheme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { isAndroid } from "../../utils/platformUtils.js";
import { Z } from "../zIndex.js";
import Press from "../primitives/Press.jsx";

/**
 * 모바일 우하단 FAB — 바텀 네비 위에 일정한 거리로 고정.
 * - iOS: `env(safe-area-inset-bottom) + 80px`
 * - Android: `max(env(safe-area-inset-bottom), 10px) + 72px` (네이티브 nav 보정 다름)
 *
 * Press primitive 기반 → scale-down + medium haptic 자동.
 *
 * Props:
 *   onClick: () => void
 *   icon?: ReactNode (기본: AddRoundedIcon)
 *   ariaLabel?: string (기본: "추가")
 */
export default function MobileFab({ onClick, icon, ariaLabel = "추가" }) {
    const theme = useTheme();
    const primary = theme.palette.primary.main;
    return (
        <Press
            onClick={onClick}
            haptic="medium"
            pressScale={0.9}
            aria-label={ariaLabel}
            style={{
                position: "fixed",
                right: 16,
                bottom: isAndroid
                    ? "calc(max(env(safe-area-inset-bottom, 0px), 10px) + 72px)"
                    : "calc(env(safe-area-inset-bottom, 0px) + 80px)",
                width: 56,
                height: 56,
                borderRadius: 999,
                background: primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                // 토스식 — 중립 그림자 위에 옅은 버튼색 틴트(약하게: halo 없이 깊이만)
                boxShadow: `0 6px 16px rgba(0,0,0,0.16), 0 4px 12px ${alpha(primary, 0.18)}`,
                zIndex: Z.FAB,
                color: "#fff",
            }}
        >
            {icon || <AddRoundedIcon sx={{ fontSize: 28, color: "#fff" }} />}
        </Press>
    );
}
