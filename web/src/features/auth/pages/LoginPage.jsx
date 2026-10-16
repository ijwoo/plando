import React, { useMemo, useState } from "react";
import PrivacyPolicyModal from "../../../shared/ui/common/PrivacyPolicyModal.jsx";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { Browser } from "@capacitor/browser";
import { isNative, isIOS } from "../../../shared/utils/platformUtils.js";
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
import { buildTheme } from "../../../shared/ui/theme.js";
import LoginPageMobile from "./LoginPageMobile.jsx";
import BrandMark from "../components/BrandMark.jsx";
import AuthVisualPanel from "../components/AuthVisualPanel.jsx";
import { fieldSx, FieldLabel } from "../../../shared/ui/common/fieldStyles.jsx";
import { BoardMockup, AiParseMockup, MapMockup } from "../../onboarding/components/tour/TourMockups.jsx";
import { AppleIcon, GoogleIcon, KakaoIcon } from "../components/AuthIcons.jsx";
import { login, guestLogin, appleLogin } from "../api/authApi.js";
import { finalizeAuthSession } from "../utils/authSession.js";
import { AUTH_PAGE_BG_GLASS } from "../utils/pageBg.js";
import { getSavedEmail } from "../../../shared/utils/tokenUtils.js";
import { DOCS_URL } from "../../../shared/constants/links.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import {
    Box, Button, TextField, Typography,
    Stack, Alert, Divider, Link,
    FormControlLabel, Checkbox, Snackbar, InputAdornment, IconButton,
} from "@mui/material";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";

// ── 상수 ───────────────────────────────────────────────────────────
const BLUE       = "#1976d2";
const BLUE_DARK  = "#1565c0";
const BLUE_LIGHT = "#EFF6FF";

// 페이지 배경 — 아주 옅은 블루 그라디언트. 예전엔 glass 카드 밑에 깔리는 레이어였고,
// 지금은 오른쪽 비주얼 패널 전체를 채운다. 데스크톱 RegisterPage와 공유(auth/utils/pageBg.js).
const PAGE_BG = AUTH_PAGE_BG_GLASS;

// 목업(BoardMockup)은 앱 공용 CSS 토큰 var(--plando-shadow-*)로 그림자를 그리는데,
// 그 토큰은 document.documentElement[data-theme]를 따른다. 로그인 화면은 lightTheme로
// 고정이라, 직전 세션이 다크 테마였으면 MUI는 라이트인데 그림자만 다크가 되는 불일치가 난다.
// 오른쪽 패널 스코프에서만 라이트 값으로 되돌린다(전역 data-theme은 건드리지 않는다).


// ── 라우터 wrapper — 모바일/데스크톱 분기 ─────────────────────────
export default function LoginPage() {
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
    const location = useLocation();
    // OAuth 콜백 실패 / 세션 만료(ProtectedRoute) 시 navigate state로 전달되는 에러 메시지
    const oauthError = location.state?.oauthError || location.state?.authError || "";
    const [oauthErrorOpen, setOauthErrorOpen] = useState(!!oauthError);

    if (isMobile) {
        // LoginPageMobile은 자체 에러 상태를 갖고 있어 외부 메시지를 못 받으므로
        // wrapper에서 Snackbar로 표시
        return (
            <>
                <LoginPageMobile />
                <Snackbar
                    open={oauthErrorOpen}
                    autoHideDuration={6000}
                    onClose={() => setOauthErrorOpen(false)}
                    anchorOrigin={{ vertical: "top", horizontal: "center" }}
                >
                    <Alert severity="error" onClose={() => setOauthErrorOpen(false)} sx={{ borderRadius: 2 }}>
                        {oauthError}
                    </Alert>
                </Snackbar>
            </>
        );
    }
    return <LoginPageDesktop />;
}

// ── 데스크톱 — 전체 화면 2분할(왼쪽 폼 / 오른쪽 비주얼) ──────────────
// 로직·핸들러는 예전 glass 카드 시절 그대로다. 바뀐 건 배치뿐.
function LoginPageDesktop() {
    const lightTheme = useMemo(() => buildTheme("light"), []);
    const location = useLocation();
    const savedEmail = getSavedEmail();
    const [email, setEmail] = useState(savedEmail);
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(!!savedEmail);
    const [showPassword, setShowPassword] = useState(false);
    // OAuth 콜백 실패 / 세션 만료 메시지(navigate state)가 있으면 기존 에러 Alert에 표시
    const [errorMessage, setErrorMessage] = useState(location.state?.oauthError || location.state?.authError || "");
    const [loading, setLoading] = useState(false);
    const [guestLoading, setGuestLoading] = useState(false);

    const [privacyOpen, setPrivacyOpen] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);
    const navigate = useNavigate();
    const { loadWorkspaces } = useWorkspace();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        try {
            setLoading(true);
            const response = await login({ email, password });
            const pendingCode = sessionStorage.getItem("pendingInviteCode");
            if (pendingCode) sessionStorage.removeItem("pendingInviteCode");

            const defaultRoute = await finalizeAuthSession({
                accessToken: response.accessToken,
                rememberMe,
                user: { name: response.name, email: response.email, id: response.id },
                saveLoginEmail: email,
                inviteCode: pendingCode,
                loadWorkspaces,
            });
            navigate(defaultRoute);
        } catch (err) {
            setErrorMessage(
                err?.response?.data?.message ||
                "이메일 또는 비밀번호를 다시 확인해주세요."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        setErrorMessage("");
        try {
            setAppleLoading(true);
            const result = await SignInWithApple.authorize({
                clientId: "com.imjaewoo.plando",
                redirectURI: "https://plando.imjaewoo.dev",
                scopes: "email name",
            });
            const { identityToken, givenName, familyName } = result.response;
            const response = await appleLogin(identityToken, givenName, familyName);

            await finalizeAuthSession({
                accessToken: response.accessToken,
                rememberMe: false,
                user: { name: response.name, email: response.email, id: response.id },
                isNew: response.isNew,
                autoCreateWorkspace: true,
                loadWorkspaces,
            });
            navigate("/dashboard");
        } catch (err) {
            if (err?.message !== "The operation couldn't be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)") {
                setErrorMessage("Apple 로그인에 실패했습니다.");
            }
        } finally {
            setAppleLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setErrorMessage("");
        try {
            setGuestLoading(true);
            const response = await guestLogin();
            await finalizeAuthSession({
                accessToken: response.accessToken,
                rememberMe: false,
                user: { name: response.name, email: response.email, id: response.id },
                loadWorkspaces,
            });
            navigate("/dashboard");
        } catch (err) {
            setErrorMessage(err?.response?.data?.message || "게스트 로그인에 실패했습니다.");
        } finally {
            setGuestLoading(false);
        }
    };

    return (
        <ThemeProvider theme={lightTheme}>
        {/* 화면을 꽉 채우는 2분할 — 왼쪽 폼 / 오른쪽 비주얼.
            창을 넓혀도 예전처럼 940px 카드가 여백 속에 떠 있지 않고 끝까지 붙는다.
            높이를 100dvh로 잡고 스크롤은 왼쪽 컬럼 안에서만 일어나게 해서,
            화면이 짧아도 오른쪽 그라디언트가 잘리거나 따라 밀리지 않는다. */}
        <Box
            sx={{
                height: "100dvh",
                overflow: "hidden",
                display: "grid",
                // minmax(0, …) — 컬럼이 내용 최소폭에 밀려 화면 밖으로 넘치는 걸 막는다
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1.2fr)" },
                bgcolor: "#ffffff",
            }}
        >
            {/* ── 왼쪽 폼 패널 (md 미만에서는 이게 화면 전체) ── */}
            <Box
                sx={{
                    display: "flex",
                    overflowY: "auto",
                    bgcolor: "#ffffff",
                    px: { xs: 3, sm: 5, md: 4, lg: 6 },
                    pt: "calc(40px + env(safe-area-inset-top))",
                    pb: "calc(40px + env(safe-area-inset-bottom))",
                }}
            >
                {/* 세로 가운데 정렬을 justifyContent 대신 margin auto로 — 내용이 뷰포트보다
                    길어졌을 때 위쪽이 잘려 스크롤로 못 가는 flex 중앙정렬 문제를 피한다. */}
                <Box sx={{ width: "100%", maxWidth: 400, m: "auto" }}>
                    <Box sx={{ mb: 4 }}>
                        <BrandMark size={34} />
                    </Box>

                    <Typography
                        sx={{ fontWeight: 800, fontSize: 24, letterSpacing: -0.4, mb: 0.75, color: "rgba(0,0,0,0.88)" }}
                    >
                        로그인
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.50)", mb: 3 }}>
                        이메일과 비밀번호를 입력해주세요
                    </Typography>

                    {errorMessage && (
                        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                            {errorMessage}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit} noValidate>
                        <Stack spacing={2}>
                            <Box>
                                <FieldLabel htmlFor="login-email">이메일</FieldLabel>
                                <TextField
                                    fullWidth
                                    id="login-email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    required
                                    sx={fieldSx}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <MailOutlineRoundedIcon sx={{ fontSize: 19 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Box>
                            <Box>
                                <FieldLabel htmlFor="login-password">비밀번호</FieldLabel>
                                <TextField
                                    fullWidth
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="비밀번호를 입력하세요"
                                    autoComplete="current-password"
                                    required
                                    sx={fieldSx}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockOutlinedIcon sx={{ fontSize: 19 }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                {/* 오타로 로그인이 막히는 일이 잦아 눈으로 확인할 길을 준다 */}
                                                <IconButton
                                                    onClick={() => setShowPassword((v) => !v)}
                                                    edge="end"
                                                    size="small"
                                                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                                                    sx={{ color: "#9AA7B8" }}
                                                >
                                                    {showPassword
                                                        ? <VisibilityOffOutlinedIcon sx={{ fontSize: 19 }} />
                                                        : <VisibilityOutlinedIcon sx={{ fontSize: 19 }} />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Box>
                        </Stack>

                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1, mb: 2.5 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.55)" }}>
                                        로그인 상태 유지
                                    </Typography>
                                }
                                sx={{ m: 0 }}
                            />
                            <Link
                                component={RouterLink}
                                to="/forgot-password"
                                underline="hover"
                                // 0.45 는 흰 배경에서 거의 안 읽힌다 — 링크인 줄 모르고 지나친다
                                sx={{ fontSize: "0.82rem", color: "rgba(0,0,0,0.62)", fontWeight: 600 }}
                            >
                                비밀번호 찾기
                            </Link>
                        </Box>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{
                                height: 48,
                                borderRadius: 2.5,
                                fontWeight: 700,
                                fontSize: 15,
                                bgcolor: BLUE,
                                "&:hover": { bgcolor: BLUE_DARK },
                            }}
                        >
                            {loading ? "로그인 중..." : "로그인"}
                        </Button>
                    </Box>

                    <Divider sx={{ my: 2.5, borderColor: "rgba(0,0,0,0.10)" }}>
                        <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.38)", px: 0.5 }}>
                            또는
                        </Typography>
                    </Divider>

                    {isNative && isIOS && <Button
                        fullWidth
                        variant="contained"
                        onClick={handleAppleLogin}
                        disabled={appleLoading}
                        sx={{
                            height: 48,
                            borderRadius: 2.5,
                            fontWeight: 700,
                            fontSize: 15,
                            bgcolor: "#000000",
                            color: "#ffffff",
                            mb: 1.5,
                            boxShadow: "none",
                            "&:hover": { bgcolor: "#1a1a1a", boxShadow: "none" },
                        }}
                    >
                        {appleLoading ? "로그인 중..." : (
                            <>
                                <AppleIcon size={20} color="#ffffff" />
                                <Box component="span" sx={{ ml: 1 }}>Apple로 로그인</Box>
                            </>
                        )}
                    </Button>}

                    <Button
                        fullWidth
                        variant="contained"
                        onClick={async () => {
                            const base = `${import.meta.env.VITE_API_BASE_URL ?? ""}/oauth2/authorization/kakao`;
                            if (isNative) {
                                await Browser.open({ url: `${base}?platform=app` });
                            } else {
                                window.location.href = base;
                            }
                        }}
                        startIcon={<KakaoIcon size={20} />}
                        sx={{
                            height: 48,
                            borderRadius: 2.5,
                            fontWeight: 700,
                            fontSize: 15,
                            bgcolor: "#FEE500",
                            color: "#000000",
                            boxShadow: "none",
                            "&:hover": { bgcolor: "#e6cf00", boxShadow: "none" },
                        }}
                    >
                        카카오로 로그인
                    </Button>

                    {/* 구글 — 카카오와 같은 서버 왕복(Spring OAuth2)을 쓴다.
                        앱에도 있는 방식이라 웹/앱이 같은 계정으로 이어진다. */}
                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={async () => {
                            const base = `${import.meta.env.VITE_API_BASE_URL ?? ""}/oauth2/authorization/google`;
                            if (isNative) {
                                await Browser.open({ url: `${base}?platform=app` });
                            } else {
                                window.location.href = base;
                            }
                        }}
                        startIcon={<GoogleIcon size={20} />}
                        sx={{
                            mt: 1.5,
                            height: 48,
                            borderRadius: 2.5,
                            fontWeight: 700,
                            fontSize: 15,
                            bgcolor: "#ffffff",
                            color: "#1f1f1f",
                            borderColor: "rgba(0,0,0,0.16)",
                            boxShadow: "none",
                            "&:hover": { bgcolor: "#f7f8fa", borderColor: "rgba(0,0,0,0.28)", boxShadow: "none" },
                        }}
                    >
                        Google로 로그인
                    </Button>

                    {/* 둘러보기는 점선 버튼이었다. 버튼 세 개(로그인·카카오·구글) 아래에
                        네 번째 버튼이 붙으니 무게가 같아 보여 무엇이 주된 길인지 흐려졌다.
                        밑줄 텍스트 링크로 낮추고, 사용 안내서를 옆에 나란히 둔다 —
                        "가입 없이 볼 수 있는 두 가지"라 같은 층에 두는 게 맞다. */}
                    <Stack
                        direction="row"
                        justifyContent="center"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ mt: 3 }}
                    >
                        <Box
                            component="button"
                            type="button"
                            disabled={guestLoading}
                            onClick={handleGuestLogin}
                            sx={{
                                border: 0,
                                background: "none",
                                p: 0,
                                font: "inherit",
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: "rgba(0,0,0,0.62)",
                                textDecoration: "underline",
                                textUnderlineOffset: "3px",
                                cursor: "pointer",
                                "&:hover": { color: "rgba(0,0,0,0.85)" },
                                "&:disabled": { cursor: "default", opacity: 0.5 },
                            }}
                        >
                            {guestLoading ? "로딩 중..." : "로그인 없이 둘러보기"}
                        </Box>

                        <Box sx={{ width: "1px", height: 12, bgcolor: "rgba(0,0,0,0.18)" }} />

                        <Link
                            href={DOCS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: "rgba(0,0,0,0.62)",
                                textDecoration: "underline",
                                textUnderlineOffset: "3px",
                                "&:hover": { color: "rgba(0,0,0,0.85)" },
                            }}
                        >
                            사용 안내서
                        </Link>
                    </Stack>

                    <Stack direction="row" justifyContent="center" spacing={0.5} sx={{ mt: 3 }}>
                        <Typography variant="body2" sx={{ fontSize: 13.5, color: "rgba(0,0,0,0.45)" }}>
                            아직 계정이 없나요?
                        </Typography>
                        <Link
                            component={RouterLink}
                            to="/register"
                            underline="hover"
                            sx={{ fontWeight: 700, fontSize: 13.5, color: BLUE }}
                        >
                            회원가입
                        </Link>
                    </Stack>

                    <Typography
                        variant="caption"
                        sx={{ display: "block", textAlign: "center", mt: 1, color: "rgba(0,0,0,0.38)", lineHeight: 1.7 }}
                    >
                        가입 시{" "}
                        <Box
                            component="span"
                            onClick={() => setPrivacyOpen(true)}
                            sx={{ color: BLUE, fontWeight: 600, cursor: "pointer" }}
                        >
                            개인정보처리방침
                        </Box>
                        에 동의하게 됩니다
                    </Typography>
                </Box>
            </Box>

            <AuthVisualPanel />
        </Box>

        <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
        </ThemeProvider>
    );
}
