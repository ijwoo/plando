import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import { NavItem } from "./SidebarNavItem.jsx";

const SECTIONS = [
    { id: "profile",       label: "프로필",       Icon: PersonRoundedIcon },
    { id: "display",       label: "화면 설정",     Icon: PaletteRoundedIcon },
    { id: "tasks",         label: "작업 기본값",   Icon: TaskAltRoundedIcon },
    { id: "notifications", label: "알림",          Icon: NotificationsRoundedIcon },
    { id: "workspace",     label: "워크스페이스",   Icon: WorkspacesIcon },
    { id: "templates",     label: "태스크 템플릿", Icon: AutoAwesomeRoundedIcon },
];

/**
 * 설정 섹션 맥락 패널 — 설정 페이지의 섹션 내비를 글로벌 사이드바로 이동.
 * 클릭 시 /settings로 navigation-state(section)를 넘겨 페이지가 해당 섹션을 연다(캘린더 날짜 점프와 동일 채널).
 */
export default function SidebarSettingsPanel({ onMobileClose }) {
    const location = useLocation();
    const navigate = useNavigate();
    const active = location.state?.section ?? "profile";

    const go = (id) => {
        navigate("/settings", { state: { section: id } });
        onMobileClose?.();
    };

    return (
        <Box className="plando-scroll" sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", px: 1.75, py: 0.5, display: "flex", flexDirection: "column" }}>
            <Stack spacing={0.25} alignItems="stretch">
                {SECTIONS.map(({ id, label, Icon }) => (
                    <NavItem
                        key={id}
                        icon={<Icon sx={{ fontSize: 18 }} />}
                        label={label}
                        active={active === id}
                        collapsed={false}
                        onClick={() => go(id)}
                    />
                ))}
            </Stack>

            <Box sx={{ height: "1px", bgcolor: "divider", my: 1, mx: 0.5 }} />

            <NavItem
                icon={<ManageAccountsRoundedIcon sx={{ fontSize: 18 }} />}
                label="계정"
                active={active === "account"}
                collapsed={false}
                onClick={() => go("account")}
            />

            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 11, color: "text.disabled", px: 1.5, py: 1 }}>Plando v1.0</Typography>
        </Box>
    );
}
