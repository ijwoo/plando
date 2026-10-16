import React from "react";
import { Box } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Z } from "../../../../../shared/ui/zIndex.js";
import { SHADOW } from "../../common/recruitmentSx";
import { SNAP_H } from "../MapBottomSheet";

/**
 * CreateFab — 우하단 FAB ("모집 만들기")
 *
 * - 스크롤 collapsed 시: 아이콘만 (라벨 숨김)
 * - mode === "map" 시: 시트 위로 올라가 위치 + 라벨 숨김
 * - mode === "map" && sheetSnap === "full" 시: 완전 숨김
 */
export default function CreateFab({
    onClick,
    collapsed,
    mode,
    sheetSnap,
    mapContainerH,
}) {
    const snapPct = SNAP_H[sheetSnap] ?? 50;
    const fabBottom = mode === "map" && mapContainerH > 0
        ? `${Math.round(mapContainerH * snapPct / 100) + 16}px`
        : "calc(env(safe-area-inset-bottom, 0px) + 16px)";
    const fabHidden = mode === "map" && sheetSnap === "full";
    const compact = collapsed || mode === "map";

    return (
        <Box
            onClick={onClick}
            sx={{
                position: "fixed",
                right: 16,
                bottom: fabBottom,
                zIndex: Z.FAB,
                display: "flex",
                alignItems: "center",
                gap: compact ? 0 : 0.75,
                height: 48,
                px: compact ? 1.75 : 2.25,
                borderRadius: 99,
                bgcolor: "primary.main",
                color: "common.white",
                boxShadow: SHADOW.lift,
                cursor: "pointer",
                userSelect: "none",
                overflow: "hidden",
                opacity: fabHidden ? 0 : 1,
                pointerEvents: fabHidden ? "none" : "auto",
                transition: "bottom 0.35s cubic-bezier(0.32,0.72,0,1), opacity 0.25s, padding 0.3s cubic-bezier(0.4,0,0.2,1), gap 0.3s cubic-bezier(0.4,0,0.2,1)",
                "&:active": { transform: "scale(0.95)" },
                "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}
        >
            <AddRoundedIcon sx={{ fontSize: 22, flexShrink: 0 }} />
            <Box sx={{
                maxWidth: compact ? 0 : 120,
                opacity: compact ? 0 : 1,
                overflow: "hidden",
                whiteSpace: "nowrap",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                transition: "max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
                "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}>
                모집 만들기
            </Box>
        </Box>
    );
}
