import React from "react";
import { Box, Stack } from "@mui/material";
import RepeatIcon from "@mui/icons-material/Repeat";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import VisitTaskList from "../features/map/components/VisitTaskList.jsx";
import { useMapUi } from "../features/map/context/MapUiContext.jsx";
import { useProjects } from "../features/project/store/projectStore.js";
import { useActiveProject } from "../features/project/context/ActiveProjectContext.jsx";
import { getProjectIcon } from "../features/project/projectIcons.js";
import { NavItem, SectionLabel } from "./SidebarNavItem.jsx";

const PILL_FILTERS = [
    { key: "all",         label: "전체" },
    { key: "todo",        label: "할 일" },
    { key: "in_progress", label: "진행 중" },
    { key: "done",        label: "완료" },
    { key: "mine",        label: "내 할 일" },
];

/**
 * 지도 섹션 맥락 패널 — 상태 요약 + 필터 + 위치 할 일 목록.
 * 필터/선택은 MapUiContext 공유 상태라 지도 캔버스 마커·포커스에 즉시 반영(별도 네비 불필요).
 */
export default function SidebarMapPanel({ onMobileClose }) {
    const {
        filteredTasks, counts,
        selectedTask, setSelectedTask,
        filter, setFilter,
        recurringOnly, setRecurringOnly,
    } = useMapUi();
    const { activeProjectId, setActiveProject } = useActiveProject();
    const projects = useProjects();

    const selectScope = (scope) => {
        setActiveProject(scope);
        onMobileClose?.();
    };

    const onSelect = (task) => {
        setSelectedTask(task);
        onMobileClose?.();
    };

    return (
        <Box className="plando-scroll" sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
            {/* 표시할 프로젝트 — 전역 스코프(지도 마커에 즉시 반영) */}
            <Box sx={{ px: 1.75 }}>
                <SectionLabel collapsed={false}>표시할 프로젝트</SectionLabel>
            </Box>
            <Stack spacing={0.25} sx={{ px: 2, pb: 0.5 }} alignItems="stretch">
                <NavItem
                    icon={<ListAltRoundedIcon sx={{ fontSize: 17 }} />}
                    label="전체 위치"
                    active={activeProjectId == null}
                    collapsed={false}
                    onClick={() => selectScope(null)}
                />
                <NavItem
                    icon={<InboxRoundedIcon sx={{ fontSize: 16 }} />}
                    label="인박스"
                    active={activeProjectId === "inbox"}
                    collapsed={false}
                    onClick={() => selectScope("inbox")}
                />
                {projects.map((p) => {
                    const Icon = getProjectIcon(p.icon);
                    return (
                        <NavItem
                            key={p.id}
                            icon={<Icon sx={{ fontSize: 17, color: p.color }} />}
                            label={p.name}
                            active={activeProjectId === p.id}
                            collapsed={false}
                            onClick={() => selectScope(p.id)}
                        />
                    );
                })}
            </Stack>

            {/* 상태 — 칩에 카운트 인라인 (요약 카드 대체) */}
            <Box sx={{ px: 1.75 }}>
                <SectionLabel collapsed={false}>상태</SectionLabel>
            </Box>
            <Box sx={{ px: 1.75, pb: 1, display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {PILL_FILTERS.map(({ key, label }) => {
                    const selected = filter === key;
                    return (
                        <Box
                            key={key}
                            component="button"
                            onClick={() => setFilter(key)}
                            sx={{
                                height: 28, pl: "10px", pr: "8px", borderRadius: 999,
                                border: selected ? "1px solid transparent" : "1px solid var(--plando-border)",
                                bgcolor: selected ? "var(--plando-primary-soft)" : "transparent",
                                color: selected ? "var(--plando-primary)" : "var(--plando-text-secondary)",
                                fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                display: "inline-flex", alignItems: "center", gap: "5px",
                                transition: "background 0.15s, border-color 0.15s",
                            }}
                        >
                            {label}
                            <Box
                                component="span"
                                sx={{
                                    fontSize: 10.5, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                                    minWidth: 16, textAlign: "center", px: "5px", borderRadius: 999, lineHeight: "16px",
                                    bgcolor: selected ? "var(--plando-primary)" : "var(--plando-gray-soft)",
                                    color: selected ? "#fff" : "var(--plando-text-tertiary)",
                                }}
                            >
                                {counts[key] ?? 0}
                            </Box>
                        </Box>
                    );
                })}
                <Box
                    component="button"
                    onClick={() => setRecurringOnly((v) => !v)}
                    sx={{
                        height: 28, px: "10px", borderRadius: 999,
                        border: recurringOnly ? "1px solid transparent" : "1px solid var(--plando-border)",
                        bgcolor: recurringOnly ? "var(--plando-primary-soft)" : "transparent",
                        color: recurringOnly ? "var(--plando-primary)" : "var(--plando-text-secondary)",
                        fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        display: "inline-flex", alignItems: "center", gap: "4px",
                    }}
                >
                    <RepeatIcon sx={{ fontSize: 13 }} />반복만
                </Box>
            </Box>

            {/* 위치 할 일 목록 라벨 */}
            <Box sx={{ px: 1.75 }}>
                <SectionLabel collapsed={false}>장소 일정 {filteredTasks.length}</SectionLabel>
            </Box>

            {/* 위치 할 일 목록 */}
            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1, pb: 2 }}>
                <VisitTaskList
                    tasks={filteredTasks}
                    selectedId={selectedTask?.id}
                    onSelect={onSelect}
                    showTitle={false}
                />
            </Box>
        </Box>
    );
}
