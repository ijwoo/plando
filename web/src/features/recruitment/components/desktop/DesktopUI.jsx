import React from "react";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PostCard from "../list/PostCard";
import {
    cardSx,
    chipSx,
    filterChipSx,
    tabUnderlineSx,
    emptyStateSx,
    statBoxSx,
    SHADOW,
} from "../common/recruitmentSx";

// ─────────────────────────────────────────────────────────────
// Small UI components — Toss tone
// ─────────────────────────────────────────────────────────────

/** 카드 그리드 레이아웃 — CardGrid / CardGridSkeleton 공용 (스켈레톤 정렬 어긋남 방지) */
const GRID_SX = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
    gap: 2,
    alignContent: "start",
};

export function EmptyState({ icon, title, desc, actionLabel, onAction }) {
    const theme = useTheme();
    return (
        <Box
            sx={{
                ...emptyStateSx(theme),
                p: 0,
                py: 8,
                gap: 1.25,
                minHeight: 280,
            }}
        >
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    boxShadow: SHADOW.card,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 24,
                    mb: 0.5,
                }}
            >
                {icon}
            </Box>
            <Typography sx={{
                fontSize: 17,
                fontWeight: 700,
                color: "text.primary",
                letterSpacing: "-0.025em",
            }}>
                {title}
            </Typography>
            <Typography
                sx={{
                    fontSize: 13.5,
                    color: "text.secondary",
                    fontWeight: 500,
                    textAlign: "center",
                    maxWidth: 320,
                    lineHeight: 1.7,
                    letterSpacing: "-0.005em",
                }}
            >
                {desc}
            </Typography>
            {onAction ? (
                <Button
                    onClick={onAction}
                    disableElevation
                    sx={{
                        borderRadius: 1.25,
                        fontWeight: 700,
                        fontSize: 13.5,
                        textTransform: "none",
                        mt: 1,
                        px: 2.5,
                        height: 40,
                        bgcolor: "text.primary",
                        color: "background.paper",
                        "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.88) },
                    }}
                >
                    {actionLabel}
                </Button>
            ) : null}
        </Box>
    );
}

/**
 * 카테고리 칩 (hero 영역 카테고리 필터용) — Toss 톤
 * 활성 시 dark(ink-1) 배경, 비활성은 white surface + shadow
 */
export function CatPill({ label, icon, active, onClick }) {
    const theme = useTheme();
    return (
        <Box onClick={onClick} sx={chipSx(theme, active)}>
            {icon ? <span style={{ fontSize: 13 }}>{icon}</span> : null}
            <span>{label}</span>
        </Box>
    );
}

/**
 * 필터 칩 (전체 / 온라인 / 오프라인 / 내 근처 등)
 * warn: 거리 옵션처럼 강조용 (warning tint)
 */
export function FilterPill({ label, active, onClick, warn }) {
    const theme = useTheme();
    if (warn) {
        return (
            <Box
                onClick={onClick}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    px: 1.75,
                    height: 34,
                    borderRadius: 1.25,
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 600,
                    bgcolor: active
                        ? alpha(theme.palette.warning.main, 0.14)
                        : "transparent",
                    color: active ? theme.palette.warning.main : "text.secondary",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background 0.12s ease, color 0.12s ease",
                    "&:hover": {
                        bgcolor: alpha(theme.palette.warning.main, active ? 0.18 : 0.08),
                        color: theme.palette.warning.main,
                    },
                }}
            >
                {label}
            </Box>
        );
    }
    return (
        <Box onClick={onClick} sx={filterChipSx(theme, active)}>
            {label}
        </Box>
    );
}

/** 탭바 — underline 활성 (Toss 톤) */
export function TabBar({ tabs, activeTab, onTabChange, sx }) {
    const theme = useTheme();
    return (
        <Box sx={{
            borderBottom: "1px solid",
            borderColor: theme.palette.divider,
            display: "flex",
            ...sx,
        }}>
            {tabs.map(({ id, label }) => {
                const isActive = activeTab === id;
                return (
                    <Box
                        key={id}
                        onClick={() => onTabChange(id)}
                        sx={{
                            ...tabUnderlineSx(theme, isActive),
                            // 작은 사이즈로 — 페이지 내 컴팩트 탭
                            px: 1.75,
                            py: 1.25,
                            fontSize: 13.5,
                            "&::after": isActive ? {
                                content: '""',
                                position: "absolute",
                                left: 14, right: 14, bottom: -1,
                                height: 2.5,
                                bgcolor: "primary.main",
                                borderRadius: 1,
                            } : {},
                        }}
                    >
                        {label}
                    </Box>
                );
            })}
        </Box>
    );
}

export function CardGrid({ items, onDetail, onBookmark }) {
    return (
        <Box sx={GRID_SX}>
            {items.map((item) => (
                <PostCard key={item.id} item={item} onDetail={onDetail} onBookmark={onBookmark} />
            ))}
        </Box>
    );
}

// ─────────────────────────────────────────────────────────────
// Loading skeletons — 첫 요청이 끝나기 전엔 빈 상태 대신 이걸 보여줍니다.
// (예전엔 로딩 중에도 "검색 결과가 없어요"가 떠서 탭을 바꿀 때마다 깜빡였음)
// ─────────────────────────────────────────────────────────────

/** 상단 통계 4칸 스켈레톤 — StatsRow와 같은 그리드/타일 규격 */
export function StatsRowSkeleton() {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
                gap: 1.5,
                mb: 3,
            }}
        >
            {[0, 1, 2, 3].map((i) => (
                <Box key={i} sx={statBoxSx()}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Skeleton variant="text" width="52%" height={18} />
                            <Skeleton variant="text" width="38%" height={34} />
                        </Box>
                        <Skeleton variant="rounded" width={38} height={38} sx={{ flexShrink: 0 }} />
                    </Stack>
                    <Skeleton variant="text" width="70%" height={16} sx={{ mt: 1 }} />
                </Box>
            ))}
        </Box>
    );
}

/** 카드 그리드 스켈레톤 — CardGrid와 같은 컬럼/간격 */
export function CardGridSkeleton({ count = 4 }) {
    return (
        <Box sx={GRID_SX}>
            {Array.from({ length: count }, (_, i) => (
                <Skeleton
                    key={i}
                    variant="rounded"
                    height={240}
                    sx={{ borderRadius: 1.75, transform: "none" }}
                />
            ))}
        </Box>
    );
}

// Re-export for backward compat — 다른 곳에서 cardSx 사용
export { cardSx };
