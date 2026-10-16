import { getTaskPath } from "../features/todo/utils/taskView.js";
import React from "react";
import { Box, Stack, Tooltip, Avatar, Badge } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useDmUnreadCount } from "../features/dm/hooks/useDmUnreadCount.js";
import { SIDEBAR_RAIL_WIDTH } from "../shared/ui/layout.js";

export const RAIL_WIDTH = SIDEBAR_RAIL_WIDTH;

/**
 * 클릭업 스타일 슬림 아이콘 레일 (좌측 1단).
 * 상위 목적지(대시보드/할 일/캘린더/메시지/지도)를 아이콘+소형 라벨로.
 * 맨 위: 워크스페이스 스위처 / 맨 아래: 설정 · 사용자.
 * 맥락(스코프/프로젝트/스마트뷰)은 옆의 ContextPanel이 담당.
 */
export default function SidebarIconRail({ workspace, workspaceImage, onWorkspaceClick, onSettings, onMobileClose }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const navigate = useNavigate();
    const location = useLocation();
    const dmUnread = useDmUnreadCount();

    const items = [
        { id: "dashboard", label: "홈", icon: <DashboardRoundedIcon />, path: "/dashboard", match: ["/dashboard"] },
        // 주 진입점. /todos(보드)를 박아두면 목록을 쓰는 사람도 매번 보드로 들어간다 —
        // 마지막으로 본 뷰를 따르게 한다(고른 적 없으면 목록).
        { id: "tasks", label: "할 일", icon: <ChecklistRoundedIcon />, path: getTaskPath(), match: ["/todos", "/tasklist", "/projects"] },
        { id: "calendar", label: "캘린더", icon: <CalendarTodayRoundedIcon />, path: "/calendar", match: ["/calendar"] },
        { id: "dm", label: "메시지", icon: <ChatBubbleOutlineRoundedIcon />, path: "/dm", match: ["/dm"], badge: dmUnread || null },
        { id: "map", label: "지도", icon: <RoomRoundedIcon />, path: "/map", match: ["/map"] },
    ];

    const isActive = (m) => m.some((p) => (p === "/todos" ? location.pathname === p : location.pathname.startsWith(p)));

    const go = (path) => { navigate(path); onMobileClose?.(); };

    const wsInitial = workspace?.charAt(0) || "W";

    return (
        <Box
            sx={{
                width: RAIL_WIDTH,
                flexShrink: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderRadius: "16px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                py: 1,
            }}
        >
            {/* 워크스페이스 스위처 */}
            <Tooltip title={workspace || "워크스페이스"} placement="right" arrow>
                <Box
                    component="button"
                    onClick={onWorkspaceClick}
                    sx={{
                        border: "none", cursor: "pointer", p: 0, mb: 1.5, borderRadius: "12px",
                        background: "transparent",
                    }}
                >
                    {workspaceImage ? (
                        <Avatar src={workspaceImage} variant="rounded" sx={{ width: 36, height: 36, borderRadius: "12px" }} />
                    ) : (
                        <Avatar variant="rounded" sx={{ width: 36, height: 36, borderRadius: "12px", fontSize: 15, fontWeight: 800, bgcolor: "primary.main" }}>
                            {wsInitial}
                        </Avatar>
                    )}
                </Box>
            </Tooltip>

            {/* 목적지 */}
            <Stack spacing={0.5} alignItems="center" sx={{ flex: 1, width: "100%" }}>
                {items.map((it) => {
                    const active = isActive(it.match);
                    return (
                        <RailItem key={it.id} active={active} label={it.label} badge={it.badge} onClick={() => go(it.path)} theme={theme} isDark={isDark}>
                            {it.icon}
                        </RailItem>
                    );
                })}
            </Stack>

            {/* 하단: 설정 + 사용자 */}
            <Stack spacing={0.5} alignItems="center" sx={{ width: "100%" }}>
                <RailItem
                    active={location.pathname === "/settings"}
                    label="설정"
                    onClick={onSettings}
                    theme={theme}
                    isDark={isDark}
                >
                    <SettingsRoundedIcon />
                </RailItem>
            </Stack>
        </Box>
    );
}

function RailItem({ active, label, badge, onClick, children, theme, isDark }) {
    const accent = theme.palette.primary.main;
    return (
        <Tooltip title={label} placement="right" arrow>
            <Box
                component="button"
                onClick={onClick}
                aria-label={label}
                sx={{
                    width: 44,
                    height: 44,
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1px",
                    bgcolor: active ? alpha(accent, isDark ? 0.22 : 0.12) : "transparent",
                    color: active ? accent : "text.secondary",
                    transition: "background 0.12s, color 0.12s",
                    "&:hover": { bgcolor: active ? alpha(accent, isDark ? 0.26 : 0.16) : "action.hover", color: active ? accent : "text.primary" },
                    "& svg": { fontSize: 21 },
                }}
            >
                <Badge color="error" variant="dot" invisible={!badge} overlap="circular">
                    {children}
                </Badge>
                <Box component="span" sx={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {label}
                </Box>
            </Box>
        </Tooltip>
    );
}
