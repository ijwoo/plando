import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, IconButton, Stack, SwipeableDrawer, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";

import { useProjects } from "../store/projectStore.js";
import { useActiveProject } from "../context/ActiveProjectContext.jsx";
import { getProjectIcon } from "../projectIcons.js";
import { projectIconColor } from "../utils/projectOptions.js";
import ProjectCreateDialog from "./ProjectCreateDialog.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { Z } from "../../../shared/ui/zIndex.js";

/**
 * 모바일 할일 탭 상단 — 글로벌 스코프(전체/인박스/프로젝트) 드롭다운 + 바텀 시트.
 * 데스크탑 사이드바(SidebarScopeNav)와 동일한 ActiveProjectContext 스코프를 읽고 쓴다.
 * 카운트는 mock(p.todoCount) 기준 — 백엔드 연동 시 실데이터로 교체.
 */
export default function MobileProjectFilter({ pendingCount }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const allProjects = useProjects();
    const projects = allProjects;
    const { activeProjectId, activeProject, setActiveProject } = useActiveProject();

    const isDark = theme.palette.mode === "dark";
    const isAll = activeProjectId == null;
    const isInbox = activeProjectId === "inbox";

    const scopeLabel = isAll ? "전체 할 일" : isInbox ? "인박스" : (activeProject?.name ?? "프로젝트");
    const TriggerIcon = activeProject ? getProjectIcon(activeProject.icon) : isInbox ? InboxRoundedIcon : ListAltRoundedIcon;
    const pending = (p) => Math.max(0, p.todoCount - p.doneCount);

    const pick = (scope) => {
        setOpen(false);
        setActiveProject(scope);
    };

    return (
        <>
            <Box
                component="button"
                onClick={() => setOpen(true)}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    width: "100%",
                    padding: "7px 16px",
                    margin: 0,
                    border: "none",
                    background: isDark
                        ? alpha(theme.palette.background.paper, 0.5)
                        : theme.palette.background.paper,
                    borderRadius: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    borderBottom: `1px solid ${theme.palette.divider}`,
                }}
            >
                <TriggerIcon
                    sx={{
                        fontSize: activeProject ? 15 : 14,
                        color: projectIconColor(activeProject?.color) ?? theme.palette.text.secondary,
                        flexShrink: 0,
                    }}
                />
                <Typography
                    sx={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: theme.palette.text.primary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {scopeLabel}
                </Typography>
                {pendingCount != null && (
                    <Typography
                        sx={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: theme.palette.text.disabled,
                            flexShrink: 0,
                        }}
                    >
                        {pendingCount}개 남음
                    </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <KeyboardArrowDownRoundedIcon
                    sx={{ fontSize: 18, color: theme.palette.text.secondary }}
                />
            </Box>

            <SwipeableDrawer
                anchor="bottom"
                open={open}
                onClose={() => setOpen(false)}
                onOpen={() => setOpen(true)}
                disableSwipeToOpen
                sx={{ zIndex: Z.SHEET }}
                PaperProps={{
                    sx: {
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        maxHeight: "70vh",
                    },
                }}
            >
                <Box sx={{ width: "100%", pb: "calc(20px + env(safe-area-inset-bottom))" }}>
                    {/* drag handle */}
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5, pb: 1 }}>
                        <Box
                            sx={{
                                width: 36, height: 4,
                                borderRadius: 2,
                                background: theme.palette.text.disabled,
                                opacity: 0.4,
                            }}
                        />
                    </Box>

                    <Typography
                        sx={{
                            fontSize: 15, fontWeight: 700,
                            textAlign: "center",
                            color: theme.palette.text.primary,
                            mb: 2,
                        }}
                    >
                        보기 범위
                    </Typography>

                    {/* 전체 / 인박스 */}
                    <Stack sx={{ px: 1.5, mb: 1.5 }}>
                        <SheetRow
                            icon={<ListAltRoundedIcon sx={{ fontSize: 17, color: isAll ? theme.palette.primary.main : theme.palette.text.secondary }} />}
                            label="전체 할 일"
                            selected={isAll}
                            onClick={() => pick(null)}
                        />
                        <SheetRow
                            icon={<InboxRoundedIcon sx={{ fontSize: 16, color: isInbox ? theme.palette.primary.main : theme.palette.text.secondary }} />}
                            label="인박스"
                            selected={isInbox}
                            onClick={() => pick("inbox")}
                        />
                    </Stack>

                    {/* 프로젝트 */}
                    <Typography
                        sx={{
                            fontSize: 11.5, fontWeight: 700,
                            color: theme.palette.text.secondary,
                            px: 2, mb: 0.5,
                            letterSpacing: "0.04em",
                        }}
                    >
                        프로젝트
                    </Typography>
                    <Stack sx={{ px: 1.5 }}>
                        {projects.map((p) => {
                            const Icon = getProjectIcon(p.icon);
                            return (
                                <Box key={p.id} sx={{ display: "flex", alignItems: "center" }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SheetRow
                                            icon={<Icon sx={{ fontSize: 17, color: projectIconColor(p.color) || theme.palette.text.disabled }} />}
                                            label={p.name}
                                            count={pending(p)}
                                            tint={p.color}
                                            selected={activeProjectId === p.id}
                                            onClick={() => pick(p.id)}
                                        />
                                    </Box>
                                    {/* 행 탭=필터, > 탭=프로젝트 홈 (Press — 터치에서 click 합성에 의존하지 않게) */}
                                    <Press
                                        onClick={() => {
                                            // 시트가 열린 채 라우트를 바꾸면 전환이 되돌아오는 경합이 있어
                                            // 닫힘 트랜지션이 끝난 뒤 이동한다.
                                            setOpen(false);
                                            setTimeout(() => navigate(`/projects/${p.id}`), 250);
                                        }}
                                        haptic="light"
                                        pressScale={0.9}
                                        aria-label="프로젝트 홈"
                                        style={{
                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                            width: 36, height: 36, marginRight: 6, borderRadius: 999,
                                            color: theme.palette.text.disabled,
                                        }}
                                    >
                                        <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />
                                    </Press>
                                </Box>
                            );
                        })}
                        {projects.length === 0 && (
                            <Typography sx={{ px: 1.5, py: 1, fontSize: 12.5, color: theme.palette.text.disabled }}>
                                아직 프로젝트가 없어요
                            </Typography>
                        )}
                    </Stack>

                    {/* 새 프로젝트 */}
                    <Box sx={{ px: 1.5, mt: 1.5 }}>
                        <Box
                            component="button"
                            onClick={() => { setOpen(false); setCreateOpen(true); }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                width: "100%",
                                padding: "12px 14px",
                                border: `1px dashed ${theme.palette.divider}`,
                                borderRadius: 2,
                                background: "transparent",
                                cursor: "pointer",
                                textAlign: "left",
                                fontFamily: "inherit",
                                color: theme.palette.text.secondary,
                                fontSize: 14,
                                fontWeight: 600,
                            }}
                        >
                            <AddRoundedIcon sx={{ fontSize: 18 }} />
                            새 프로젝트
                        </Box>
                    </Box>
                </Box>
            </SwipeableDrawer>

            <ProjectCreateDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={(p) => setActiveProject(p.id)}
            />
        </>
    );
}

/** 시트 선택 행 — 스코프(전체/인박스)와 프로젝트 공용. tint = 선택 배경 틴트(기본 primary), count = 미완료 수 */
function SheetRow({ icon, label, selected, onClick, count, tint }) {
    const theme = useTheme();
    return (
        <Box
            component="button"
            onClick={onClick}
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                width: "100%",
                padding: "12px 14px",
                border: "none",
                borderRadius: 2,
                background: selected ? alpha(tint || theme.palette.primary.main, 0.12) : "transparent",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
            }}
        >
            <Box sx={{ width: 18, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                {icon}
            </Box>
            <Typography
                sx={{
                    flex: 1,
                    fontSize: 14.5,
                    fontWeight: selected ? 700 : 500,
                    color: theme.palette.text.primary,
                }}
            >
                {label}
            </Typography>
            {count != null && (
                <Typography
                    sx={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: theme.palette.text.secondary,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {count}
                </Typography>
            )}
        </Box>
    );
}
