import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ScopeTitle from "../../../../project/components/ScopeTitle.jsx";
import { useActiveProject } from "../../../../project/context/ActiveProjectContext.jsx";
import HeaderActionButton from "../../../../../shared/ui/common/HeaderActionButton.jsx";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import SegmentedControl from "../../../../../shared/ui/common/SegmentedControl.jsx";
import TaskViewTabs from "../TaskViewTabs.jsx";
import { TODO_FILTERS, DATE_FILTERS } from "../../../utils/todoFilters.js";

/**
 * 칸반 보드 데스크탑 헤더 (Phase 14).
 * - 제목(스코프) + 뷰 탭 (칸반 / 진행 현황) + 새 할 일
 * - 날짜 필터 chips (오늘/내일/이번 주/반복만) + 스코프 토글 (전체/내 할 일)
 */
const DATE_CHIPS = [
    { key: DATE_FILTERS.TODAY, label: "오늘" },
    { key: DATE_FILTERS.TOMORROW, label: "내일" },
    { key: DATE_FILTERS.THIS_WEEK, label: "이번 주" },
];

export default function BoardHeader({
    scopeLabel,
    scopeColor,
    scopeIcon,
    dateFilter,
    onDateFilterChange,
    recurringOnly,
    onToggleRecurring,
    viewFilter,
    onViewFilterChange,
    counts, // { all, mine, today, tomorrow, week, recurring }
    onAddTask,
}) {
    const navigate = useNavigate();
    const { activeProjectId } = useActiveProject();
    const isProject = typeof activeProjectId === "number";

    return (
        <Box
            sx={{
                px: { md: 3, lg: 4 },
                pt: 3,
                pb: 1.75,
                bgcolor: "background.paper",
                borderBottom: "1px solid",
                borderColor: "divider",
            }}
        >
            {/* Row 1: 제목+칸반토글 한 줄 · 우측 새 할 일 */}
            <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2} sx={{ mb: 1.75 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <ScopeTitle
                            color={scopeColor}
                            iconKey={scopeIcon}
                            label={scopeLabel || "할 일"}
                            onClick={isProject ? () => navigate(`/projects/${activeProjectId}`) : undefined}
                        />
                        <Box sx={{ flexShrink: 0 }}>
                            <TaskViewTabs current="board" />
                        </Box>
                    </Stack>
                </Box>

                <HeaderActionButton icon={<AddRoundedIcon sx={{ fontSize: 17 }} />} onClick={onAddTask}>
                    새 할 일
                </HeaderActionButton>
            </Stack>

            {/* Row 2: date chips + 반복만 + 전체/내 할 일 토글 (반복만 옆) */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                {DATE_CHIPS.map((c) => {
                    const active = dateFilter === c.key;
                    const count = counts?.[c.key] ?? 0;
                    return (
                        <ChipButton
                            key={c.key}
                            active={active}
                            onClick={() => onDateFilterChange?.(active ? null : c.key)}
                            label={c.label}
                            count={count}
                        />
                    );
                })}
                <ChipButton
                    active={recurringOnly}
                    onClick={onToggleRecurring}
                    icon={<RepeatRoundedIcon sx={{ fontSize: 13 }} />}
                    label="반복만"
                    count={counts?.recurring}
                />
                <SegmentedControl
                    options={[
                        { value: TODO_FILTERS.ALL, label: `전체 ${counts?.all ?? 0}` },
                        { value: TODO_FILTERS.ASSIGNED_TO_ME, label: `내 할 일 ${counts?.mine ?? 0}` },
                    ]}
                    value={viewFilter}
                    onChange={onViewFilterChange}
                />
            </Stack>
        </Box>
    );
}

function ChipButton({ active, onClick, label, icon, count }) {
    return (
        <Box
            onClick={onClick}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.625,
                height: 32,
                px: 1.5,
                borderRadius: 999,
                border: "1px solid",
                borderColor: active ? "primary.main" : "divider",
                bgcolor: active ? "primary.main" : "background.paper",
                color: active ? "primary.contrastText" : "text.secondary",
                fontSize: 12.5,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background var(--plando-dur-fast) var(--plando-ease), border-color var(--plando-dur-fast) var(--plando-ease)",
                "&:hover": {
                    bgcolor: active ? "primary.main" : "var(--plando-surface-low)",
                },
            }}
        >
            {icon}
            {label}
            {count !== undefined && count !== null && (
                <Typography
                    component="span"
                    sx={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        opacity: active ? 0.85 : 1,
                        color: active ? "primary.contrastText" : "text.disabled",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {count}
                </Typography>
            )}
        </Box>
    );
}
