import React, { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Checkbox,
    FormControlLabel,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { Browser } from "@capacitor/browser";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import Diversity3RoundedIcon from "@mui/icons-material/Diversity3Rounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

import { buildTheme } from "../../../shared/ui/theme.js";
import { isNative, isIOS } from "../../../shared/utils/platformUtils.js";
import { getSavedEmail } from "../../../shared/utils/tokenUtils.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { login, guestLogin, appleLogin } from "../api/authApi.js";
import { finalizeAuthSession } from "../utils/authSession.js";
import { AUTH_PAGE_BG_MODERN } from "../utils/pageBg.js";
import PrivacyPolicyModal from "../../../shared/ui/common/PrivacyPolicyModal.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { inputSxWhite } from "../../../shared/ui/inputSx.js";
import BrandMark from "../components/BrandMark.jsx";
import { AppleIcon, GoogleIcon, KakaoIcon } from "../components/AuthIcons.jsx";

/* ── 페이지 배경 — auth/utils/pageBg.js에서 import ─────────── */
const PAGE_BG = AUTH_PAGE_BG_MODERN;

/* ── 가치 제안 — method step 하단 ────────────────────────────── */
const FEATURES = [
    {
        icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} />,
        title: "협업",
        desc: "함께 작업을 공유하고 진행 상황을 파악해요",
    },
    {
        icon: <Diversity3RoundedIcon sx={{ fontSize: 18 }} />,
        title: "팀 모집",
        desc: "새 프로젝트의 동료를 찾고 바로 합류해요",
    },
    {
        icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />,
        title: "AI 어시스턴트",
        desc: "자연어로 일정을 만들고 빠르게 처리해요",
    },
];

/* ── 모바일 로그인 페이지 ────────────────────────────────────────
   step="method"  → 카카오 / Apple / 이메일로 로그인 + 회원가입·둘러보기 푸터
   step="email"   → 이메일 + 비밀번호 폼
*/
export default function LoginPageMobile() {
    const lightTheme = useMemo(() => buildTheme("light"), []);
    const navigate = useNavigate();
    const { loadWorkspaces } = useWorkspace();

    const [step, setStep] = useState("method");
    const savedEmail = getSavedEmail();
    const [email, setEmail] = useState(savedEmail);
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(!!savedEmail);
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [guestLoading, setGuestLoading] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);
    const [privacyOpen, setPrivacyOpen] = useState(false);

    /* ── 핸들러 ─────────────────────────────────────────────── */
    const handleEmailLogin = async (e) => {
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
                err?.response?.data?.message || "이메일 또는 비밀번호를 다시 확인해주세요."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleKakaoLogin = () => startSocialLogin("kakao");
    const handleGoogleLogin = () => startSocialLogin("google");

    /** 카카오·구글 모두 백엔드의 Spring OAuth2 왕복을 쓴다 — 흐름이 같아 한 함수로 묶는다. */
    const startSocialLogin = async (provider) => {
        const base = `${import.meta.env.VITE_API_BASE_URL ?? ""}/oauth2/authorization/${provider}`;
        if (isNative) {
            await Browser.open({ url: `${base}?platform=app` });
        } else {
            window.location.href = base;
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

    /* ── 공통 input sx — shared inputSxWhite 사용 ──────── */
    const inputSx = inputSxWhite();

    /* ── 페이지 wrapper ────────────────────────────────────── */
    return (
        <ThemeProvider theme={lightTheme}>
            <Box
                sx={{
                    minHeight: "100dvh",
                    background: PAGE_BG,
                    display: "flex",
                    flexDirection: "column",
                    pt: "calc(env(safe-area-inset-top) + 24px)",
                    pb: "calc(env(safe-area-inset-bottom) + 16px)",
                    px: 2,
                }}
            >
                {/* method(hero): 카드 없이 그라데이션 직접 / email: 흰 카드 wrapper */}
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        ...(step === "email"
                            ? {
                                bgcolor: "#fff",
                                borderRadius: "22px",
                                p: 2.75,
                                boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                            }
                            : {
                                px: 1,
                                py: 1.5,
                            }),
                    }}
                >
                    {/* 헤더 — method: 큰 BrandMark / email: 뒤로 + 타이틀 */}
                    {step === "method" ? (
                        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                            <BrandMark size="large" />
                        </Box>
                    ) : (
                        <>
                            <Box sx={{ mb: 1.75 }}>
                                <Press
                                    onClick={() => { setStep("method"); setErrorMessage(""); }}
                                    haptic="light"
                                    pressScale={0.92}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 999,
                                        background: "#F1F5F9",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#0F172A",
                                        border: "none",
                                    }}
                                    aria-label="뒤로"
                                >
                                    <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
                                </Press>
                            </Box>
                            <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", mb: 0.5, color: "#0F172A" }}>
                                로그인
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: "#64748B", mb: 2.75, lineHeight: 1.5 }}>
                                이메일과 비밀번호를 입력해주세요
                            </Typography>
                        </>
                    )}

                    {errorMessage && (
                        <Alert severity="error" sx={{ mb: 1.75, borderRadius: 2 }}>
                            {errorMessage}
                        </Alert>
                    )}

                    {/* method step: 버튼 그룹 세로 중앙 정렬 / email step: 상단부터 자연스럽게 */}
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: step === "method" ? "center" : "flex-start",
                            minHeight: 0,
                        }}
                    >

                    {step === "method" ? (
                        /* ── Step 1: 가입 방법 선택 ── */
                        /* App Store Review 4.8: Apple Sign In은 third-party 로그인보다 위 또는 동등 위치 */
                        <Stack spacing={1.25}>
                            {isNative && isIOS && (
                                <Press
                                    onClick={handleAppleLogin}
                                    disabled={appleLoading}
                                    haptic="medium"
                                    pressScale={0.97}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        width: "100%",
                                        height: 50,
                                        borderRadius: 14,
                                        background: "#000",
                                        color: "#fff",
                                        fontSize: 14.5,
                                        fontWeight: 700,
                                        letterSpacing: "-0.01em",
                                        border: "none",
                                    }}
                                >
                                    <AppleIcon size={18} color="#fff" />
                                    {appleLoading ? "로그인 중..." : "Apple로 로그인"}
                                </Press>
                            )}

                            <Press
                                onClick={handleKakaoLogin}
                                haptic="medium"
                                pressScale={0.97}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    width: "100%",
                                    height: 50,
                                    borderRadius: 14,
                                    background: "#FEE500",
                                    color: "#181600",
                                    fontSize: 14.5,
                                    fontWeight: 700,
                                    letterSpacing: "-0.01em",
                                    border: "none",
                                }}
                            >
                                <KakaoIcon size={18} />
                                카카오로 로그인
                            </Press>

                            <Press
                                onClick={handleGoogleLogin}
                                haptic="medium"
                                pressScale={0.97}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    width: "100%",
                                    height: 50,
                                    borderRadius: 14,
                                    background: "#FFFFFF",
                                    color: "#1F1F1F",
                                    fontSize: 14.5,
                                    fontWeight: 700,
                                    letterSpacing: "-0.01em",
                                    border: "1px solid rgba(0,0,0,0.14)",
                                }}
                            >
                                <GoogleIcon size={18} />
                                Google로 로그인
                            </Press>

                            {/* divider */}
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    my: 0.5,
                                    color: "text.disabled",
                                    fontSize: 11,
                                    fontWeight: 500,
                                    "&::before, &::after": {
                                        content: '""',
                                        flex: 1,
                                        height: "1px",
                                        background: "#E2E8F0",
                                    },
                                }}
                            >
                                <Typography sx={{ fontSize: 11, color: "text.disabled" }}>또는</Typography>
                            </Box>

                            <Press
                                onClick={() => setStep("email")}
                                haptic="light"
                                pressScale={0.97}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    width: "100%",
                                    height: 50,
                                    borderRadius: 14,
                                    background: "#fff",
                                    color: "#0F172A",
                                    fontSize: 14.5,
                                    fontWeight: 700,
                                    letterSpacing: "-0.01em",
                                    border: "1.5px solid #E2E8F0",
                                }}
                            >
                                <EmailRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                                이메일로 로그인
                            </Press>
                        </Stack>
                    ) : (
                        /* ── Step 2: 이메일 로그인 폼 ── */
                        <Box component="form" onSubmit={handleEmailLogin} noValidate>
                            <Stack spacing={1.5}>
                                <TextField
                                    fullWidth
                                    label="이메일"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email"
                                    required
                                    autoFocus
                                    sx={inputSx}
                                />
                                <TextField
                                    fullWidth
                                    label="비밀번호"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    sx={inputSx}
                                />
                            </Stack>

                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ mt: 1, mb: 2.25 }}
                            >
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            size="small"
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                                            로그인 상태 유지
                                        </Typography>
                                    }
                                    sx={{ m: 0 }}
                                />
                                <Box
                                    component={RouterLink}
                                    to="/forgot-password"
                                    sx={{
                                        fontSize: 12.5,
                                        color: "text.secondary",
                                        fontWeight: 600,
                                        textDecoration: "none",
                                        "&:hover": { textDecoration: "underline" },
                                    }}
                                >
                                    비밀번호 찾기
                                </Box>
                            </Stack>

                            <Press
                                as="button"
                                type="submit"
                                disabled={loading || !email || !password}
                                haptic="medium"
                                pressScale={0.97}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "100%",
                                    height: 50,
                                    borderRadius: 14,
                                    background: "#1B6FF5",
                                    color: "#fff",
                                    fontSize: 14.5,
                                    fontWeight: 800,
                                    letterSpacing: "-0.01em",
                                    border: "none",
                                    boxShadow: "0 4px 12px rgba(27,111,245,0.25)",
                                }}
                            >
                                {loading ? "로그인 중..." : "로그인"}
                            </Press>
                        </Box>
                    )}

                    </Box>

                    {/* ── 하단 영역 ── */}
                    <Box sx={{ pt: 3 }}>
                        {/* method step: 아이콘 + 제목 + 설명 한 줄씩 — 중앙 블록 */}
                        {step === "method" && (
                            <Stack
                                spacing={1.5}
                                sx={{
                                    mb: 2.5,
                                    mx: "auto",
                                    width: "100%",
                                    maxWidth: 260,
                                }}
                            >
                                {FEATURES.map((f) => (
                                    <Stack
                                        key={f.title}
                                        direction="row"
                                        alignItems="flex-start"
                                        spacing={1.5}
                                    >
                                        <Box
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 1.5,
                                                background: "rgba(27,111,245,0.10)",
                                                color: "#1B6FF5",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                                mt: "1px",
                                            }}
                                        >
                                            {f.icon}
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", mb: 0.25 }}>
                                                {f.title}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                                                {f.desc}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                ))}
                            </Stack>
                        )}

                        {/* 푸터 — 회원가입 / 둘러보기 */}
                        <Stack
                            direction="row"
                            justifyContent="center"
                            alignItems="center"
                            spacing={1.5}
                            sx={{
                                pt: 2,
                                borderTop: 1,
                                borderColor: "divider",
                            }}
                        >
                            <Box
                                component={RouterLink}
                                to="/register"
                                sx={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "#1B6FF5",
                                    textDecoration: "none",
                                }}
                            >
                                회원가입
                            </Box>
                            <Typography sx={{ color: "#94A3B8", fontSize: 12 }}>·</Typography>
                            <Box
                                component="button"
                                onClick={handleGuestLogin}
                                disabled={guestLoading}
                                sx={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "#64748B",
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    p: 0,
                                }}
                            >
                                {guestLoading ? "로딩 중..." : "둘러보기"}
                            </Box>
                        </Stack>

                    <Typography
                        sx={{
                            display: "block",
                            textAlign: "center",
                            mt: 1.25,
                            fontSize: 11,
                            color: "text.disabled",
                            lineHeight: 1.5,
                        }}
                    >
                        서비스 이용 시{" "}
                        <Box
                            component="span"
                            onClick={() => setPrivacyOpen(true)}
                            sx={{
                                color: "text.secondary",
                                fontWeight: 600,
                                cursor: "pointer",
                                textDecoration: "underline",
                            }}
                        >
                            개인정보처리방침
                        </Box>
                        에 동의하게 됩니다.
                    </Typography>
                    </Box>
                </Box>
            </Box>

            <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
        </ThemeProvider>
    );
}
