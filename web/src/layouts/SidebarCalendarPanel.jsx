import React, { useState, useEffect, useMemo } from "react";
import { Box, Typography, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { useProjects } from "../features/project/store/projectStore.js";
import { useActiveProject } from "../features/project/context/ActiveProjectContext.jsx";
import { useWorkspace } from "../features/workspace/context/WorkspaceContext.jsx";
import { fetchTodos } from "../features/todo/api/todoApi.js";
import { toCalendarEvent } from "../features/calendar/utils/calendarUtils.js";
import { APP_EVENTS } from "../shared/constants/events.js";
import { StatusTag } from "../shared/ui/common/Tags.jsx";
import { getProjectIcon } from "../features/project/projectIcons.js";
import { NavItem, SectionLabel } from "./SidebarNavItem.jsx";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function dayLabel(date) {
    const today = startOfToday();
    const diff = Math.round((new Date(date).setHours(0, 0, 0, 0) - today.getTime()) / 86400000);
    if (diff === 0) return "오늘";
    if (diff === 1) return "내일";
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

function timeLabel(event) {
    if (event.allDay) return null;
    const d = event.start;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 캘린더 섹션 맥락 패널 — 프로젝트 필터(전역 스코프 = 캘린더 즉시 필터) + 다가오는 일정 아젠다.
 * 프로젝트 선택은 ActiveProjectContext를 통해 캘린더 filteredEvents에 바로 반영된다.
 * 일정 클릭은 /calendar로 해당 날짜를 열어준다(이미 캘린더면 페이지 내 점프).
 */
export default function SidebarCalendarPanel({ onMobileClose }) {
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const { activeProjectId, setActiveProject, matchesActiveProject } = useActiveProject();
    const projects = useProjects();
    const [todos, setTodos] = useState([]);

    // 워크스페이스 변경 / 할 일 변경 시 아젠다 재조회
    useEffect(() => {
        let alive = true;
        const load = () => {
            fetchTodos()
                .then((r) => { if (alive) setTodos(r.data || []); })
                .catch(() => { if (alive) setTodos([]); });
        };
        load();
        const onChange = () => load();
        window.addEventListener(APP_EVENTS.TODO_ADDED, onChange);
        window.addEventListener(APP_EVENTS.TODO_UPDATED, onChange);
        window.addEventListener(APP_EVENTS.TODO_DELETED, onChange);
        return () => {
            alive = false;
            window.removeEventListener(APP_EVENTS.TODO_ADDED, onChange);
            window.removeEventListener(APP_EVENTS.TODO_UPDATED, onChange);
            window.removeEventListener(APP_EVENTS.TODO_DELETED, onChange);
        };
    }, [currentWorkspace?.workspaceId]);

    const upcoming = useMemo(() => {
        const today = startOfToday();
        return (todos || [])
            .filter((t) => t.status !== "DONE")
            .filter((t) => matchesActiveProject(t))
            .map(toCalendarEvent)
            .filter(Boolean)
            .filter((e) => e.start >= today)
            .sort((a, b) => a.start - b.start)
            .slice(0, 8);
    }, [todos, matchesActiveProject]);

    const selectScope = (scope) => {
        setActiveProject(scope);
        onMobileClose?.();
    };

    const openDate = (event) => {
        navigate("/calendar", { state: { date: event.start.toISOString() } });
        onMobileClose?.();
    };

    return (
        <Box
            className="plando-scroll"
            sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", px: 1.75, py: 0.5, display: "flex", flexDirection: "column" }}
        >
            {/* 프로젝트 필터 — 캘린더에 즉시 반영 */}
            <SectionLabel collapsed={false}>표시할 프로젝트</SectionLabel>
            <Stack spacing={0.25} sx={{ px: 0.25 }} alignItems="stretch">
                <NavItem
                    icon={<ListAltRoundedIcon sx={{ fontSize: 17 }} />}
                    label="전체 일정"
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
                            badge={Math.max(0, (p.todoCount ?? 0) - (p.doneCount ?? 0)) || null}
                            collapsed={false}
                            onClick={() => selectScope(p.id)}
                        />
                    );
                })}
            </Stack>

            {/* 다가오는 일정 */}
            <SectionLabel collapsed={false}>다가오는 일정</SectionLabel>
            {upcoming.length === 0 ? (
                <Typography sx={{ px: 1, py: 1.5, fontSize: 12.5, color: "text.disabled" }}>
                    예정된 일정이 없어요
                </Typography>
            ) : (
                <Stack spacing={0.25} sx={{ px: 0.25, pb: 1 }}>
                    {upcoming.map((e) => {
                        const status = e.resource?.status ?? "TODO";
                        const t = timeLabel(e);
                        return (
                            <Box
                                key={e.id}
                                onClick={() => openDate(e)}
                                sx={{
                                    display: "flex", alignItems: "flex-start", gap: 1,
                                    px: 1, py: 0.85, borderRadius: "8px", cursor: "pointer",
                                    "&:hover": { bgcolor: "action.hover" },
                                }}
                            >
                                <StatusTag status={status} variant="dot" size="xs" sx={{ mt: "5px" }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {e.title}
                                    </Typography>
                                    <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.1 }}>
                                        {dayLabel(e.start)}{t ? ` · ${t}` : ""}
                                    </Typography>
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}
