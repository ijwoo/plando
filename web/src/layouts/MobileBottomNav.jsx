import { getTaskPath } from "../features/todo/utils/taskView.js";
import React, { useState } from "react";
import { hapticLight } from "../shared/utils/haptics.js";
import { useLocation, useNavigate } from "react-router-dom";
import { alpha, useTheme } from "@mui/material/styles";
import { useDmUnreadCount } from "../features/dm/hooks/useDmUnreadCount.js";
import { isAndroid, isIOS, isNative } from "../shared/utils/platformUtils.js";
import { getAndroidSolidBg } from "../shared/ui/glassSx.js";
import { Z } from "../shared/ui/zIndex.js";

// ── Custom SVG Icons ──────────────────────────────────────────────
// innerColor: filled 상태에서 내부 선/점 색 (배경과 대비)
const Icons = {
    Home: ({ filled, color, innerColor }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {filled ? (
                <>
                    <path d="M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" fill={color} />
                    <path d="M9 22V12h6v10" stroke={innerColor} strokeWidth="1.8" fill="none" />
                </>
            ) : (
                <path d="M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5zM9 22V12h6v10" stroke={color} strokeWidth="1.8" fill="none" />
            )}
        </svg>
    ),
    Tasks: ({ filled, color }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4.5" cy="6"  r={filled ? 2 : 1.5} fill={filled ? color : "none"} stroke={color} strokeWidth={filled ? 0 : 1.8} />
            <circle cx="4.5" cy="12" r={filled ? 2 : 1.5} fill={filled ? color : "none"} stroke={color} strokeWidth={filled ? 0 : 1.8} />
            <circle cx="4.5" cy="18" r={filled ? 2 : 1.5} fill={filled ? color : "none"} stroke={color} strokeWidth={filled ? 0 : 1.8} />
        </svg>
    ),
    Calendar: ({ filled, color, innerColor }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round">
            {filled ? (
                <>
                    <rect x="3" y="4" width="18" height="18" rx="4" fill={color} />
                    <line x1="16" y1="2" x2="16" y2="7" stroke={color} strokeWidth="2.2" />
                    <line x1="8"  y1="2" x2="8"  y2="7" stroke={color} strokeWidth="2.2" />
                    <line x1="3"  y1="10" x2="21" y2="10" stroke={innerColor} strokeWidth="1.8" />
                    <circle cx="8"  cy="15" r="1.5" fill={innerColor} />
                    <circle cx="12" cy="15" r="1.5" fill={innerColor} />
                    <circle cx="16" cy="15" r="1.5" fill={innerColor} />
                </>
            ) : (
                <>
                    <rect x="3" y="4" width="18" height="18" rx="4" stroke={color} strokeWidth="1.8" />
                    <line x1="16" y1="2" x2="16" y2="7" stroke={color} strokeWidth="2" />
                    <line x1="8"  y1="2" x2="8"  y2="7" stroke={color} strokeWidth="2" />
                    <line x1="3"  y1="10" x2="21" y2="10" stroke={color} strokeWidth="1.8" />
                </>
            )}
        </svg>
    ),
    Board: ({ filled, color }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round">
            {filled ? (
                <>
                    <rect x="3"  y="3" width="7" height="18" rx="2.5" fill={color} />
                    <rect x="14" y="3" width="7" height="11" rx="2.5" fill={color} />
                </>
            ) : (
                <>
                    <rect x="3"  y="3" width="7" height="18" rx="2.5" stroke={color} strokeWidth="1.8" />
                    <rect x="14" y="3" width="7" height="11" rx="2.5" stroke={color} strokeWidth="1.8" />
                </>
            )}
        </svg>
    ),
    Map: ({ filled, color, innerColor }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {filled ? (
                <>
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" fill={color} />
                    <line x1="8"  y1="2" x2="8"  y2="18" stroke={innerColor} strokeWidth="1.6" />
                    <line x1="16" y1="6" x2="16" y2="22" stroke={innerColor} strokeWidth="1.6" />
                </>
            ) : (
                <>
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" stroke={color} strokeWidth="1.8" />
                    <line x1="8"  y1="2" x2="8"  y2="18" stroke={color} strokeWidth="1.6" />
                    <line x1="16" y1="6" x2="16" y2="22" stroke={color} strokeWidth="1.6" />
                </>
            )}
        </svg>
    ),
    Dm: ({ filled, color, innerColor }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {filled ? (
                <>
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill={color} />
                    <circle cx="9"  cy="11" r="1" fill={innerColor} />
                    <circle cx="12" cy="11" r="1" fill={innerColor} />
                    <circle cx="15" cy="11" r="1" fill={innerColor} />
                </>
            ) : (
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth="1.8" fill="none" />
            )}
        </svg>
    ),
    More: ({ filled, color }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="5"  cy="12" r={filled ? 2.2 : 1.8} fill={color} />
            <circle cx="12" cy="12" r={filled ? 2.2 : 1.8} fill={color} />
            <circle cx="19" cy="12" r={filled ? 2.2 : 1.8} fill={color} />
        </svg>
    ),
    Settings: ({ filled, color }) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" stroke={color} strokeWidth={filled ? 2.2 : 1.8} />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={filled ? 2.2 : 1.8} />
        </svg>
    ),
};

// 바텀 nav 주요 항목 (4개)
const buildNavItems = (dmUnread) => [
    { label: "홈",     route: "/dashboard", Icon: Icons.Home     },
    // 마지막으로 본 뷰(목록/보드)로. 고른 적 없으면 목록이 기본이다.
    { label: "할 일",  route: getTaskPath(), Icon: Icons.Tasks    },
    { label: "캘린더", route: "/calendar",  Icon: Icons.Calendar },
    { label: "메시지", route: "/dm",        Icon: Icons.Dm,      badge: dmUnread },
];

// ── Tokens ────────────────────────────────────────────────────────
// 예전엔 light/dark 2벌 하드코딩 테이블이었다 → 8개 테마 중 6개가 잘못된 색을 썼다.
// 이제 전부 활성 theme.palette 에서 파생 (그림자만 hue가 아닌 depth라 mode 기준 유지).
function buildNavTokens(theme) {
    const dark = theme.palette.mode === "dark";
    const text = theme.palette.text.primary;
    const white = theme.palette.common.white;
    return {
        navBg:        "transparent",
        navBorderTop: alpha(text, 0.07),
        navBorderBot: dark ? alpha(text, 0.03) : "transparent",
        navShadow:    dark
            ? "0 -0.5px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.35)"
            : "0 -0.5px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
        // 상단 스페큘러 하이라이트 — 테마와 무관하게 흰 광택
        gradTop:      alpha(white, dark ? 0.02 : 0.40),
        pillBg:       alpha(text, dark ? 0.10 : 0.07),
        pressBg:      alpha(text, dark ? 0.07 : 0.05),
        active:       text,
        inactive:     alpha(text, dark ? 0.32 : 0.30),
        // filled 아이콘 내부 '구멍' — 아이콘(=active/text) 과 대비되도록 배경 계열
        innerColor:   dark ? alpha(theme.palette.background.default, 0.88) : theme.palette.background.paper,
    };
}

export default function MobileBottomNav() {
    const location  = useLocation();
    const navigate  = useNavigate();
    const theme     = useTheme();
    const t         = buildNavTokens(theme);
    // Android: 투명 대신 불투명 솔리드 배경 사용 (blur 제거)
    const navBgSolid = getAndroidSolidBg(theme);

    const dmUnread = useDmUnreadCount();
    const NAV_ITEMS = buildNavItems(dmUnread);

    const [pressed, setPressed] = useState(null);

    // 더보기 허브(/more) 및 그 하위 기능 라우트들 — 더보기 탭 active 컨텍스트
    const MORE_ROUTES = ["/more", "/settings", "/map", "/wrap", "/recruitments"];
    const isMoreRoute = MORE_ROUTES.some((r) => location.pathname.startsWith(r));
    const currentRoute = isMoreRoute
        ? null
        : (NAV_ITEMS.find((item) => location.pathname.startsWith(item.route))?.route || "/dashboard");

    const navButton = ({ key, label, Icon, badge, active, isPressed, onStart, onEnd, onCancel, onClick }) => (
        <button
            key={key}
            onTouchStart={onStart}
            onTouchEnd={(e) => { e.preventDefault(); onEnd(); }}
            onTouchCancel={onCancel}
            onClick={onClick}
            style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, padding: "2px 0", outline: "none", position: "relative",
                WebkitTapHighlightColor: "transparent",
            }}
        >
            <div style={{
                position: "absolute", inset: "0 8% 0 8%", borderRadius: 999,
                background: active ? t.pillBg : isPressed ? t.pressBg : "transparent",
                transform: isPressed ? "scale(0.88)" : "scale(1)",
                transition: "background 0.15s ease, transform 0.13s cubic-bezier(0.34,1.4,0.64,1)",
            }} />
            <div style={{
                position: "relative", zIndex: Z.STICKY, width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "transform 0.2s cubic-bezier(.34,1.4,.64,1)",
                transform: active ? "scale(1.10)" : isPressed ? "scale(0.88)" : "scale(1)",
            }}>
                <Icon filled={active} color={active ? t.active : t.inactive} innerColor={t.innerColor} />
                {badge > 0 && (
                    <div style={{
                        position: "absolute", top: -4, right: -4,
                        minWidth: 16, height: 16, borderRadius: 999,
                        background: theme.palette.error.main, color: theme.palette.error.contrastText,
                        fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0 3px", lineHeight: 1,
                    }}>
                        {badge > 99 ? "99+" : badge}
                    </div>
                )}
            </div>
            <span style={{
                fontSize: 10, fontWeight: active ? 700 : 400,
                color: active ? t.active : t.inactive,
                fontFamily: "-apple-system,'Noto Sans KR',sans-serif",
                letterSpacing: active ? -0.2 : 0,
                position: "relative", zIndex: Z.STICKY, transition: "all 0.18s",
            }}>
                {label}
            </span>
        </button>
    );

    return (
            <div style={{
                position: "fixed",
                bottom: isIOS ? "max(env(safe-area-inset-bottom, 0px), 8px)" : 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "calc(100% - 32px)",
                maxWidth: 480,
                zIndex: Z.MOBILE_NAV,
                willChange: "transform",
            }}>
            <div style={{
                background: isAndroid ? navBgSolid : t.navBg,
                ...(isAndroid ? {} : {
                    backdropFilter: "blur(12px) saturate(180%) brightness(105%)",
                    WebkitBackdropFilter: "blur(12px) saturate(180%) brightness(105%)",
                }),
                borderRadius: 999,
                borderTop:    `1px solid ${t.navBorderTop}`,
                borderLeft:   `1px solid ${t.navBorderTop}`,
                borderRight:  `1px solid ${t.navBorderTop}`,
                borderBottom: `1px solid ${t.navBorderBot}`,
                boxShadow: t.navShadow,
                display: "flex",
                paddingTop: 8,
                paddingLeft: 4,
                paddingRight: 4,
                paddingBottom: (isAndroid && isNative) ? 18 : 8,
                backgroundImage: `linear-gradient(to bottom, ${t.gradTop} 0%, rgba(255,255,255,0) 60%)`,
            }}>
                {/* 주요 항목 4개 */}
                {NAV_ITEMS.map(({ label, route, Icon, badge }) => {
                    const active = currentRoute === route;
                    const isPressed = pressed === route;
                    return navButton({
                        key: route, label, route, Icon, badge, active, isPressed,
                        onStart: () => { setPressed(route); hapticLight(); if (navigator.vibrate) navigator.vibrate(8); },
                        onEnd:   () => { setPressed(null); if (route !== location.pathname) navigate(route); },
                        onCancel: () => setPressed(null),
                        onClick: () => { if (route !== location.pathname) navigate(route); },
                    });
                })}

                {/* 더보기 버튼 — /more 허브로 이동 */}
                {navButton({
                    key: "more", label: "더보기", route: "/more",
                    Icon: Icons.More, badge: 0,
                    active: isMoreRoute,
                    isPressed: pressed === "more",
                    onStart:  () => { setPressed("more"); hapticLight(); if (navigator.vibrate) navigator.vibrate(8); },
                    onEnd:    () => { setPressed(null); if (location.pathname !== "/more") navigate("/more"); },
                    onCancel: () => setPressed(null),
                    onClick:  () => { if (location.pathname !== "/more") navigate("/more"); },
                })}
            </div>
        </div>
    );
}
