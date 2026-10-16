import React, { useState } from "react";
import { Box, Collapse, Divider, ListItemIcon, Menu, MenuItem, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { useProjects, deleteProjectById } from "../features/project/store/projectStore.js";
import { useWorkspacePermissions } from "../features/workspace/hooks/useWorkspacePermissions.js";
import { toast } from "../shared/utils/toast.js";
import { getApiError } from "../shared/api/axiosInstance.js";
import { getProjectIcon } from "../features/project/projectIcons.js";
import { useActiveProject } from "../features/project/context/ActiveProjectContext.jsx";
import { getTaskPath } from "../features/todo/utils/taskView.js";
import { getMenuGlassSx } from "../shared/ui/glassSx.js";
import { NavItem } from "./SidebarNavItem.jsx";
import ProjectCreateDialog from "../features/project/components/ProjectCreateDialog.jsx";
import ConfirmDialog from "../shared/ui/common/ConfirmDialog.jsx";

/**
 * 사이드바 "할 일" 스코프 네비게이터.
 * 스코프(전체 / 인박스 / 프로젝트들)를 고르면 글로벌 스코프 설정 + 할 일 surface로 이동.
 * (뷰=보드/목록은 본문 탭에서 전환 — 스코프×뷰 분리)
 */
export default function SidebarScopeNav({ collapsed, onMobileClose, onNewProject }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const navigate = useNavigate();
    const { activeProjectId, setActiveProject } = useActiveProject();

    const allProjects = useProjects();
    const projects = allProjects;
    const [open, setOpen] = useState(true);
    const [projMenuAnchor, setProjMenuAnchor] = useState(null);
    const [moreAnchor, setMoreAnchor] = useState(null);
    const [moreProject, setMoreProject] = useState(null);
    const [editProject, setEditProject] = useState(null);
    const [deleteProject, setDeleteProject] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const pending = (p) => Math.max(0, p.todoCount - p.doneCount);

    // 서버 규칙: 수정·생성 = MEMBER 이상(requireCanEditProject / requireCanCreateContent),
    // 삭제 = 작성자 본인 || ADMIN 이상. 규칙이 서로 달라 항목별로 따로 비활성 + 이유를 붙인다.
    // (예전엔 "수정은 열어둔다"고 적혀 있었지만 실제로 수정도 MEMBER 이상이라 VIEWER가 403을 맞았다.)
    const { canDeleteProject, canEditContent } = useWorkspacePermissions();
    const canDeleteMoreProject = !!moreProject && canDeleteProject(moreProject);

    const go = (scope) => {
        if (isMobile) {
            // 모바일은 기존 구조 유지: 프로젝트는 단일 페이지(ProjectDetailPage)로
            if (scope == null) navigate("/todos");
            else if (scope === "inbox") navigate("/projects/inbox");
            else navigate(`/projects/${scope}`);
        } else {
            setActiveProject(scope);
            navigate(getTaskPath());
        }
        onMobileClose?.();
    };

    // 공통 스코프 항목 (전체/인박스/프로젝트)
    const items = [
        { key: "all", label: "전체 할 일", scope: null, icon: <ListAltRoundedIcon sx={{ fontSize: 17 }} />, active: activeProjectId == null },
        { key: "inbox", label: "인박스", scope: "inbox", icon: <InboxRoundedIcon sx={{ fontSize: 16 }} />, active: activeProjectId === "inbox" },
    ];

    if (collapsed) {
        return (
            <Stack spacing={0.25} sx={{ alignItems: "stretch" }}>
                <NavItem icon={<ListAltRoundedIcon />} label="전체" active={activeProjectId == null} collapsed onClick={() => go(null)} />
                <NavItem icon={<InboxRoundedIcon />} label="인박스" active={activeProjectId === "inbox"} collapsed onClick={() => go("inbox")} />
                <NavItem icon={<FolderRoundedIcon />} label="프로젝트" active={typeof activeProjectId === "number"} collapsed onClick={(e) => setProjMenuAnchor(e.currentTarget)} />

                {/* 접힘 시 프로젝트는 팝오버로 */}
                <Menu
                    anchorEl={projMenuAnchor}
                    open={Boolean(projMenuAnchor)}
                    onClose={() => setProjMenuAnchor(null)}
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "left" }}
                    PaperProps={{ sx: { minWidth: 208, ml: 1, borderRadius: "12px", ...getMenuGlassSx(theme) } }}
                >
                    <Typography variant="caption" sx={{ px: 2, pt: 1.2, pb: 0.5, display: "block", fontWeight: 800, fontSize: 10.5, color: "text.disabled", letterSpacing: 0.5, textTransform: "uppercase" }}>
                        프로젝트
                    </Typography>
                    {projects.map((p) => {
                        const Icon = getProjectIcon(p.icon);
                        return (
                            <MenuItem
                                key={p.id}
                                onClick={() => { go(p.id); setProjMenuAnchor(null); }}
                                selected={activeProjectId === p.id}
                                sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75 }}
                            >
                                <Icon sx={{ fontSize: 18, color: p.color, mr: 1.25, flexShrink: 0 }} />
                                <Typography variant="body2" sx={{ flex: 1, fontWeight: 700, fontSize: 13 }} noWrap>{p.name}</Typography>
                                {pending(p) > 0 && (
                                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "text.disabled", ml: 1 }}>{pending(p)}</Typography>
                                )}
                            </MenuItem>
                        );
                    })}
                    {projects.length === 0 && (
                        <Typography sx={{ px: 2, py: 1, fontSize: 12.5, color: "text.disabled" }}>아직 프로젝트가 없어요</Typography>
                    )}
                    <Divider sx={{ my: 0.5 }} />
                    {/* 프로젝트 생성 = MEMBER 이상. VIEWER에겐 비활성 + 이유 (생성 창을 다 채운 뒤 403을 맞지 않게) */}
                    <MenuItem
                        disabled={!canEditContent}
                        onClick={() => { setProjMenuAnchor(null); onNewProject?.(); }}
                        sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75 }}
                    >
                        <AddRoundedIcon sx={{ fontSize: 18, color: "text.secondary", mr: 1.25 }} />
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>새 프로젝트</Typography>
                    </MenuItem>
                    {!canEditContent && (
                        /* 비활성 MenuItem은 툴팁이 안 뜨므로(pointer-events 없음) 이유를 아래에 직접 적는다 */
                        <Typography sx={{ px: 2, pb: 1, pt: 0.25, fontSize: 11.5, fontWeight: 600, color: "text.disabled", maxWidth: 200, lineHeight: 1.45 }}>
                            읽기 전용 역할은 프로젝트를 만들 수 없어요
                        </Typography>
                    )}
                </Menu>
            </Stack>
        );
    }

    return (
        <Box sx={{ px: 1 }}>
            {items.map((it) => (
                <ScopeRow
                    key={it.key}
                    active={it.active}
                    onClick={() => go(it.scope)}
                    leading={<Box sx={{ width: 18, display: "flex", justifyContent: "center", color: it.active ? "primary.main" : "text.disabled" }}>{it.icon}</Box>}
                    label={it.label}
                />
            ))}

            {/* 프로젝트 — 부모 탭(다른 nav와 동일 스타일) + 하위 아코디언 */}
            <Box
                onClick={() => setOpen((v) => !v)}
                sx={{
                    display: "flex", alignItems: "center", gap: 1.25,
                    width: "100%", height: 36, px: 1.5, mt: 0.25,
                    borderRadius: "10px", cursor: "pointer",
                    transition: "background 120ms ease",
                    "&:hover": { background: theme.palette.action.hover },
                    "&:hover .proj-add": { opacity: 1 },
                }}
            >
                <Box sx={{ width: 18, display: "flex", justifyContent: "center", color: "text.disabled" }}>
                    <FolderRoundedIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ flex: 1, fontSize: 13, fontWeight: 700, letterSpacing: "-0.015em", color: "text.secondary" }}>
                    프로젝트
                </Box>
                {/* 호버로만 나타나는 + 버튼 — 생성 권한(MEMBER 이상)이 없으면 아예 렌더하지 않는다.
                    비활성 상태로 두면 호버 때만 흐릿하게 나타났다 사라져 이유를 읽을 틈이 없다.
                    (권한 안내는 접힘 메뉴의 "새 프로젝트" 항목에 문구로 남아 있다) */}
                {canEditContent && (
                    <Box
                        component="span"
                        role="button"
                        aria-label="새 프로젝트"
                        className="proj-add"
                        onClick={(e) => { e.stopPropagation(); onNewProject?.(); }}
                        sx={{
                            width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: "6px", cursor: "pointer", color: "text.disabled", opacity: 0,
                            transition: "opacity 0.12s, background 0.12s, color 0.12s",
                            "&:hover": { color: "text.secondary", background: alpha(theme.palette.text.primary, 0.07) },
                        }}
                    >
                        <AddRoundedIcon sx={{ fontSize: 15 }} />
                    </Box>
                )}
                <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: "text.disabled", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", flexShrink: 0 }} />
            </Box>

            <Collapse in={open} unmountOnExit>
                <Box sx={{ pl: 1 }}>
                    {projects.map((p) => {
                        const active = activeProjectId === p.id;
                        const Icon = getProjectIcon(p.icon);
                        return (
                            <Box
                                key={p.id}
                                sx={{ position: "relative", "&:hover .proj-more": { opacity: 1, pointerEvents: "auto" }, "&:hover .proj-count": { opacity: 0 } }}
                            >
                                <ScopeRow
                                    active={active}
                                    tint={p.color}
                                    onClick={() => go(p.id)}
                                    leading={<Box sx={{ width: 18, display: "flex", justifyContent: "center", color: p.color }}><Icon sx={{ fontSize: 16 }} /></Box>}
                                    label={p.name}
                                    trailing={null}
                                    reserveRight={38}
                                />
                                {pending(p) > 0 && (
                                    <Box className="proj-count" sx={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11.5, fontWeight: 700, color: "text.secondary", fontVariantNumeric: "tabular-nums", pointerEvents: "none", transition: "opacity 0.1s" }}>
                                        {pending(p)}
                                    </Box>
                                )}
                                {!isMobile && (
                                    <Box
                                        className="proj-more"
                                        component="span"
                                        role="button"
                                        aria-label="프로젝트 메뉴"
                                        onClick={(e) => { e.stopPropagation(); setMoreProject(p); setMoreAnchor(e.currentTarget); }}
                                        sx={{
                                            position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            width: 22, height: 22, borderRadius: "6px", cursor: "pointer",
                                            color: "text.disabled", opacity: 0, pointerEvents: "none", transition: "opacity 0.1s",
                                            "&:hover": { color: "text.primary", background: alpha(theme.palette.text.primary, 0.08) },
                                        }}
                                    >
                                        <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                    {projects.length === 0 && (
                        <Typography sx={{ px: 1.5, py: 1, fontSize: 12, fontWeight: 500, color: "text.disabled" }}>
                            아직 프로젝트가 없어요
                        </Typography>
                    )}
                </Box>
            </Collapse>

            {/* 프로젝트 컨텍스트 메뉴 (수정/삭제) */}
            <Menu
                anchorEl={moreAnchor}
                open={Boolean(moreAnchor)}
                onClose={() => setMoreAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{ sx: { minWidth: 160, borderRadius: "12px", ...getMenuGlassSx(theme) } }}
            >
                <MenuItem
                    disabled={!canEditContent}
                    onClick={() => { setMoreAnchor(null); setEditProject(moreProject); }}
                    sx={{ mx: 0.5, my: 0.25, borderRadius: "8px", fontSize: 13.5, fontWeight: 700 }}
                >
                    <ListItemIcon sx={{ minWidth: 30 }}><EditRoundedIcon sx={{ fontSize: 17 }} /></ListItemIcon>
                    수정
                </MenuItem>
                {!canEditContent && (
                    /* 비활성 MenuItem은 툴팁이 안 뜨므로(pointer-events 없음) 이유를 아래에 직접 적는다 */
                    <Typography sx={{ px: 1.5, pb: 0.75, pt: 0.25, fontSize: 11.5, fontWeight: 600, color: "text.disabled", maxWidth: 200, lineHeight: 1.45 }}>
                        읽기 전용 역할은 프로젝트를 수정할 수 없어요
                    </Typography>
                )}
                <MenuItem
                    disabled={!canDeleteMoreProject}
                    onClick={() => { setMoreAnchor(null); setDeleteProject(moreProject); }}
                    sx={{ mx: 0.5, my: 0.25, borderRadius: "8px", fontSize: 13.5, fontWeight: 700, color: "error.main" }}
                >
                    <ListItemIcon sx={{ minWidth: 30 }}><DeleteOutlineRoundedIcon sx={{ fontSize: 17, color: "error.main" }} /></ListItemIcon>
                    삭제
                </MenuItem>
                {!canDeleteMoreProject && (
                    /* 비활성 MenuItem은 툴팁이 안 뜨므로(pointer-events 없음) 이유를 아래에 직접 적는다 */
                    <Typography sx={{ px: 1.5, pb: 1, pt: 0.25, fontSize: 11.5, fontWeight: 600, color: "text.disabled", maxWidth: 200, lineHeight: 1.45 }}>
                        만든 사람이나 관리자만 삭제할 수 있어요
                    </Typography>
                )}
            </Menu>

            <ProjectCreateDialog open={Boolean(editProject)} project={editProject} onClose={() => setEditProject(null)} />

            <ConfirmDialog
                open={Boolean(deleteProject)}
                title="프로젝트 삭제"
                message={deleteProject ? `"${deleteProject.name}" 프로젝트를 삭제할까요?\n삭제하면 되돌릴 수 없어요. (할 일 자체는 삭제되지 않아요)` : ""}
                confirmText="삭제"
                loading={deleting}
                onClose={() => { if (!deleting) setDeleteProject(null); }}
                onConfirm={async () => {
                    /* 반드시 await 한다. 예전엔 응답을 기다리지 않고 창을 닫고 이동해버려서
                       실패(403 등)해도 성공한 것처럼 보였고, 프로젝트는 그대로 남아 있었다. */
                    if (deleting) return;
                    const target = deleteProject;
                    const wasActive = activeProjectId === target.id;
                    setDeleting(true);
                    try {
                        await deleteProjectById(target.id);
                    } catch (e) {
                        toast.error(getApiError(e, "프로젝트 삭제에 실패했어요."));
                        return; // 실패 시 확인 창을 닫지 않는다 — 재시도할 수 있게
                    } finally {
                        setDeleting(false);
                    }
                    setDeleteProject(null);
                    toast.success("프로젝트가 삭제됐어요 · 할 일은 인박스로 이동");
                    if (wasActive) go(null);
                }}
            />
        </Box>
    );
}

/**
 * @param reserveRight 오른쪽에 겹쳐 놓는 요소(개수 배지·⋯ 버튼)를 위해 비워둘 폭(px).
 *   프로젝트 행은 개수와 ⋯ 를 position:absolute 로 같은 자리에 겹쳐 쓴다(호버 시 교체).
 *   그래서 라벨이 그 자리를 비워두지 않으면 긴 이름이 숫자 위로 파고든다
 *   (실제로 "논산시 2026 공간정보…" 가 개수와 겹쳐 보였다).
 */
function ScopeRow({ active, tint, onClick, leading, label, trailing, muted, reserveRight = 0 }) {
    const theme = useTheme();
    const activeBg = tint ? alpha(tint, 0.12) : "var(--plando-primary-soft)";
    return (
        <Box
            component="button"
            onClick={onClick}
            sx={{
                display: "flex", alignItems: "center", gap: 1.25, width: "100%",
                padding: "7px 10px", borderRadius: "8px", border: "none",
                paddingRight: reserveRight ? `${reserveRight}px` : "10px",
                background: active ? activeBg : "transparent",
                cursor: "pointer", textAlign: "left", fontFamily: "var(--plando-font)",
                transition: "background 0.15s",
                "&:hover": { background: active ? activeBg : alpha(theme.palette.text.primary, 0.05) },
            }}
        >
            {leading}
            <Box
                sx={{
                    flex: 1,
                    fontSize: 13.5,
                    fontWeight: active ? 700 : 500,
                    color: muted ? theme.palette.text.disabled : theme.palette.text.primary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </Box>
            {trailing != null && (
                <Box sx={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: theme.palette.text.secondary, fontVariantNumeric: "tabular-nums" }}>
                    {trailing}
                </Box>
            )}
        </Box>
    );
}
