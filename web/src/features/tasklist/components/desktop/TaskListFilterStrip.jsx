import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

/**
 * 필터 strip — 반복만/아카이브/필터 추가 토글.
 * 상태 필터는 StatusStatChips, 텍스트 검색은 상단 전역 검색(Ctrl+K)으로.
 * 컬럼 커스텀은 목록 헤더 맨 끝 "+" 버튼.
 */
export default function TaskListFilterStrip({
    recurringOnly,
    onToggleRecurring,
    archiveOpen,
    onToggleArchive,
    activeFilterCount,
    onOpenFilter,
}) {
    return (
        <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
        >
            <ToggleChip
                active={recurringOnly}
                onClick={onToggleRecurring}
                icon={<RepeatRoundedIcon sx={{ fontSize: 14 }} />}
                label="반복만"
            />
            <ToggleChip
                active={archiveOpen}
                onClick={onToggleArchive}
                icon={<Inventory2RoundedIcon sx={{ fontSize: 14 }} />}
                label="아카이브"
            />
            <ToggleChip
                active={false}
                onClick={onOpenFilter}
                icon={<TuneRoundedIcon sx={{ fontSize: 14 }} />}
                label={activeFilterCount > 0 ? `필터 ${activeFilterCount}` : "필터 추가"}
                badge={activeFilterCount > 0}
            />

            <Box sx={{ flex: 1 }} />

            <Typography
                sx={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "text.disabled",
                    letterSpacing: "-0.01em",
                    flexShrink: 0,
                }}
            >
                마감일 순 · 시간대 그룹
            </Typography>
        </Stack>
    );
}

function ToggleChip({ active, onClick, icon, label, badge }) {
    return (
        <Box
            onClick={onClick}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.625,
                height: 28,
                px: 1.25,
                borderRadius: 999,
                border: "1px solid",
                borderColor: active ? "primary.main" : "divider",
                bgcolor: active ? "var(--plando-primary-soft)" : "background.paper",
                color: active ? "primary.main" : "text.secondary",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                userSelect: "none",
                flexShrink: 0,
                transition: "background var(--plando-dur-fast) var(--plando-ease)",
                "&:hover": {
                    bgcolor: active ? "var(--plando-primary-soft)" : "var(--plando-surface-low)",
                },
            }}
        >
            {icon}
            {label}
            {badge && (
                <Box
                    sx={{
                        ml: 0.25,
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        bgcolor: "primary.main",
                    }}
                />
            )}
        </Box>
    );
}
