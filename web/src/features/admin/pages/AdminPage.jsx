import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert, Badge, Box, CircularProgress, IconButton, InputBase, Snackbar, Tooltip, Typography, useTheme,
} from "@mui/material";
import { ThemeProvider, createTheme, alpha } from "@mui/material/styles";
import {
    LayoutDashboard, Users, Flag, ScrollText, LogOut, ArrowLeft, Search, Bell, CalendarCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { adminApi, adminToken, isStepUpError } from "../api/adminApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import AdminGate from "../components/AdminGate.jsx";
import DashboardView from "../components/DashboardView.jsx";
import ReportsView from "../components/ReportsView.jsx";
import UsersView from "../components/UsersView.jsx";
import AuditView from "../components/AuditView.jsx";
import { Initial } from "../components/ui.jsx";

const NAV = [
    { id: "dashboard", label: "개요", icon: LayoutDashboard },
    { id: "users", label: "사용자 관리", icon: Users },
    { id: "reports", label: "신고", icon: Flag },
    { id: "audit", label: "감사 로그", icon: ScrollText },
];

const SESSION_MINUTES = 30;

/*
 * 백오피스는 사용자가 앱에서 고른 테마 색과 상관없이 같은 색(인디고)을 쓴다 — 운영 도구라는 게 한눈에 보이게.
 * 밝기(라이트/다크)는 앱 설정을 따른다.
 */
function adminTheme(outer) {
    const dark = outer.palette.mode === "dark";
    const main = dark ? "#8B93FF" : "#4F46E5";
    return createTheme(outer, {
        palette: {
            primary: { main, light: dark ? "#A5ABFF" : "#6366F1", dark: dark ? "#6E77F5" : "#4338CA", contrastText: dark ? "#0B0D1A" : "#FFFFFF" },
            background: dark ? outer.palette.background : { default: "#F6F7FB", paper: "#FFFFFF" },
            divider: dark ? outer.palette.divider : "#ECEEF4",
            action: {
                hover: alpha(main, dark ? 0.1 : 0.05),
                selected: alpha(main, dark ? 0.18 : 0.09),
            },
        },
    });
}

/*
 * 앱 전체가 html·body·#root 에 overflow: hidden 을 건다(iOS PWA 스크롤 밀림 방지).
 * 그래서 이 화면은 높이를 100dvh 로 고정하고, 스크롤은 안쪽 영역이 직접 맡는다.
 */
const SCREEN = { height: "100dvh", overflowY: "auto", bgcolor: "background.default" };

/**
 * 백오피스 (/#/admin).
 * 관리자가 아니면 서버가 404 를 주고, 이 화면도 "없는 페이지"처럼 보인다.
 * 앱 레이아웃(사이드바·워크스페이스) 밖에 따로 그린다 — 운영 도구는 앱 화면과 섞이지 않게.
 */
export default function AdminPage() {
    return (
        <ThemeProvider theme={adminTheme}>
            <AdminShell />
        </ThemeProvider>
    );
}

function AdminShell() {
    const navigate = useNavigate();
    const theme = useTheme();
    // 반응형 테두리는 색까지 한 줄로 — 미디어쿼리 안의 border 축약형이 색을 currentColor(검정)로 덮어쓴다
    const line = `1px solid ${theme.palette.divider}`;
    const mainRef = useRef(null);
    const [phase, setPhase] = useState("loading"); // loading | notfound | gate | ready
    const [me, setMe] = useState(null); // { enrolled, name, email }
    const [view, setView] = useState("dashboard");
    const [openReports, setOpenReports] = useState(0);
    const [toast, setToast] = useState("");
    const [tick, setTick] = useState(0);
    const [search, setSearch] = useState("");
    const [userQuery, setUserQuery] = useState("");

    useEffect(() => {
        adminApi.status()
            .then((s) => {
                setMe(s);
                setPhase(s.enrolled && adminToken.get() ? "ready" : "gate");
            })
            .catch(() => setPhase("notfound"));
    }, []);

    // 관리자 토큰이 만료되면(30분) OTP 화면으로. 다른 오류는 아래에 잠깐 띄운다.
    const onError = useCallback((e) => {
        if (isStepUpError(e)) {
            adminToken.clear();
            setPhase("gate");
            return;
        }
        setToast(getApiError(e, "요청을 처리하지 못했어요."));
    }, []);

    const refreshBadge = useCallback(() => {
        adminApi.stats().then((s) => setOpenReports(s.openReports)).catch(onError);
    }, [onError]);

    useEffect(() => { if (phase === "ready") refreshBadge(); }, [phase, refreshBadge, tick]);

    // 남은 시간 표시용 — 30초마다 다시 그린다
    const [, setNow] = useState(0);
    useEffect(() => {
        const t = setInterval(() => {
            setNow(Date.now());
            if (phase === "ready" && !adminToken.get()) setPhase("gate");
        }, 30_000);
        return () => clearInterval(t);
    }, [phase]);

    const go = useCallback((id) => {
        setView(id);
        mainRef.current?.scrollTo({ top: 0 });
    }, []);

    const views = useMemo(() => ({ dashboard: DashboardView, reports: ReportsView, users: UsersView, audit: AuditView }), []);

    if (phase === "loading") {
        return <Box sx={{ ...SCREEN, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box>;
    }
    if (phase === "notfound") {
        return (
            <Box sx={{ ...SCREEN, display: "grid", placeItems: "center", textAlign: "center", p: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>페이지를 찾을 수 없어요</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, cursor: "pointer" }} onClick={() => navigate("/")}>
                        홈으로 돌아가기
                    </Typography>
                </Box>
            </Box>
        );
    }
    if (phase === "gate") {
        return (
            <Box sx={SCREEN}>
                <AdminGate enrolled={!!me?.enrolled} onPassed={() => { setMe((m) => ({ ...m, enrolled: true })); setPhase("ready"); }} />
            </Box>
        );
    }

    const left = adminToken.get();
    const minutes = left ? Math.max(0, Math.ceil((new Date(left.expiresAt) - Date.now()) / 60_000)) : 0;
    const View = views[view];
    const current = NAV.find((n) => n.id === view);
    const endSession = () => { adminToken.clear(); setPhase("gate"); };
    const submitSearch = () => {
        setUserQuery(search.trim());
        go("users");
    };

    return (
        <Box sx={{
            height: "100dvh", overflow: "hidden", display: "flex", flexDirection: { xs: "column", md: "row" },
            bgcolor: "background.default",
        }}>
            {/* ── 왼쪽 메뉴 (좁은 화면에서는 위쪽 막대 + 탭) ── */}
            <Box component="nav" aria-label="백오피스 메뉴" sx={{
                width: { md: 248 }, flex: "none", display: "flex", flexDirection: "column",
                bgcolor: "background.paper", borderRight: { xs: "none", md: line }, borderBottom: { xs: line, md: "none" },
            }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: { xs: 2, md: 3 }, height: { xs: 56, md: 72 } }}>
                    <Box sx={{
                        width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", flex: "none",
                        bgcolor: "primary.main", color: "primary.contrastText",
                        boxShadow: (t) => `0 6px 14px -6px ${alpha(t.palette.primary.main, 0.7)}`,
                    }}>
                        <CalendarCheck size={19} />
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.03em" }}>Plan Do!</Typography>
                    <Box component="span" sx={{
                        px: 0.75, height: 20, borderRadius: 1, display: "inline-flex", alignItems: "center",
                        fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em", color: "primary.main", bgcolor: "action.selected",
                    }}>
                        ADMIN
                    </Box>
                    <Box sx={{ flex: 1 }} />
                    <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 0.25 }}>
                        <BellButton count={openReports} onClick={() => go("reports")} />
                        <Tooltip title="앱으로"><IconButton size="small" onClick={() => navigate("/")} aria-label="앱으로 돌아가기"><ArrowLeft size={18} /></IconButton></Tooltip>
                        <Tooltip title="관리자 인증 끝내기"><IconButton size="small" onClick={endSession} aria-label="관리자 인증 끝내기"><LogOut size={18} /></IconButton></Tooltip>
                    </Box>
                </Box>

                <Box sx={{
                    display: "flex", flexDirection: { xs: "row", md: "column" }, gap: { xs: 0.5, md: 0.75 },
                    px: { xs: 1.5, md: 2 }, pt: { md: 1 }, pb: { xs: 1, md: 0 }, overflowX: "auto",
                }}>
                    {NAV.map(({ id, label, icon: Icon }) => {
                        const on = view === id;
                        return (
                            <Box key={id} component="button" type="button" onClick={() => go(id)} aria-current={on ? "page" : undefined} sx={{
                                all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.5,
                                px: { xs: 1.25, md: 1.75 }, height: { xs: 36, md: 46 }, borderRadius: 2.5, flex: "none",
                                fontSize: { xs: 14, md: 15 }, fontWeight: on ? 700 : 500,
                                color: on ? "primary.main" : "text.secondary",
                                bgcolor: on ? "action.selected" : "transparent", transition: "background-color .12s, color .12s",
                                "&:hover": { bgcolor: on ? "action.selected" : "action.hover", color: on ? "primary.main" : "text.primary" },
                                "&:focus-visible": { outline: 2, outlineColor: "primary.main" },
                            }}>
                                <Icon size={20} strokeWidth={on ? 2.3 : 1.9} />
                                <span>{label}</span>
                                {id === "reports" && openReports > 0 && (
                                    <Box component="span" sx={{
                                        ml: { xs: 0.25, md: "auto" }, minWidth: 20, height: 20, px: 0.75, borderRadius: 10,
                                        display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: "#fff", bgcolor: "error.main",
                                    }}>
                                        {openReports}
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>

                <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />

                {/* 넓은 화면: 아래쪽 — 관리자 인증 남은 시간 + 계정 */}
                <Box sx={{ display: { xs: "none", md: "block" }, px: 2, pb: 2 }}>
                    <Box sx={{ px: 1.75, py: 1.5, mb: 1.5, borderRadius: 2.5, bgcolor: "action.hover" }}>
                        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>관리자 인증</Typography>
                            <Typography sx={{ fontSize: 12, color: minutes <= 5 ? "error.main" : "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                                {minutes}분 남음
                            </Typography>
                        </Box>
                        <Box sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: "divider", overflow: "hidden" }}>
                            <Box sx={{
                                height: "100%", borderRadius: 2, width: `${Math.min(100, (minutes / SESSION_MINUTES) * 100)}%`,
                                bgcolor: minutes <= 5 ? "error.main" : "primary.main", transition: "width .3s",
                            }} />
                        </Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, pt: 1.5, borderTop: line }}>
                        <Initial id={me?.email?.length} text={me?.name || me?.email} size={40} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>{me?.name || "관리자"}</Typography>
                            <Typography sx={{ fontSize: 12, color: "text.secondary" }} noWrap>{me?.email}</Typography>
                        </Box>
                        <Tooltip title="앱으로"><IconButton size="small" onClick={() => navigate("/")} aria-label="앱으로 돌아가기"><ArrowLeft size={17} /></IconButton></Tooltip>
                        <Tooltip title="관리자 인증 끝내기"><IconButton size="small" onClick={endSession} aria-label="관리자 인증 끝내기"><LogOut size={17} /></IconButton></Tooltip>
                    </Box>
                </Box>
            </Box>

            {/* ── 오른쪽: 위 막대 + 본문(여기만 스크롤) ── */}
            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <Box component="header" sx={{
                    display: { xs: "none", md: "flex" }, alignItems: "center", gap: 2, height: 72, px: 4, flex: "none",
                    bgcolor: "background.paper", borderBottom: line,
                }}>
                    <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                        관리자 <Box component="span" sx={{ mx: 1, opacity: 0.6 }}>/</Box>
                        <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{current?.label}</Box>
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Box component="form" role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }} sx={{
                        display: "flex", alignItems: "center", gap: 1, width: 340, height: 42, px: 1.75, borderRadius: 2.5,
                        border: line, bgcolor: "background.default",
                        "&:focus-within": { borderColor: "primary.main" },
                    }}>
                        <Search size={17} style={{ opacity: 0.55, flex: "none" }} />
                        <InputBase value={search} onChange={(e) => setSearch(e.target.value)} placeholder="사용자 이메일·이름 검색 후 Enter"
                                   inputProps={{ "aria-label": "사용자 검색" }} sx={{ flex: 1, fontSize: 14 }} />
                    </Box>
                    <BellButton count={openReports} onClick={() => go("reports")} />
                    <Initial id={me?.email?.length} text={me?.name || me?.email} size={38} />
                </Box>

                <Box component="main" ref={mainRef} sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                    <Box sx={{ maxWidth: 1360, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, pt: { xs: 2.5, md: 4 }, pb: 8 }}>
                        <View key={view === "users" ? `users:${userQuery}` : view}
                              onError={onError} onChanged={() => setTick((t) => t + 1)} go={go} initialQuery={userQuery} />
                    </Box>
                </Box>
            </Box>

            <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
                <Alert severity="error" variant="filled" onClose={() => setToast("")}>{toast}</Alert>
            </Snackbar>
        </Box>
    );
}

function BellButton({ count, onClick }) {
    return (
        <Tooltip title={count ? `대기 중인 신고 ${count}건` : "대기 중인 신고 없음"}>
            <IconButton onClick={onClick} aria-label="대기 중인 신고 보기">
                <Badge badgeContent={count} color="error" max={99}>
                    <Bell size={20} />
                </Badge>
            </IconButton>
        </Tooltip>
    );
}
