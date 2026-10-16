import React, { useCallback, useEffect, useMemo, useState } from "react";
import { APP_EVENTS } from "../shared/constants/events.js";
import { resolveImageUrl } from "../shared/utils/urlUtils.js";
import { isAndroid, getAndroidSolidBg, getMenuGlassSx, fadeDividerSx } from "../shared/ui/glassSx.js";
import { MOBILE_NAVBAR_HEIGHT, DESKTOP_NAVBAR_HEIGHT } from "../shared/ui/layout.js";
import {
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Box,
    Badge,
    Menu,
    MenuItem,
    ListItemIcon,
    Tooltip,
    Popover,
    Drawer as DrawerMui,
    useMediaQuery,
    Avatar,
    Stack,
    Snackbar,
    Alert,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { Z } from "../shared/ui/zIndex.js";
import Press from "../shared/ui/primitives/Press.jsx";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import AddIcon from "@mui/icons-material/Add";
import GroupsIcon from "@mui/icons-material/Groups";
import MenuBookIcon from "@mui/icons-material/MenuBookRounded";
import OpenInNewIcon from "@mui/icons-material/OpenInNewRounded";
import { DOCS_URL } from "../shared/constants/links.js";
import ShareIcon from "@mui/icons-material/Share";
import CheckIcon from "@mui/icons-material/Check";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";

import { useLocation, useNavigate } from "react-router-dom";
import { GlobalSearch } from "./NavbarSearch.jsx";
import GlobalSearchMobile from "./NavbarSearchMobile.jsx";
import { removeToken, getUser } from "../shared/utils/tokenUtils.js";
import AddTodoModal from "../features/todo/components/form/AddTodoModal.jsx";
import { addTodo } from "../features/todo/api/todoApi.js";
import NotificationPanel from "../features/notification/components/NotificationPanel.jsx";
import {
    fetchNotifications,
    fetchUnreadNotificationCount,
    markAllNotificationsAsRead,
} from "../features/notification/api/notificationsApi.js";
import { useTheme, alpha } from "@mui/material/styles";
import { getCanvasBg } from "../shared/ui/canvas.js";
import { useWorkspace } from "../features/workspace/context/WorkspaceContext.jsx";
import { useOpenTodoDetail } from "../features/todo/hooks/useOpenTodoDetail.jsx";
import { createWorkspace, joinWorkspace } from "../features/workspace/api/workspaceApi.js";
import { getApiError } from "../shared/api/axiosInstance.js";
import { toast } from "../shared/utils/toast.js";
import WorkspaceActionDialog from "../features/workspace/components/WorkspaceActionDialog.jsx";
import KakaoInviteDialog from "../features/workspace/components/KakaoInviteDialog.jsx";
import WorkspaceEditSheet from "../features/workspace/components/WorkspaceEditSheet.jsx";
import { getProjectById, useProjects } from "../features/project/store/projectStore.js";
import { getProjectIcon } from "../features/project/projectIcons.js";
import { projectIconColor } from "../features/project/utils/projectOptions.js";
import { useActiveProject } from "../features/project/context/ActiveProjectContext.jsx";
import { getTaskPath } from "../features/todo/utils/taskView.js";
import { ROLE_LABEL } from "../features/workspace/hooks/useWorkspacePermissions.js";

// 상단 네비 브레드크럼이 글로벌 프로젝트 필터로 동작하는 경로(할 일 중심 뷰)
const SCOPED_FILTER_PATHS = ["/todos", "/tasklist", "/calendar"];

export default function Navbar({ onMenuClick, onOpenChat }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentWorkspace, workspaces, changeWorkspace, loadWorkspaces } = useWorkspace();
    const { activeProjectId, activeProject, setActiveProject } = useActiveProject();
    const projectsList = useProjects();
    const openTodoDetail = useOpenTodoDetail();

    const [anchorEl, setAnchorEl] = useState(null);
    const [wsAnchorEl, setWsAnchorEl] = useState(null);
    const [dialogMode, setDialogMode] = useState(null);
    const [dialogLoading, setDialogLoading] = useState(false);
    const [kakaoInviteOpen, setKakaoInviteOpen] = useState(false);
    const [wsEditOpen, setWsEditOpen] = useState(false);
    const [projAnchorEl, setProjAnchorEl] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
    const [notiAnchorEl, setNotiAnchorEl] = useState(null);
    const [notiMobileOpen, setNotiMobileOpen] = useState(false); // 모바일 풀스크린 알림
    const [notifications, setNotifications] = useState([]);
    const [notiLoading, setNotiLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notificationEnabled, setNotificationEnabled] = useState(
        () => localStorage.getItem("settings.notificationEnabled") !== "false"
    );

    const [user, setUser] = useState(() => getUser());
    const [searchOpen, setSearchOpen] = useState(false);
    const [addTodoOpen, setAddTodoOpen] = useState(false);
    const [addTask, setAddTask] = useState({ title:"", content:"", startAt:"", dueDate:"", priority:"MEDIUM", status:"TODO", assignees:[] });
    const [addLocation, setAddLocation] = useState(null);

    useEffect(() => {
        const sync = () => setUser(getUser());
        window.addEventListener(APP_EVENTS.SETTINGS_CHANGED, sync);
        return () => window.removeEventListener(APP_EVENTS.SETTINGS_CHANGED, sync);
    }, []);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const isDark = theme.palette.mode === "dark";


    const pageTitle = useMemo(() => {
        const map = {
            "/dashboard": "대시보드",
            "/tasklist": "할 일 목록",
            "/calendar": "캘린더",
            "/todos": "할 일 보드",
            "/map": "지도 일정",
            "/dm": "메시지",
            "/settings": "설정",
        };
        return map[location.pathname] ?? "Plan Do!";
    }, [location.pathname]);

    // 프로젝트 탭일 때 브레드크럼 2번째 칸을 프로젝트 스위처로 (ClickUp식: 현재 보는 곳 + 전환)
    const projectCtx = useMemo(() => {
        if (!location.pathname.startsWith("/projects")) return null;
        const m = location.pathname.match(/^\/projects\/(\w+)/);
        const rawId = m ? m[1] : null;
        if (rawId === "inbox") return { kind: "inbox", label: "인박스" };
        if (rawId) {
            const p = getProjectById(Number(rawId));
            return { kind: "project", project: p, label: p?.name ?? "프로젝트" };
        }
        return { kind: "hub", label: "프로젝트" };
    }, [location.pathname]);

    // 브레드크럼 2번째 칸 — 두 모드:
    //  global: 할 일 중심 뷰(보드·목록·캘린더)에서 글로벌 프로젝트 필터 (전체 기본). 선택 시 필터만 변경.
    //  route : 프로젝트 탭에서 현재 보는 프로젝트. 선택 시 해당 라우트로 이동.
    const breadcrumb = useMemo(() => {
        if (SCOPED_FILTER_PATHS.includes(location.pathname)) {
            return {
                mode: "global",
                label: activeProject ? activeProject.name : activeProjectId === "inbox" ? "인박스" : "전체",
                color: activeProject?.color ?? null,
                icon: activeProject?.icon ?? null,
                inbox: activeProjectId === "inbox",
                value: activeProjectId ?? null,
            };
        }
        if (projectCtx) {
            return {
                mode: "route",
                label: projectCtx.label,
                color: projectCtx.kind === "project" ? projectCtx.project?.color ?? null : null,
                icon: projectCtx.kind === "project" ? projectCtx.project?.icon ?? null : null,
                inbox: projectCtx.kind === "inbox",
                value: projectCtx.kind === "inbox" ? "inbox" : projectCtx.kind === "project" ? (projectCtx.project?.id ?? null) : null,
            };
        }
        return null;
    }, [location.pathname, activeProject, activeProjectId, projectCtx]);

    const handleSelectProject = useCallback((value) => {
        if (breadcrumb?.mode === "global") {
            setActiveProject(value);
        } else if (typeof value === "number") {
            // 개요(route 모드)에서 다른 프로젝트 선택 → 그 프로젝트 개요로 (스코프는 페이지가 동기화)
            navigate(`/projects/${value}`);
        } else {
            // 전체/인박스 선택 → 스코프 set + 할 일 surface로 (인박스 개요 없음 — 리다이렉트 의존 제거)
            setActiveProject(value);
            navigate(getTaskPath());
        }
        setProjAnchorEl(null);
    }, [breadcrumb, setActiveProject, navigate]);

    const loadUnreadCount = useCallback(async () => {
        if (!currentWorkspace) return;
        try {
            const res = await fetchUnreadNotificationCount();
            setUnreadCount(res.data?.unreadCount ?? 0);
        } catch (err) {
            console.error("안 읽은 알림 수 조회 실패", err);
        }
    }, [currentWorkspace]);

    const loadNotifications = useCallback(async () => {
        // 패널을 먼저 열고 조회하므로, 로딩 중에는 빈 상태("새 알림이 없어요")가 깜빡이지 않도록 표시
        setNotiLoading(true);
        try {
            const res = await fetchNotifications();
            setNotifications(res.data ?? []);
        } catch (err) {
            console.error("알림 조회 실패", err);
        } finally {
            setNotiLoading(false);
        }
    }, []);

    useEffect(() => {
        const syncSettings = () => {
            setNotificationEnabled(localStorage.getItem("settings.notificationEnabled") !== "false");
        };
        window.addEventListener(APP_EVENTS.SETTINGS_CHANGED, syncSettings);
        return () => window.removeEventListener(APP_EVENTS.SETTINGS_CHANGED, syncSettings);
    }, []);

    useEffect(() => {
        if (!notificationEnabled) {
            setUnreadCount(0);
            return;
        }

        loadUnreadCount();

        const handleNotificationRefresh = () => loadUnreadCount();
        window.addEventListener(APP_EVENTS.NOTIFICATIONS_CHANGED, handleNotificationRefresh);

        const timer = setInterval(() => loadUnreadCount(), 10000);

        return () => {
            window.removeEventListener(APP_EVENTS.NOTIFICATIONS_CHANGED, handleNotificationRefresh);
            clearInterval(timer);
        };
    }, [notificationEnabled, loadUnreadCount]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setSearchOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        const onAddTodo = (e) => {
            // detail.title — 검색 "할 일로 추가" 제목 prefill / detail.projectId — 프로젝트 홈 FAB 소속 지정
            const title = e?.detail?.title;
            const projectId = e?.detail?.projectId;
            setAddTask((prev) => ({
                ...prev,
                ...(title ? { title } : {}),
                ...(projectId != null ? { projectScope: projectId } : {}),
            }));
            setAddTodoOpen(true);
        };
        window.addEventListener(APP_EVENTS.OPEN_ADD_TODO, onAddTodo);
        return () => window.removeEventListener(APP_EVENTS.OPEN_ADD_TODO, onAddTodo);
    }, []);

    const handleAddTodoSave = async () => {
        try {
            // 소속: 폼 선택값(projectScope) > 현재 스코프 > 인박스(null) — 다른 생성 경로와 동일 체인
            const { projectScope, ...payload } = addTask;
            const scope = projectScope ?? (typeof activeProjectId === "number" ? activeProjectId : "inbox");
            const { data } = await addTodo({ ...payload, projectId: scope === "inbox" ? null : scope, ...(addLocation ?? {}) });
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_ADDED, { detail: data }));
            setAddTodoOpen(false);
            setAddTask({ title:"", content:"", startAt:"", dueDate:"", priority:"MEDIUM", status:"TODO", assignees:[] });
            setAddLocation(null);
            toast.success("작업이 추가됐어요.");
            return data?.id ?? null;
        } catch (err) {
            console.error("할 일 추가 실패", err);
            toast.error(getApiError(err, "작업 추가 중 오류가 발생했어요."));
            return null;
        }
    };

    const handleLogout = () => {
        removeToken();
        navigate("/login");
    };

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
            helpers?.setError?.(getApiError(err, "워크스페이스 참여에 실패했습니다."));
        } finally {
            setDialogLoading(false);
        }
    };

    const handleOpenNotifications = async (e) => {
        if (!notificationEnabled) return;
        if (isMobile) setNotiMobileOpen(true);
        else setNotiAnchorEl(e.currentTarget);
        await loadNotifications();
        await loadUnreadCount();
    };

    const handleCloseNotifications = () => {
        setNotiAnchorEl(null);
        setNotiMobileOpen(false);
    };

    const handleReadAll = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("모두 읽음 처리 실패", err);
        }
    };

    const handleClickNotification = async (item) => {
        // 읽음 PATCH는 NotificationPanel이 이미 수행 — 여기선 로컬 상태만 갱신(중복 요청 방지).
        // 읽음 처리 성공 여부와 무관하게 패널 닫기·이동은 항상 수행한다.
        if (!item.read) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
            );
            setUnreadCount((prev) => Math.max(prev - 1, 0));
        }

        handleCloseNotifications();

        try {
            // DM_RECEIVED + DM_MENTION 모두 대화방으로 — 예전엔 DM 멘션이 MENTION으로 와서
            // 할 일 상세(/todo/{roomId})로 잘못 라우팅됐다(404 또는 무관한 할 일).
            if (item.type?.startsWith("DM")) {
                // targetId = roomId — 목록이 아니라 해당 대화방을 바로 연다
                navigate("/dm", item.targetId != null
                    ? { state: { openRoomId: Number(item.targetId) } }
                    : undefined);
                window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
            } else if (item.type?.startsWith("RECRUITMENT_")) {
                // 모집글 알림은 항상 /recruitments 상세로 — todo 상세로 잘못 빠지지 않도록 prefix 매칭.
                // Q&A 관련 알림은 상세 모달의 Q&A 탭으로 자동 진입.
                const isQa = item.type === "RECRUITMENT_QUESTION_RECEIVED"
                          || item.type === "RECRUITMENT_QUESTION_ANSWERED";
                const tabQuery = isQa ? "&tab=qa" : "";
                navigate(`/recruitments/?detail=${item.targetId}${tabQuery}`);
            } else if (item.targetId) {
                await openTodoDetail(item.targetId);
            }
        } catch (err) {
            console.error("알림 이동 실패", err);
        }
    };

    // iOS 모바일 frosted glass — 라이트는 brightness 빼서 페이지 bg와 톤 일치
    const iosGlassFilter = isDark
        ? "blur(12px) saturate(120%)"
        : "blur(12px) saturate(180%)";
    const isIosMobile = isMobile && !isAndroid;

    return (
        <AppBar
            position={isMobile ? "fixed" : "sticky"}
            elevation={0}
            color="transparent"
            sx={{
                bgcolor: isMobile
                    ? isAndroid
                        ? getAndroidSolidBg(theme)
                        : "transparent"
                    : getCanvasBg(theme),
                backgroundImage: "none",
                color: "text.primary",
                borderBottom: "none",
                borderColor: isMobile ? undefined : "divider",
                boxShadow: "none",
                pt: isMobile ? "env(safe-area-inset-top, 0px)" : 0,
                ...(isIosMobile ? {
                    backdropFilter: iosGlassFilter,
                    WebkitBackdropFilter: iosGlassFilter,
                    isolation: "isolate",
                } : {}),
            }}
        >
            <Toolbar sx={{ gap: 1.5, minHeight: { xs: MOBILE_NAVBAR_HEIGHT, md: DESKTOP_NAVBAR_HEIGHT }, height: { md: DESKTOP_NAVBAR_HEIGHT } }}>
                <IconButton onClick={onMenuClick} aria-label="menu" sx={{ display: { xs: "none", md: "flex" } }}>
                    <MenuIcon />
                </IconButton>

                {/* 모바일: 워크스페이스 전환 버튼 — 슬랙식 배경 pill + 탭 피드백(햅틱·눌림) */}
                {isMobile && (
                    <Press
                        onClick={(e) => setWsAnchorEl(e.currentTarget)}
                        haptic="light"
                        pressScale={0.95}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            paddingLeft: 4,
                            paddingRight: 8,
                            paddingTop: 4,
                            paddingBottom: 4,
                            borderRadius: 20,
                            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}`,
                            maxWidth: 220,
                            minWidth: 0,
                        }}
                    >
                        {currentWorkspace?.iconImageUrl ? (
                            <Box component="img" src={resolveImageUrl(currentWorkspace.iconImageUrl)} loading="lazy" sx={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                            <Avatar sx={{ width: 26, height: 26, fontSize: 13, fontWeight: 900, bgcolor: "primary.main", flexShrink: 0 }}>
                                {currentWorkspace?.workspaceName?.charAt(0) || "W"}
                            </Avatar>
                        )}
                        <Typography sx={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {currentWorkspace?.workspaceName || "워크스페이스"}
                        </Typography>
                        <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0 }} />
                    </Press>
                )}

                {/* 데스크탑: 스코프 breadcrumb (워크스페이스는 레일에서 단일 관리) */}
                {!isMobile && (
                    <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 0.5 }}>
                        {breadcrumb ? (
                            <Box
                                onClick={(e) => setProjAnchorEl(e.currentTarget)}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.625,
                                    cursor: "pointer",
                                    px: 0.875,
                                    py: 0.375,
                                    ml: -0.25,
                                    borderRadius: 2,
                                    bgcolor: breadcrumb.color ? alpha(breadcrumb.color, 0.14) : "transparent",
                                    transition: "background 0.15s",
                                    "&:hover": { bgcolor: breadcrumb.color ? alpha(breadcrumb.color, 0.2) : "action.hover" },
                                }}
                            >
                                {breadcrumb.color && !breadcrumb.inbox && (() => {
                                    const ProjIcon = getProjectIcon(breadcrumb.icon);
                                    return <ProjIcon sx={{ fontSize: 17, color: projectIconColor(breadcrumb.color) ?? "text.secondary", flexShrink: 0 }} />;
                                })()}
                                {breadcrumb.inbox && (
                                    <InboxRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                                )}
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                                    {breadcrumb.label}
                                </Typography>
                                <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0 }} />
                            </Box>
                        ) : (
                            <Typography variant="subtitle1" sx={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                                {pageTitle}
                            </Typography>
                        )}
                    </Box>
                )}

                <Box sx={{ flex: 1 }} />

                {!isMobile && (
                    <Tooltip title="전체 검색 (Ctrl + K)">
                        <Box
                            onClick={() => setSearchOpen(true)}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                px: 2,
                                py: 0.75,
                                borderRadius: 2.5,
                                border: "1px solid",
                                borderColor: "divider",
                                cursor: "pointer",
                                color: "text.secondary",
                                fontSize: 13,
                                fontWeight: 500,
                                width: 380,
                                bgcolor: "var(--plando-surface-faint)",
                                transition: "all 0.15s",
                                "&:hover": {
                                    borderColor: "primary.main",
                                    color: "text.primary",
                                    bgcolor: "var(--plando-surface-low)",
                                },
                            }}
                        >
                            <SearchRoundedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
                            <Box component="span" sx={{ flex: 1 }}>할 일, 메시지, 일정 검색...</Box>
                            <Box
                                component="kbd"
                                sx={{
                                    px: "6px",
                                    py: "1px",
                                    borderRadius: 1,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    bgcolor: "var(--plando-surface-low)",
                                    color: "text.disabled",
                                    lineHeight: 1.6,
                                    flexShrink: 0,
                                }}
                            >
                                Ctrl+K
                            </Box>
                        </Box>
                    </Tooltip>
                )}

                <Box sx={{ flex: 1 }} />

                {/* 모바일 전역 검색 진입점 — 데스크탑은 좌측 검색 박스(Ctrl+K) 사용 */}
                {isMobile && (
                    <IconButton aria-label="search" onClick={() => setSearchOpen(true)}>
                        <SearchRoundedIcon sx={{ fontSize: 22 }} />
                    </IconButton>
                )}

                <Tooltip title={notificationEnabled ? "알림" : "알림 꺼짐"}>
                    <IconButton
                        aria-label="notifications"
                        onClick={handleOpenNotifications}
                        sx={{ opacity: notificationEnabled ? 1 : 0.4 }}
                    >
                        <Badge badgeContent={unreadCount} color="error">
                            <NotificationsNoneIcon />
                        </Badge>
                    </IconButton>
                </Tooltip>

                {/* 챗봇·내 정보 — 데스크탑 전용. 모바일은 더보기 탭(/more)에서 진입 */}
                {!isMobile && (
                    <Tooltip title="챗봇">
                        <IconButton aria-label="chat" onClick={onOpenChat}>
                            <AutoAwesomeRoundedIcon sx={{ fontSize: 22 }} />
                        </IconButton>
                    </Tooltip>
                )}

                {!isMobile && (
                    <Tooltip title="내 정보">
                        <IconButton aria-label="account" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
                            <Avatar
                                src={user?.profileImageUrl ? resolveImageUrl(user.profileImageUrl) : undefined}
                                sx={{ width: 32, height: 32, fontSize: 14, fontWeight: 900 }}
                            >
                                {!user?.profileImageUrl && (user?.name?.[0] || user?.email?.[0] || "U").toUpperCase()}
                            </Avatar>
                        </IconButton>
                    </Tooltip>
                )}

                <Popover
                    open={Boolean(notiAnchorEl)}
                    anchorEl={notiAnchorEl}
                    onClose={handleCloseNotifications}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            boxShadow: "none",
                            backgroundColor: "transparent",
                            overflow: "visible",
                        },
                    }}
                >
                    <NotificationPanel
                        notifications={notifications}
                        loading={notiLoading}
                        onClose={handleCloseNotifications}
                        onReadAll={handleReadAll}
                        onClickItem={handleClickNotification}
                    />
                </Popover>

                {/* 모바일 풀스크린 알림 — 우측에서 푸시 전환 (앱 문법) */}
                <DrawerMui
                    anchor="right"
                    open={notiMobileOpen}
                    onClose={handleCloseNotifications}
                    sx={{ zIndex: Z.MODAL }}
                    PaperProps={{
                        sx: {
                            width: "100%",
                            bgcolor: "background.default",
                            backgroundImage: "none",
                        },
                    }}
                >
                    <NotificationPanel
                        fullScreen
                        notifications={notifications}
                        loading={notiLoading}
                        onClose={handleCloseNotifications}
                        onReadAll={handleReadAll}
                        onClickItem={handleClickNotification}
                    />
                </DrawerMui>

                {/* 워크스페이스 메뉴 */}
                <Menu
                    anchorEl={wsAnchorEl}
                    open={Boolean(wsAnchorEl)}
                    onClose={() => setWsAnchorEl(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                    transformOrigin={{ vertical: "top", horizontal: "left" }}
                    PaperProps={{
                        sx: {
                            minWidth: 240, mt: 0.5,
                            borderRadius: "16px",
                            ...getMenuGlassSx(theme),
                        },
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            px: 2, pt: 1.2, pb: 0.5, display: "block",
                            fontWeight: 700, fontSize: 11,
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            letterSpacing: 0.5, textTransform: "uppercase",
                        }}
                    >
                        워크스페이스
                    </Typography>

                    {workspaces.map((ws) => (
                        <MenuItem
                            key={ws.workspaceId}
                            onClick={() => { changeWorkspace?.(ws); setWsAnchorEl(null); }}
                            selected={ws.workspaceId === currentWorkspace?.workspaceId}
                            sx={{
                                mx: 0.75, my: 0.25, borderRadius: "10px",
                                px: 1.25, py: 0.75,
                                "&.Mui-selected": {
                                    background: "action.selected",
                                    "&:hover": { background: "action.selected" },
                                },
                                "&:hover": { background: "action.hover" },
                            }}
                        >
                            {ws.iconImageUrl ? (
                                <Box component="img" src={resolveImageUrl(ws.iconImageUrl)} loading="lazy" sx={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0, mr: 1.2 }} />
                            ) : (
                                <Avatar sx={{ width: 28, height: 28, fontSize: 13, fontWeight: 800, bgcolor: "primary.main", flexShrink: 0, mr: 1.2 }}>
                                    {ws.workspaceName?.charAt(0) || "W"}
                                </Avatar>
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13, color: "text.primary" }} noWrap>
                                    {ws.workspaceName}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 11 }}>
                                    {ROLE_LABEL[ws.role] ?? ""}
                                </Typography>
                            </Box>
                            {ws.workspaceId === currentWorkspace?.workspaceId && (
                                <CheckIcon sx={{ fontSize: 15, color: "primary.main", ml: 0.5 }} />
                            )}
                        </MenuItem>
                    ))}

                    <Box sx={{ my: 0.5, mx: 1, height: "1px", ...fadeDividerSx("var(--plando-divider)", "top") }} />

                    {currentWorkspace && isMobile && (
                        <MenuItem
                            onClick={() => { setWsAnchorEl(null); setWsEditOpen(true); }}
                            sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}><SettingsIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>워크스페이스 편집</Typography>
                        </MenuItem>
                    )}

                    <MenuItem
                        onClick={() => { setWsAnchorEl(null); setDialogMode("create"); }}
                        sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                    >
                        <ListItemIcon sx={{ minWidth: 32 }}><AddIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>새 워크스페이스 만들기</Typography>
                    </MenuItem>

                    <MenuItem
                        onClick={() => { setWsAnchorEl(null); setDialogMode("join"); }}
                        sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                    >
                        <ListItemIcon sx={{ minWidth: 32 }}><GroupsIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>초대 코드로 참여하기</Typography>
                    </MenuItem>

                    {currentWorkspace && (
                        <MenuItem
                            onClick={() => { setWsAnchorEl(null); setKakaoInviteOpen(true); }}
                            sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}><ShareIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>카카오톡으로 초대하기</Typography>
                        </MenuItem>
                    )}
                    <Box sx={{ pb: 0.5 }} />
                </Menu>

                {/* 프로젝트 스위처 (브레드크럼 드롭다운) */}
                <Menu
                    anchorEl={projAnchorEl}
                    open={Boolean(projAnchorEl)}
                    onClose={() => setProjAnchorEl(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                    transformOrigin={{ vertical: "top", horizontal: "left" }}
                    PaperProps={{ sx: { minWidth: 240, mt: 0.5, borderRadius: "16px", ...getMenuGlassSx(theme) } }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            px: 2, pt: 1.2, pb: 0.5, display: "block",
                            fontWeight: 700, fontSize: 11,
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            letterSpacing: 0.5, textTransform: "uppercase",
                        }}
                    >
                        프로젝트
                    </Typography>

                    <MenuItem
                        onClick={() => handleSelectProject(null)}
                        selected={(breadcrumb?.value ?? null) === null}
                        sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                    >
                        <ListItemIcon sx={{ minWidth: 32 }}><GridViewRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>
                            전체
                        </Typography>
                    </MenuItem>

                    <Box sx={{ my: 0.5, mx: 1, height: "1px", ...fadeDividerSx("var(--plando-divider)", "top") }} />

                    {projectsList.map((p) => {
                        const sel = breadcrumb?.value === p.id;
                        const ProjIcon = getProjectIcon(p.icon);
                        return (
                            <MenuItem
                                key={p.id}
                                onClick={() => handleSelectProject(p.id)}
                                selected={sel}
                                sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                            >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    <ProjIcon sx={{ fontSize: 17, color: projectIconColor(p.color) ?? "text.secondary" }} />
                                </ListItemIcon>
                                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, fontSize: 13, color: "text.primary" }} noWrap>
                                    {p.name}
                                </Typography>
                                {sel && <CheckIcon sx={{ fontSize: 15, color: "primary.main", ml: 0.5 }} />}
                            </MenuItem>
                        );
                    })}

                    <Box sx={{ my: 0.5, mx: 1, height: "1px", ...fadeDividerSx("var(--plando-divider)", "top") }} />

                    <MenuItem
                        onClick={() => handleSelectProject("inbox")}
                        selected={breadcrumb?.value === "inbox"}
                        sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                    >
                        <ListItemIcon sx={{ minWidth: 32 }}><InboxRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>인박스</Typography>
                    </MenuItem>
                    <Box sx={{ pb: 0.5 }} />
                </Menu>

                {/* 프로필 메뉴 */}
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => setAnchorEl(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    PaperProps={{
                        sx: {
                            minWidth: 220, mt: 0.5,
                            borderRadius: "16px",
                            ...getMenuGlassSx(theme),
                        },
                    }}
                >
                    {/* 유저 정보 헤더 */}
                    <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar
                            src={user?.profileImageUrl ? resolveImageUrl(user.profileImageUrl) : undefined}
                            sx={{ width: 38, height: 38, fontWeight: 900, flexShrink: 0 }}
                        >
                            {!user?.profileImageUrl && (user?.name?.[0] || user?.email?.[0] || "U").toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.3, color: "text.primary" }} noWrap>
                                {user?.name || "사용자"}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "text.disabled", lineHeight: 1.3 }} noWrap>
                                {user?.email || "-"}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ my: 0.5, mx: 1, height: "1px", ...fadeDividerSx("var(--plando-divider)", "top") }} />

                    <Box sx={{ py: 0.5 }}>
                        <MenuItem
                            onClick={() => { setAnchorEl(null); navigate("/recruitments"); }}
                            sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}><GroupsIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                            <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, fontSize: 13, color: "text.primary" }}>팀 모집</Typography>
                            <Box
                                component="span"
                                sx={{
                                    px: 0.75,
                                    py: "1px",
                                    borderRadius: 999,
                                    bgcolor: "var(--plando-primary-soft)",
                                    color: "primary.main",
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    letterSpacing: "0.02em",
                                }}
                            >
                                베타
                            </Box>
                        </MenuItem>

                        <MenuItem
                            onClick={() => { setAnchorEl(null); navigate("/settings"); }}
                            sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}><SettingsIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>설정</Typography>
                        </MenuItem>

                        {/* 안내서는 앱 밖의 정적 사이트다 — navigate 가 아니라 새 탭으로 연다. */}
                        <MenuItem
                            onClick={() => { setAnchorEl(null); window.open(DOCS_URL, "_blank", "noopener,noreferrer"); }}
                            sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: "action.hover" } }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}><MenuBookIcon fontSize="small" sx={{ color: "text.secondary" }} /></ListItemIcon>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>사용 안내서</Typography>
                            <OpenInNewIcon sx={{ fontSize: 13, color: "text.disabled", ml: 0.5 }} />
                        </MenuItem>

                        <MenuItem
                            onClick={() => { setAnchorEl(null); handleLogout(); }}
                            sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 1.25, py: 0.75, "&:hover": { background: isDark ? "rgba(248,113,113,0.10)" : "rgba(220,38,38,0.06)" } }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}><LogoutIcon fontSize="small" sx={{ color: isDark ? "#F87171" : "#DC2626" }} /></ListItemIcon>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, color: isDark ? "#F87171" : "#DC2626" }}>로그아웃</Typography>
                        </MenuItem>
                    </Box>
                </Menu>

                <WorkspaceActionDialog
                    open={dialogMode === "create"}
                    mode="create"
                    loading={dialogLoading}
                    onClose={() => setDialogMode(null)}
                    onSubmit={handleCreateWorkspace}
                />

                <WorkspaceActionDialog
                    open={dialogMode === "join"}
                    mode="join"
                    loading={dialogLoading}
                    onClose={() => setDialogMode(null)}
                    onSubmit={handleJoinWorkspace}
                />

                <KakaoInviteDialog
                    open={kakaoInviteOpen}
                    onClose={() => setKakaoInviteOpen(false)}
                    workspace={currentWorkspace}
                />

                <WorkspaceEditSheet
                    open={wsEditOpen}
                    onClose={() => setWsEditOpen(false)}
                />

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={2500}
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                >
                    <Alert
                        severity={snackbar.severity}
                        variant="filled"
                        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Toolbar>

            {/* 전역 검색 — 데스크탑은 커맨드 팔레트, 모바일은 풀스크린 */}
            {isMobile
                ? <GlobalSearchMobile open={searchOpen} onClose={() => setSearchOpen(false)} />
                : <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />}

            <AddTodoModal
                open={addTodoOpen}
                onClose={() => {
                    setAddTodoOpen(false);
                    // 잔류 방지 — 다음 열기에 이전 컨텍스트(projectScope)가 따라붙지 않게
                    setAddTask((prev) => { const rest = { ...prev }; delete rest.projectScope; return rest; });
                }}
                task={addTask}
                setTask={setAddTask}
                onSave={handleAddTodoSave}
                location={addLocation}
                setLocation={setAddLocation}
            />
        </AppBar>
    );
}