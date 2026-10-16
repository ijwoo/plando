import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_EVENTS } from "../shared/constants/events.js";
import { Box, CircularProgress, CssBaseline, Dialog, Drawer, Slide, Snackbar, Typography, useMediaQuery } from "@mui/material";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import { Capacitor } from "@capacitor/core";
import { hapticMedium } from "../shared/utils/haptics.js";
import { useTheme } from "@mui/material/styles";
import { getCanvasBg } from "../shared/ui/canvas.js";
import { getMobilePageBg, hideScrollbarSx } from "../shared/ui/glassSx.js";
import { isAndroid } from "../shared/utils/platformUtils.js";
import { useLocation } from "react-router-dom";
import { rememberRoute } from "../shared/utils/lastRoute.js";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import ChatWidget from "../features/chat/components/ChatWidget.jsx";
import GuestBlockModal from "../features/recruitment/components/common/GuestBlockModal.jsx";
import { useLayout } from "./LayoutContext";
import MobileBottomNav from "./MobileBottomNav.jsx";
import PageTransition from "./PageTransition.jsx";
import PushNotificationHandler from "../features/notification/components/PushNotificationHandler.jsx";
import EmailVerifyBanner from "../features/auth/components/EmailVerifyBanner.jsx";
import GuestModeBanner from "../features/auth/components/GuestModeBanner.jsx";
import { isGuest } from "../shared/utils/guestUtils.js";
import useEmailVerification from "../features/auth/hooks/useEmailVerification.js";
import { useGlobalStomp } from "../shared/hooks/useGlobalStomp.js";
import { Z } from "../shared/ui/zIndex.js";
import {
    MOBILE_NAVBAR_HEIGHT,
    DESKTOP_NAVBAR_HEIGHT,
    SIDEBAR_W_EXPANDED as W_EXPANDED,
    SIDEBAR_W_COLLAPSED as W_COLLAPSED,
} from "../shared/ui/layout.js";
import useWelcomeFlow from "../features/onboarding/hooks/useWelcomeFlow.js";
import WelcomeDialog from "../features/onboarding/components/WelcomeDialog.jsx";

const DETAIL_W = 420;
const PULL_THRESHOLD = 110;
const MAX_PULL = 140;
// 좁은 데스크탑(≤1300px)에서는 상세 패널이 본문을 밀지 않고 오버레이로 뜸 → 본문 폭 확보
const NARROW_DETAIL_OVERLAY_MAX = 1300;

// 토스트 — 콤팩트 다크 필 (severity는 아이콘 색으로만)
const ToastSlide = (props) => <Slide {...props} direction="up" />;
const TOAST_ICONS = {
    success: { Icon: CheckCircleRoundedIcon, color: "#34D399" },
    error:   { Icon: CancelRoundedIcon,      color: "#F87171" },
    warning: { Icon: WarningRoundedIcon,     color: "#FBBF24" },
    info:    { Icon: InfoRoundedIcon,        color: "#7BA7F0" },
};
// 더 좁은 데스크탑(≤950px)에서는 사이드바도 강제로 접어 본문 폭 확보
const NARROW_SIDEBAR_COLLAPSE_MAX = 950;

export default function Layout({ children }) {
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
    // 데스크탑(>=md) 한정 좁은 화면 감지 — 모바일에는 영향 없음
    const isDesktopNarrowForDetail = useMediaQuery(`(max-width:${NARROW_DETAIL_OVERLAY_MAX}px)`);
    const isDesktopNarrowForSidebar = useMediaQuery(`(max-width:${NARROW_SIDEBAR_COLLAPSE_MAX}px)`);
    const shouldOverlayDetail = isMdUp && isDesktopNarrowForDetail;
    const shouldForceCollapseSidebar = isMdUp && isDesktopNarrowForSidebar;
    const isDark = theme.palette.mode === "dark";
    // 본문 카드 뒤 + 사이드바/네비바가 공유하는 캔버스(크롬) 색.
    const canvas = getCanvasBg(theme);
    const location = useLocation();

    const { detailOpen, detailContent, detailLayout, closeDetail, sidebarCollapsed, toggleSidebar, pageRefreshRef, immersive } = useLayout();
    // 확장(가운데 모달) 모드는 데스크탑에서만. 모바일은 항상 바텀시트.
    // 배치별 파생 플래그. 모바일(!isMdUp)은 기존처럼 전체화면 시트 하나만 쓴다.
    const detailModalDesktop = isMdUp && detailLayout === "modal";
    const detailFullscreenDesktop = isMdUp && detailLayout === "fullscreen";
    // 본문을 밀지 않는 배치(모달·전체화면)를 한 번에 가리키는 이름
    const detailOverlaysContent = detailModalDesktop || detailFullscreenDesktop;
    const { showWelcome: rawShowWelcome, completeWelcome, snoozeWelcome } = useWelcomeFlow();
    // 이메일 미인증 안내 — 인증된 계정(소셜 포함)·게스트·이번 세션에 닫은 경우 show=false
    const emailVerify = useEmailVerification();
    // 둘러보기 안내 — 게스트는 이메일 인증 배너 대상이 아니므로 두 배너가 동시에 뜨지 않는다.
    const guestMode = isGuest();
    // 온보딩은 뷰포트에 따라 두 경로 중 **하나만** 탄다 (isMdUp으로 배타 → 이중 렌더 불가).
    //  - 모바일(!isMdUp): DashboardMobile이 대시보드 대신 전체화면 WelcomeFlow를 렌더한다.
    //    여기서 showWelcome은 그동안 Navbar/바텀네비 같은 크롬을 숨기는 용도로만 쓴다.
    //  - 데스크탑(isMdUp): 아래 WelcomeDialog(중앙 모달 + 어두운 백드롭)로 띄운다.
    //    크롬은 그대로 두므로 Navbar가 사라지지 않는다.
    const showWelcome = rawShowWelcome && !isMdUp;

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        rememberRoute(location.pathname);
    }, [location.pathname]);
    // 로그인 세션 동안 글로벌 STOMP 연결 유지 → 백엔드 presence 추적용
    useGlobalStomp();

    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [toast, setToast] = useState(null); // { message, severity }
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    // 좁은 데스크탑(≤950px)에서 사용자가 메뉴 클릭으로 사이드바를 일시적으로 펼친 상태.
    // 영구 저장(localStorage)과 분리해 두고, 임계점을 다시 넘어가면 자동으로 리셋한다.
    const [narrowExpandOverride, setNarrowExpandOverride] = useState(false);
    useEffect(() => {
        if (!shouldForceCollapseSidebar) setNarrowExpandOverride(false);
    }, [shouldForceCollapseSidebar]);

    // Pull-to-refresh state (mobile native only)
    const isNative = Capacitor.isNativePlatform();
    const [pullY, setPullY] = useState(0);
    const [ptr, setPtr] = useState(false); // refreshing
    const ptrStartY = useRef(0);
    const ptrStartX = useRef(0);
    const ptrLocked = useRef(false); // 가로 swipe로 판정되면 pull 잠금
    const ptrActive = useRef(false);
    const ptrYRef = useRef(0);
    const scrollRef = useRef(null);

    const handleTouchStart = useCallback((e) => {
        if (!isNative || ptr || location.pathname === "/map" || location.pathname === "/calendar" || location.pathname.startsWith("/recruitments")) return;
        if (e.target.closest(".MuiDrawer-root, .MuiModal-root, [data-sheet]")) return;
        ptrStartY.current = e.touches[0].clientY;
        ptrStartX.current = e.touches[0].clientX;
        ptrActive.current = false;
        ptrLocked.current = false;
    }, [isNative, ptr, location.pathname]);

    const handleTouchMove = useCallback((e) => {
        if (!isNative || ptr || location.pathname === "/map" || location.pathname === "/calendar" || location.pathname.startsWith("/recruitments")) return;
        if (e.target.closest(".MuiDrawer-root, .MuiModal-root, [data-sheet]")) return;
        if (ptrLocked.current) return; // 가로 swipe로 이미 판정 → pull 안 잡음
        const el = e.currentTarget;
        if (el.scrollTop > 0) {
            if (ptrActive.current) { ptrActive.current = false; ptrYRef.current = 0; setPullY(0); }
            return;
        }
        const dy = e.touches[0].clientY - ptrStartY.current;
        const dx = e.touches[0].clientX - ptrStartX.current;
        // 시작 후 의미있는 이동이 있을 때만 방향 판정 (아주 작은 흔들림은 무시)
        const moveMag = Math.max(Math.abs(dx), Math.abs(dy));
        if (moveMag < 8) return;
        // 가로 우세이거나 위로 향하는 swipe → pull 잠금 (carousel/지도 panning과 충돌 방지)
        if (Math.abs(dx) > Math.abs(dy) || dy <= 0) {
            ptrLocked.current = true;
            if (ptrActive.current) { ptrActive.current = false; ptrYRef.current = 0; setPullY(0); }
            return;
        }
        const wasBelowThreshold = ptrYRef.current < PULL_THRESHOLD;
        ptrActive.current = true;
        const clamped = Math.min(dy * 0.5, MAX_PULL);
        ptrYRef.current = clamped;
        setPullY(clamped);
        // threshold 처음 도달 시 진동 (release하면 새로고침 trigger 신호)
        if (wasBelowThreshold && clamped >= PULL_THRESHOLD) {
            hapticMedium();
        }
    }, [isNative, ptr, location.pathname]);

    const handleTouchEnd = useCallback(async () => {
        if (!ptrActive.current) return;
        ptrActive.current = false;
        const y = ptrYRef.current;
        ptrYRef.current = 0;
        setPullY(0);
        if (y >= PULL_THRESHOLD && pageRefreshRef.current) {
            setPtr(true);
            try { await pageRefreshRef.current(); }
            finally { setPtr(false); }
        }
    }, [pageRefreshRef]);

    useEffect(() => {
        const handler = (e) => setToast(e.detail);
        window.addEventListener(APP_EVENTS.APP_TOAST, handler);
        return () => window.removeEventListener(APP_EVENTS.APP_TOAST, handler);
    }, []);

    // 게스트 차단 — 어디서든 blockIfGuest() 호출 시 전역 모달 열림
    // event.detail.description 으로 컨텍스트별 메시지 전달 가능 (없으면 GuestBlockModal 기본값)
    const [guestBlockOpen, setGuestBlockOpen] = useState(false);
    const [guestBlockDesc, setGuestBlockDesc] = useState(null);
    useEffect(() => {
        const h = (e) => {
            setGuestBlockDesc(e?.detail?.description ?? null);
            setGuestBlockOpen(true);
        };
        window.addEventListener(APP_EVENTS.GUEST_BLOCK_REQUEST, h);
        return () => window.removeEventListener(APP_EVENTS.GUEST_BLOCK_REQUEST, h);
    }, []);

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            setToast({ message: "인터넷에 연결되었습니다.", severity: "success" });
        };
        const goOffline = () => setIsOnline(false);
        window.addEventListener("online", goOnline);
        window.addEventListener("offline", goOffline);
        return () => {
            window.removeEventListener("online", goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);

    // ──────────────────────────────────────────────────────────────
    // 뒤로가기 처리 (Android 갤럭시 하드웨어 백버튼 + 데스크탑 브라우저)
    //
    // 패널이 열릴 때 히스토리에 더미 항목을 추가(back-trap)한다.
    // 뒤로가기가 오면 더미 항목을 소비하고 패널을 닫는다.
    // 패널이 X 버튼 등으로 닫히면 history.back()으로 더미를 정리한다.
    // 라우트가 바뀌어 패널이 자동 닫힌 경우에는 더미를 남겨둔다
    // (같은 해시가 아니면 history.back()을 호출하지 않아 의도치 않은
    //  페이지 전환을 방지).
    // ──────────────────────────────────────────────────────────────
    const backTrap = useRef({ active: false, hash: "" });

    // 패널 열림/닫힘 → back-trap 추가·정리
    useEffect(() => {
        const anyOpen = detailOpen || mobileSidebarOpen || chatOpen;

        if (anyOpen && !backTrap.current.active) {
            // React Router history 패키지의 idx를 보존하면서 back-trap 삽입
            window.history.pushState(
                { ...window.history.state, __backTrap: true },
                "",
                window.location.href
            );
            backTrap.current = { active: true, hash: window.location.hash };
        } else if (!anyOpen && backTrap.current.active) {
            const onSamePage = window.location.hash === backTrap.current.hash;
            backTrap.current = { active: false, hash: "" };
            // 같은 페이지에서 닫힌 경우에만 더미 항목을 제거
            // (라우트 전환으로 닫힌 경우 history.back()을 부르면 이전 페이지로 이동함)
            if (onSamePage) {
                window.history.back();
            }
        }
    }, [detailOpen, mobileSidebarOpen, chatOpen]);

    // popstate 리스너 — 뒤로가기 감지
    useEffect(() => {
        const handlePopState = () => {
            if (!backTrap.current.active) return;
            backTrap.current = { active: false, hash: "" };

            // 우선순위: 모바일사이드바 → 디테일패널 → 채팅
            if (mobileSidebarOpen) {
                setMobileSidebarOpen(false);
            } else if (detailOpen) {
                closeDetail();
            } else if (chatOpen) {
                setChatOpen(false);
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [detailOpen, mobileSidebarOpen, chatOpen, closeDetail]);

    // ChatWidget 열기 요청 (Dashboard Quickbar 등 외부에서 dispatch)
    useEffect(() => {
        const open = () => setChatOpen(true);
        window.addEventListener(APP_EVENTS.OPEN_CHAT, open);
        return () => window.removeEventListener(APP_EVENTS.OPEN_CHAT, open);
    }, []);

    // 라우트 전환 시 패널 닫기 (기존 동작 유지)
    useEffect(() => {
        closeDetail();
    }, [location.pathname, closeDetail]);

    const isRecruitment = location.pathname.startsWith("/recruitments");
    // 데스크탑 온보딩 모달. /recruitments는 Layout 라우트 중 유일하게 ProtectedRoute 밖이라
    // 비로그인 게스트에게도 뜰 수 있어 제외한다 (나머지 Layout 라우트는 전부 로그인 상태).
    const showWelcomeDialog = rawShowWelcome && isMdUp && !isRecruitment;

    // 설정 페이지에서는 섹션 내비(SidebarSettingsPanel)가 패널 안에 있으므로 무조건 패널을 펼침.
    const isSettingsSection = location.pathname.startsWith("/settings");
    // 좁은 데스크탑에서는 영구 설정과 무관하게 강제 접기. 단, 사용자가 메뉴 버튼으로
    // 명시적으로 펼친 경우(narrowExpandOverride)는 존중.
    const effectiveSidebarCollapsed = isSettingsSection
        ? false
        : shouldForceCollapseSidebar
            ? !narrowExpandOverride
            : sidebarCollapsed;

    const sidebarWidth = useMemo(
        () => (effectiveSidebarCollapsed ? W_COLLAPSED : W_EXPANDED),
        [effectiveSidebarCollapsed]
    );

    // 상세 패널이 오버레이/확장모달일 때는 본문을 밀지 않음 (mr 0).
    // 도킹 시엔 카드 폭 + 본문과의 갭(8) 만큼 밀어 본문 카드와 상세 카드 사이에 여백.
    const mainRightMargin = useMemo(
        () => (isMdUp && detailOpen && !shouldOverlayDetail && !detailOverlaysContent ? `${DETAIL_W + 8}px` : 0),
        [isMdUp, detailOpen, shouldOverlayDetail, detailOverlaysContent]
    );

    const handleMenuClick = () => {
        if (!isMdUp) return;
        if (shouldForceCollapseSidebar) {
            // 좁은 데스크탑: 영구 설정 건드리지 않고 일시 override만 토글
            setNarrowExpandOverride((p) => !p);
        } else {
            toggleSidebar();
        }
    };

    const isMapPage = location.pathname === "/map";
    // 회고는 자체 뒤로가기 헤더를 가진 몰입형 화면 — 모바일에서 글로벌 Navbar와 이중 헤더 방지
    const isWrapPage = location.pathname.startsWith("/wrap");

    // 모바일에서 상단 Navbar가 뜨는 화면 (몰입형·지도·회고·팀모집은 자체 헤더를 쓴다)
    const mobileHasNavbar = !immersive && !isMapPage && !isWrapPage && !isRecruitment;
    // 자체 헤더 화면(지도 등)은 레이아웃을 건드리지 않도록 배너를 띄우지 않는다
    const showMobileVerifyBanner = !isMdUp && !showWelcome && mobileHasNavbar && emailVerify.show;
    const showMobileGuestBanner = !isMdUp && !showWelcome && mobileHasNavbar && guestMode && !isRecruitment;
    /* Navbar 보정 pt 를 0 으로 내릴지 판단하는 기준.
       흐름에 놓이는 배너만 센다 — 그 배너가 Navbar 자리를 대신 밀어주기 때문이다.
       게스트 안내는 화면 아래에 떠 있어(fixed) 자리를 차지하지 않으므로 여기서 빠진다.
       넣어두면 게스트 안내만 뜬 화면에서 pt 가 0 이 되어 **본문이 Navbar 뒤로 숨는다.** */
    const showMobileTopBanner = showMobileVerifyBanner;

    return (
        <Box sx={{
            display: "flex",
            height: "100dvh",
            overflow: "hidden",
            bgcolor: "background.default",
            // 모바일에서 Navbar가 보이는 페이지는 Navbar 자체가 노치(safe-area-inset-top)까지 확장되어 glass로 덮으므로
            // Layout 측 safe-area pt는 불필요. Navbar가 없는 페이지(map/recruitment)에서는 그대로 유지.
            pt: !isMdUp && !isMapPage
                ? (isRecruitment || isWrapPage || immersive)
                    ? `calc(env(safe-area-inset-top, 0px) + ${isOnline ? "0px" : "36px"})`
                    : (isOnline ? 0 : "36px")
                : (isOnline ? 0 : "36px"),
            ...(!isMdUp && !isMapPage ? {
                background: getMobilePageBg(theme),
            } : {}),
            ...(!isMdUp && isMapPage ? {
                bgcolor: "background.paper",
            } : {}),
        }}>
            <CssBaseline />

            {/* 오프라인 배너 */}
            {!isOnline && (
                <Box
                    sx={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: Z.OVERLAY_TOP,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.75,
                        bgcolor: "warning.main",
                        color: "warning.contrastText",
                    }}
                >
                    <WifiOffRoundedIcon sx={{ fontSize: 15 }} />
                    <Typography variant="caption" fontWeight={700}>
                        오프라인 상태입니다. 인터넷 연결을 확인해주세요.
                    </Typography>
                </Box>
            )}

            <PushNotificationHandler />

            {isMdUp && !isRecruitment && (
                <Sidebar
                    mobileOpen={mobileSidebarOpen}
                    onMobileClose={() => setMobileSidebarOpen(false)}
                    collapsedOverride={effectiveSidebarCollapsed}
                />
            )}

            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    bgcolor: isMdUp ? canvas : undefined,
                    // 상단 8px 캔버스 여백 — 레일·빠른캡처와 같은 높이에서 네비바가 시작
                    pt: isMdUp ? "8px" : 0,
                    ml: { md: isMdUp && isRecruitment ? 0 : `${sidebarWidth}px` },
                }}
            >
                {!showWelcome && (isMdUp || (!immersive && !isMapPage && !isWrapPage && !location.pathname.startsWith("/recruitments"))) && !isRecruitment && (
                    <Navbar
                        onMenuClick={handleMenuClick}
                        onOpenChat={() => setChatOpen((p) => !p)}
                    />
                )}

                {/* 이메일 미인증 안내 — 인증된 계정(소셜 포함)·게스트에는 렌더되지 않음.
                    데스크탑은 네비바 아래 캔버스에, 모바일은 아래 스크롤 영역 상단에 붙는다. */}
                {isMdUp && !isRecruitment && <EmailVerifyBanner {...emailVerify} sx={{ mx: 1, mt: 1 }} />}
                {isMdUp && !isRecruitment && guestMode && <GuestModeBanner />}

                {isMdUp ? (
                    <Box sx={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0, bgcolor: canvas, mr: { md: mainRightMargin } }}>
                        {/* 본문 = 카드. 패널 펼침 시 왼쪽은 패널과 붙음(여백·라운드 없음),
                            접힘 시 사방 여백(레일과도 떨어져 독립적으로). */}
                        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, pt: 0, pr: 1, pb: 1, pl: effectiveSidebarCollapsed ? 1 : 0, overflow: "hidden" }}>
                            <Box sx={{
                                height: "100%",
                                minWidth: 0,
                                overflow: "auto",
                                borderRadius: effectiveSidebarCollapsed ? "16px" : "0 16px 16px 0",
                                bgcolor: "background.default",
                                border: "1px solid",
                                borderLeft: effectiveSidebarCollapsed ? "1px solid" : "none",
                                borderColor: "divider",
                                boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 3px rgba(15,23,42,0.06)",
                            }}>
                                {/* 전체화면 배치: 본문 대신 상세가 카드를 채운다.
                                    children 을 언마운트하지 않고 감춰서, 돌아왔을 때
                                    스크롤 위치와 목록 상태가 유지되게 한다. */}
                                {detailOpen && detailFullscreenDesktop && (
                                    <Box sx={{
                                        height: "100%",
                                        minWidth: 0,
                                        width: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                    }}>
                                        {detailContent}
                                    </Box>
                                )}
                                {/* height:100% 를 준다.
                                    [고치는 결함] 이 래퍼에 높이가 없어서 **height:100% 로 채우는
                                    화면(지도)이 0 높이로 접혔다.** 카카오 지도는 컨테이너 높이가
                                    0 이면 타일을 아예 요청하지 않아, 콘솔 에러도 실패 요청도 없이
                                    검은 화면만 남는다 — 원인을 찾을 단서가 하나도 없다.
                                    바로 위 상세 분기가 같은 패턴(height:100%)으로 이미 동작한다.
                                    내용이 카드보다 길면 넘친 만큼 카드(overflow:auto)가 스크롤한다. */}
                                <Box sx={{
                                    display: detailOpen && detailFullscreenDesktop ? "none" : "block",
                                    height: "100%",
                                }}>
                                    {children}
                                </Box>
                            </Box>
                        </Box>

                        <Drawer
                            anchor="right"
                            open={detailOpen && !detailOverlaysContent}
                            onClose={closeDetail}
                            variant={shouldOverlayDetail ? "temporary" : "persistent"}
                            ModalProps={shouldOverlayDetail ? { keepMounted: true } : undefined}
                            sx={shouldOverlayDetail ? { zIndex: Z.DETAIL_PANEL } : undefined}
                            PaperProps={{
                                sx: {
                                    width: DETAIL_W,
                                    // 본문 카드처럼 캔버스 위에 둥근 카드로 띄움 (네비 아래 + 사방 8px 여백)
                                    top: `calc(${DESKTOP_NAVBAR_HEIGHT}px + 8px)`,
                                    bottom: "8px",
                                    right: "8px",
                                    height: "auto",
                                    maxHeight: "none",
                                    borderRadius: "16px",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    bgcolor: "background.default",
                                    overflow: "hidden",
                                    boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.45)" : "0 8px 32px rgba(15,23,42,0.12)",
                                },
                            }}
                        >
                            {!detailOverlaysContent && detailContent}
                        </Drawer>

                        {/* 확장(가운데 모달) 모드 — 같은 detailContent를 넓게.
                            동작 검증된 TodoDetailModal과 동일한 Dialog 설정(기본 modal z-index,
                            maxWidth md + fullWidth, Paper는 maxHeight만)으로 맞춤. */}
                        <Dialog
                            open={detailOpen && detailModalDesktop}
                            onClose={closeDetail}
                            maxWidth="md"
                            fullWidth
                            PaperProps={{
                                sx: {
                                    borderRadius: 3,
                                    height: "85vh",
                                    maxHeight: "90vh",
                                    overflow: "hidden",
                                },
                            }}
                        >
                            {detailModalDesktop && detailContent}
                        </Dialog>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            display: "flex",
                            justifyContent: "center",
                            overflow: "hidden",
                        }}
                    >
                        <Box
                            sx={{
                                width: "100%",
                                maxWidth: location.pathname.startsWith("/recruitments") ? "none" : 560,
                                minHeight: 0,
                                display: "flex",
                                flexDirection: "column",
                                position: "relative",
                            }}
                        >
                            {/* 이메일 미인증 안내 — 스크롤 영역 '밖'(고정 Navbar 아래). 안에 넣으면
                                height:100% 페이지(/todos·/calendar 등)가 배너 높이만큼 넘친다. */}
                            {showMobileVerifyBanner && (
                                <EmailVerifyBanner
                                    {...emailVerify}
                                    sx={{ mx: 1.5, mt: `calc(env(safe-area-inset-top, 0px) + ${MOBILE_NAVBAR_HEIGHT}px)`, mb: 1 }}
                                />
                            )}

                            {showMobileGuestBanner && <GuestModeBanner />}

                            <Box
                                ref={scrollRef}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                sx={{
                                    flex: 1,
                                    minHeight: 0,
                                    overflowY: showWelcome ? "hidden"
                                        : (location.pathname === "/todos" || location.pathname.startsWith("/recruitments") || location.pathname === "/calendar" || location.pathname === "/tasklist") ? "hidden" : "auto",
                                    WebkitOverflowScrolling: "touch",
                                    ...hideScrollbarSx,
                                    // Navbar fixed → 컨텐츠가 그 뒤에서 시작하고 스크롤 시 backdrop으로 흘러야 backdrop-filter 동작
                                    // (Navbar 없는 페이지 — map/recruitment/wrap — 는 보정 불필요)
                                    pt: showWelcome ? 0
                                        : mobileHasNavbar
                                            ? (showMobileTopBanner
                                                ? 0
                                                : `calc(env(safe-area-inset-top, 0px) + ${MOBILE_NAVBAR_HEIGHT}px)`)
                                            : 0,
                                    pb: showWelcome ? 0
                                        : (location.pathname === "/todos" || location.pathname.startsWith("/recruitments") || location.pathname === "/calendar" || location.pathname === "/tasklist")
                                            ? 0
                                            : isAndroid
                                                ? "calc(env(safe-area-inset-bottom, 0px) + 72px)"
                                                : "calc(env(safe-area-inset-bottom, 0px) + 64px)",
                                }}
                            >
                                {/* Pull-to-refresh indicator */}
                                {isNative && (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            height: ptr ? 48 : pullY,
                                            overflow: "hidden",
                                            transition: pullY === 0 ? "height 0.25s ease" : "none",
                                            pointerEvents: "none",
                                        }}
                                    >
                                        {(pullY > 5 || ptr) && (
                                            <CircularProgress
                                                size={24}
                                                variant={ptr ? "indeterminate" : "determinate"}
                                                value={Math.min((pullY / PULL_THRESHOLD) * 100, 100)}
                                            />
                                        )}
                                    </Box>
                                )}
                                <PageTransition>{children}</PageTransition>
                            </Box>

                            {!isRecruitment && !showWelcome && !immersive && !isWrapPage && <MobileBottomNav />}

                            <Drawer
                                anchor="bottom"
                                open={detailOpen}
                                onClose={closeDetail}
                                variant="temporary"
                                ModalProps={{ keepMounted: true }}
                                sx={{ zIndex: Z.DETAIL_PANEL }}
                                PaperProps={{
                                    sx: {
                                        // 풀-스크린으로 띄워 뒤 페이지가 비치는 시각 노이즈 제거.
                                        // 닫기는 헤더의 ← 또는 X 버튼.
                                        height: "100dvh",
                                        maxHeight: "100dvh",
                                        borderRadius: 0,
                                        overflow: "hidden",
                                        background: theme.palette.background.paper,
                                        backgroundImage: "none",
                                    },
                                }}
                            >
                                {detailContent}
                            </Drawer>
                        </Box>
                    </Box>
                )}
            </Box>

            <ChatWidget
                open={chatOpen}
                onClose={() => setChatOpen(false)}
                onToggle={() => setChatOpen((p) => !p)}
                detailOpen={detailOpen}
            />

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={2600}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                TransitionComponent={ToastSlide}
                sx={{
                    zIndex: Z.TOAST,
                    mb: { xs: "calc(env(safe-area-inset-bottom, 0px) + 84px)", sm: "16px" },
                    // Snackbar 기본 풀폭(xs) 해제 — 내용만큼만
                    left: "50% !important",
                    right: "auto !important",
                    transform: "translateX(-50%)",
                    maxWidth: "calc(100vw - 48px)",
                }}
            >
                {(() => {
                    const { Icon, color } = TOAST_ICONS[toast?.severity] ?? TOAST_ICONS.info;
                    return (
                        <Box
                            onClick={() => setToast(null)}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                px: 2,
                                py: 1.25,
                                borderRadius: "14px",
                                bgcolor: isDark ? "rgba(58,58,70,0.97)" : "rgba(30,32,40,0.95)",
                                color: "rgba(255,255,255,0.95)",
                                boxShadow: "0 8px 28px rgba(0,0,0,0.32)",
                                fontSize: 14,
                                fontWeight: 600,
                                letterSpacing: "-0.01em",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                            }}
                        >
                            <Icon sx={{ fontSize: 19, color, flexShrink: 0 }} />
                            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {toast?.message}
                            </Box>
                        </Box>
                    );
                })()}
            </Snackbar>

            {/* 데스크탑 온보딩 — 중앙 모달. 모바일 전체화면 경로(DashboardMobile)와 배타적. */}
            <WelcomeDialog
                open={showWelcomeDialog}
                onComplete={completeWelcome}
                onSkip={snoozeWelcome}
                onNeverShow={completeWelcome}
            />

            {/* 전역 GuestBlockModal — APP_EVENTS.GUEST_BLOCK_REQUEST 이벤트로 어디서든 트리거 */}
            <GuestBlockModal
                open={guestBlockOpen}
                onClose={() => setGuestBlockOpen(false)}
                description={guestBlockDesc}
            />
        </Box>
    );
}
