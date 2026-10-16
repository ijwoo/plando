import React, { useEffect, useState } from "react";
import {
    Drawer,
    Box,
    Stack,
    Typography,
    Menu,
    MenuItem,
    Divider,
    Snackbar,
    Alert,
    ListItemIcon,
    Avatar,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AddIcon from "@mui/icons-material/Add";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ShareIcon from "@mui/icons-material/Share";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { useNavigate, useLocation } from "react-router-dom";
import { getMenuGlassSx } from "../shared/ui/glassSx.js";
import { resolveImageUrl } from "../shared/utils/urlUtils.js";

import { createWorkspace, joinWorkspace } from "../features/workspace/api/workspaceApi.js";
import { getApiError } from "../shared/api/axiosInstance.js";
import WorkspaceActionDialog from "../features/workspace/components/WorkspaceActionDialog.jsx";
import KakaoInviteDialog from "../features/workspace/components/KakaoInviteDialog.jsx";
import { useWorkspace } from "../features/workspace/context/WorkspaceContext.jsx";
import { useLayout } from "./LayoutContext.jsx";
import WorkspaceEditSheet from "../features/workspace/components/WorkspaceEditSheet.jsx";

import useSidebarCounts from "./useSidebarCounts.js";
import SidebarFocusedItems from "./SidebarFocusedItems.jsx";
import SidebarScopeNav from "./SidebarScopeNav.jsx";
import ProjectCreateDialog from "../features/project/components/ProjectCreateDialog.jsx";
import { NavItem, SectionLabel } from "./SidebarNavItem.jsx";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { loadSavedViews, removeSavedView, SAVED_VIEWS_CHANGED } from "../features/tasklist/utils/savedViews.js";
import SidebarIconRail from "./SidebarIconRail.jsx";
import SidebarQuickCapture from "./SidebarQuickCapture.jsx";
import SidebarDmPanel from "./SidebarDmPanel.jsx";
import SidebarCalendarPanel from "./SidebarCalendarPanel.jsx";
import SidebarMapPanel from "./SidebarMapPanel.jsx";
import SidebarSettingsPanel from "./SidebarSettingsPanel.jsx";
import { getCanvasBg } from "../shared/ui/canvas.js";
import {
    DESKTOP_NAVBAR_HEIGHT,
    SIDEBAR_PAD as PAD,
    SIDEBAR_GAP as GAP,
    SIDEBAR_PANEL_WIDTH as W_PANEL,
    SIDEBAR_W_EXPANDED as W_EXPANDED,
    SIDEBAR_W_COLLAPSED as W_COLLAPSED,
} from "../shared/ui/layout.js";

const formatCount = (n) => (n > 99 ? "99+" : n);

export default function Sidebar({ mobileOpen, onMobileClose, collapsedOverride }) {
    const navigate = useNavigate();
    const location = useLocation();

    const { currentWorkspace, workspaces, changeWorkspace, loadWorkspaces } = useWorkspace();
    const { sidebarCollapsed } = useLayout();
    // Layout이 좁은 화면 기준으로 강제 접기 등을 적용한 effective 값을 내려주면 그걸 우선.
    const collapsed = collapsedOverride ?? sidebarCollapsed;
    const counts = useSidebarCounts();
    const theme = useTheme();

    const width = collapsed ? W_COLLAPSED : W_EXPANDED;

    // 워크스페이스 메뉴 (생성/참여/카카오 초대)
    const [wsMenuAnchor, setWsMenuAnchor] = useState(null);
    const [wsEditOpen, setWsEditOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState(null);
    const [dialogLoading, setDialogLoading] = useState(false);
    const [kakaoInviteOpen, setKakaoInviteOpen] = useState(false);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);

    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

    // 스마트 뷰가 활성 상태면 메인 nav "할 일 목록" 은 비활성으로 처리 (시각 충돌 방지).
    const activeSmartView = location.state?.smartView;

    // 사용자 저장 뷰 (localStorage) — 저장/삭제 이벤트로 갱신
    const [savedViews, setSavedViews] = useState(() => loadSavedViews());
    useEffect(() => {
        const refresh = () => setSavedViews(loadSavedViews());
        window.addEventListener(SAVED_VIEWS_CHANGED, refresh);
        return () => window.removeEventListener(SAVED_VIEWS_CHANGED, refresh);
    }, []);

    const isSmartViewActive = (id) =>
        location.pathname === "/tasklist" && activeSmartView === id;
    const isSavedViewActive = (id) =>
        location.pathname === "/tasklist" && activeSmartView && typeof activeSmartView === "object" && activeSmartView.id === id;

    // 패널 헤더 = 현재 섹션 제목 (워크스페이스는 레일에서 단일 관리)
    const sectionTitle = (() => {
        const p = location.pathname;
        if (p.startsWith("/dashboard")) return "홈";
        if (p.startsWith("/calendar")) return "캘린더";
        if (p.startsWith("/dm")) return "메시지";
        if (p.startsWith("/map")) return "지도";
        if (p.startsWith("/settings")) return "설정";
        return "할 일";
    })();
    const isDmSection = location.pathname.startsWith("/dm");
    const isCalendarSection = location.pathname.startsWith("/calendar");
    const isMapSection = location.pathname.startsWith("/map");
    const isSettingsSection = location.pathname.startsWith("/settings");

    // 스마트 뷰 — 사이드바 → /tasklist 로 navigate state 전달, 페이지가 필터 hydration.
    const smartViews = [
        {
            id: "today", label: "오늘 마감", icon: <LocalFireDepartmentRoundedIcon />,
            count: counts.todayPending, accent: "danger",
        },
        { id: "mine", label: "내 할 일", icon: <CheckRoundedIcon />, count: counts.mineCount },
        {
            id: "overdue", label: "지연된 작업", icon: <InboxRoundedIcon />,
            count: counts.overdueCount, accent: counts.overdueCount > 0 ? "danger" : undefined,
        },
        { id: "recurring", label: "반복 일정", icon: <RepeatRoundedIcon />, count: counts.recurringCount },
    ];

    const handleWorkspaceActionSuccess = async (result) => {
        await loadWorkspaces?.();
        changeWorkspace?.({
            workspaceId: result.workspaceId,
            workspaceName: result.workspaceName,
            inviteCode: result.inviteCode,
            role: result.role,
        });
        setDialogMode(null);
        setSnackbar({ open: true, message: result.message || "처리되었습니다.", severity: "success" });
    };

    const handleCreateWorkspace = async (name, helpers) => {
        try {
            setDialogLoading(true);
            const result = await createWorkspace({ name });
            await handleWorkspaceActionSuccess(result);
            helpers?.reset?.();
        } catch (err) {
            if (err?.handled) return;
            helpers?.setError?.(getApiError(err, "워크스페이스 생성에 실패했습니다."));
        } finally {
            setDialogLoading(false);
        }
    };

    const handleJoinWorkspace = async (inviteCode, helpers) => {
        try {
            setDialogLoading(true);
            const result = await joinWorkspace({ inviteCode });
            await handleWorkspaceActionSuccess(result);
            helpers?.reset?.();
        } catch (err) {
            console.error("워크스페이스 참여 실패:", err);
            helpers?.setError?.(getApiError(err, "워크스페이스 참여에 실패했습니다."));
        } finally {
            setDialogLoading(false);
        }
    };

    const handleSmartViewClick = (viewId) => {
        navigate("/tasklist", { state: { smartView: viewId } });
        onMobileClose?.();
    };

    const handleWorkspaceSelect = (ws) => {
        changeWorkspace?.(ws);
        onMobileClose?.();
    };

    const renderContent = (showPanel, panelTopOffset = 0) => (
        <Box sx={{
            height: "100%",
            display: "flex",
            gap: `${GAP}px`,
            pl: `${PAD}px`,
            py: `${PAD}px`,
            background: getCanvasBg(theme),
            overflow: "hidden",
        }}>
            {/* 1단: 슬림 아이콘 레일 (상위 목적지) */}
            <SidebarIconRail
                workspace={currentWorkspace?.workspaceName}
                workspaceImage={currentWorkspace?.iconImageUrl ? resolveImageUrl(currentWorkspace.iconImageUrl) : null}
                onWorkspaceClick={(e) => setWsMenuAnchor(e.currentTarget)}
                onSettings={() => { navigate("/settings"); onMobileClose?.(); }}
                onMobileClose={onMobileClose}
            />

            {/* 2단: 맥락 패널 (스코프/프로젝트/스마트뷰/포커스) — 접으면 숨김 */}
            {showPanel && (
            <Box sx={{ width: W_PANEL, flexShrink: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {/* 상단 띠: 빠른 캡처 (네비바 높이 영역 — 본문과 같은 높이에서 카드 시작) */}
            {panelTopOffset > 0 && (
                <Box sx={{ height: `${panelTopOffset}px`, flexShrink: 0, display: "flex", alignItems: "center" }}>
                    <SidebarQuickCapture />
                </Box>
            )}
            <Box sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                // 본문과 붙어 보이게: 왼쪽만 둥글게, 오른쪽 보더는 본문과의 구분선
                borderRadius: "16px 0 0 16px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                overflow: "hidden",
            }}>
                {/* 섹션 제목 (워크스페이스는 레일 단일) */}
                <Box sx={{ px: 2.25, pt: 1.75, pb: 1 }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "text.primary" }}>
                        {sectionTitle}
                    </Typography>
                </Box>

                {/* ── 본문 — 섹션별 맥락 (메시지: 대화목록 / 캘린더: 프로젝트 필터+아젠다 / 그 외: 스코프·스마트뷰·포커스) ── */}
                {isDmSection ? (
                <SidebarDmPanel onMobileClose={onMobileClose} />
                ) : isCalendarSection ? (
                <SidebarCalendarPanel onMobileClose={onMobileClose} />
                ) : isMapSection ? (
                <SidebarMapPanel onMobileClose={onMobileClose} />
                ) : isSettingsSection ? (
                <SidebarSettingsPanel onMobileClose={onMobileClose} />
                ) : (
                <Box
                    component="nav"
                    className="plando-scroll"
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        overflowX: "hidden",
                        px: 1.75,
                        py: 0.5,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* 할 일 — 스코프(전체/인박스/프로젝트). 뷰(보드/목록)는 본문 탭에서 전환 */}
                    <SectionLabel collapsed={false}>할 일</SectionLabel>
                    <SidebarScopeNav collapsed={false} onMobileClose={onMobileClose} onNewProject={() => setProjectDialogOpen(true)} />

                    {/* 스마트 뷰 */}
                    <SectionLabel collapsed={false}>스마트 뷰</SectionLabel>
                    <Stack spacing={0.25} sx={{ px: 0.25 }} alignItems="stretch">
                        {smartViews.map((v) => (
                            <NavItem
                                key={v.id}
                                icon={v.icon}
                                label={v.label}
                                active={isSmartViewActive(v.id)}
                                badge={v.count > 0 ? formatCount(v.count) : null}
                                badgeTone={v.accent}
                                collapsed={false}
                                onClick={() => handleSmartViewClick(v.id)}
                            />
                        ))}
                    </Stack>

                    {/* 사용자 저장 뷰 — 필터 조합을 이름 붙여 저장한 것 (목록에서 '필터 저장'으로 생성) */}
                    {savedViews.length > 0 && (
                        <>
                            <SectionLabel collapsed={false}>저장된 뷰</SectionLabel>
                            <Stack spacing={0.25} sx={{ px: 0.25 }} alignItems="stretch">
                                {savedViews.map((v) => (
                                    <NavItem
                                        key={v.id}
                                        icon={<BookmarkRoundedIcon />}
                                        label={v.name}
                                        active={isSavedViewActive(v.id)}
                                        collapsed={false}
                                        onClick={() => { navigate("/tasklist", { state: { smartView: v } }); onMobileClose?.(); }}
                                        trailing={
                                            <Box
                                                component="span"
                                                role="button"
                                                aria-label="저장 뷰 삭제"
                                                onClick={(e) => { e.stopPropagation(); removeSavedView(v.id); }}
                                                sx={{ display: "inline-flex", alignItems: "center", color: "text.disabled", cursor: "pointer", "&:hover": { color: "error.main" } }}
                                            >
                                                <CloseRoundedIcon sx={{ fontSize: 15 }} />
                                            </Box>
                                        }
                                    />
                                ))}
                            </Stack>
                        </>
                    )}

                    {/* 포커스 항목 — focused === true && !DONE && !archived */}
                    <SectionLabel collapsed={false}>
                        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                            <BoltRoundedIcon sx={{ fontSize: 12 }} />
                            포커스 항목
                            {counts.focusedTasks.length > 0 && (
                                <Box component="span" sx={{
                                    ml: 0.5,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: theme.palette.primary.main,
                                    fontVariantNumeric: "tabular-nums",
                                }}>
                                    {counts.focusedTasks.length}
                                </Box>
                            )}
                        </Box>
                    </SectionLabel>
                    <SidebarFocusedItems
                        tasks={counts.focusedTasks}
                        onMobileClose={onMobileClose}
                    />
                </Box>
                )}
            </Box>
            </Box>
            )}

            {/* ── 워크스페이스 스위처 메뉴 (레일/브랜드 헤더에서 열림) ── */}
            <Menu
                anchorEl={wsMenuAnchor}
                open={Boolean(wsMenuAnchor)}
                onClose={() => setWsMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                PaperProps={{
                    sx: {
                        minWidth: 248,
                        mt: 0.5,
                        borderRadius: "12px",
                        ...getMenuGlassSx(theme),
                    },
                }}
            >
                <Typography
                    variant="caption"
                    sx={{ px: 2, pt: 1.2, pb: 0.5, display: "block", fontWeight: 800, fontSize: 10.5, color: "text.disabled", letterSpacing: 0.5, textTransform: "uppercase" }}
                >
                    워크스페이스
                </Typography>
                {workspaces.map((ws) => (
                    <MenuItem
                        key={ws.workspaceId}
                        onClick={() => { handleWorkspaceSelect(ws); setWsMenuAnchor(null); }}
                        selected={ws.workspaceId === currentWorkspace?.workspaceId}
                        sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75 }}
                    >
                        {ws.iconImageUrl ? (
                            <Box component="img" src={resolveImageUrl(ws.iconImageUrl)} loading="lazy" sx={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0, mr: 1.2 }} />
                        ) : (
                            <Avatar sx={{ width: 24, height: 24, fontSize: 11, fontWeight: 800, bgcolor: "primary.main", flexShrink: 0, mr: 1.2 }}>
                                {ws.workspaceName?.charAt(0) || "W"}
                            </Avatar>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{ws.workspaceName}</Typography>
                        </Box>
                        {ws.workspaceId === currentWorkspace?.workspaceId && (
                            <CheckRoundedIcon sx={{ fontSize: 15, color: "primary.main", ml: 0.5, flexShrink: 0 }} />
                        )}
                    </MenuItem>
                ))}

                <Divider sx={{ my: 0.5 }} />

                <MenuItem onClick={() => { setWsMenuAnchor(null); setDialogMode("create"); }}
                    sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}><AddIcon fontSize="small" /></ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>새 워크스페이스 만들기</Typography>
                </MenuItem>
                <MenuItem onClick={() => { setWsMenuAnchor(null); setDialogMode("join"); }}
                    sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}><GroupsRoundedIcon fontSize="small" /></ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>초대 코드로 참여하기</Typography>
                </MenuItem>
                {currentWorkspace && <Divider key="ws-divider" sx={{ my: 0.5 }} />}
                {currentWorkspace && (
                    <MenuItem key="ws-edit" onClick={() => { setWsMenuAnchor(null); setWsEditOpen(true); }}
                        sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}><SettingsRoundedIcon fontSize="small" /></ListItemIcon>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>현재 워크스페이스 편집</Typography>
                    </MenuItem>
                )}
                {currentWorkspace && (
                    <MenuItem key="ws-kakao" onClick={() => { setWsMenuAnchor(null); setKakaoInviteOpen(true); }}
                        sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}><ShareIcon fontSize="small" /></ListItemIcon>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>카카오톡으로 초대하기</Typography>
                    </MenuItem>
                )}
            </Menu>

            <WorkspaceEditSheet open={wsEditOpen} onClose={() => setWsEditOpen(false)} />
            <WorkspaceActionDialog open={dialogMode === "create"} mode="create" loading={dialogLoading}
                onClose={() => setDialogMode(null)} onSubmit={handleCreateWorkspace} />
            <WorkspaceActionDialog open={dialogMode === "join"} mode="join" loading={dialogLoading}
                onClose={() => setDialogMode(null)} onSubmit={handleJoinWorkspace} />
            <KakaoInviteDialog open={kakaoInviteOpen} onClose={() => setKakaoInviteOpen(false)} workspace={currentWorkspace} />
            <Snackbar
                open={snackbar.open}
                autoHideDuration={2500}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert severity={snackbar.severity} variant="filled"
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );

    return (
        <>
            <Drawer
                variant="permanent"
                open
                PaperProps={{
                    sx: {
                        width,
                        borderRight: "none",
                        bgcolor: getCanvasBg(theme),
                        display: { xs: "none", md: "block" },
                        overflowX: "hidden",
                        transition: (theme) =>
                            theme.transitions.create("width", {
                                easing: theme.transitions.easing.sharp,
                                duration: theme.transitions.duration.shorter,
                            }),
                    },
                }}
            >
                {renderContent(!collapsed, DESKTOP_NAVBAR_HEIGHT)}
            </Drawer>

            <Drawer
                variant="temporary"
                open={Boolean(mobileOpen)}
                onClose={onMobileClose}
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: {
                        width: W_EXPANDED,
                        borderRight: "1px solid",
                        borderColor: "divider",
                    },
                }}
                sx={{ display: { xs: "block", md: "none" } }}
            >
                {renderContent(true)}
            </Drawer>

            <ProjectCreateDialog
                open={projectDialogOpen}
                onClose={() => setProjectDialogOpen(false)}
                onCreated={(p) => { navigate(`/projects/${p.id}`); onMobileClose?.(); }}
            />
        </>
    );
}
