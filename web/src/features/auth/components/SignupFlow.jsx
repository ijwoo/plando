import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Alert, Box, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { Browser } from "@capacitor/browser";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import MarkEmailUnreadRoundedIcon from "@mui/icons-material/MarkEmailUnreadRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import WorkspacesOutlinedIcon from "@mui/icons-material/WorkspacesOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";

import Press from "../../../shared/ui/primitives/Press.jsx";
import PrivacyPolicyModal from "../../../shared/ui/common/PrivacyPolicyModal.jsx";
import { fieldSx, FieldLabel } from "../../../shared/ui/common/fieldStyles.jsx";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { EMAIL_REGEX } from "../../../shared/utils/validators.js";
import { isNative, isIOS } from "../../../shared/utils/platformUtils.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { appleLogin, resendVerificationEmail, signup } from "../api/authApi.js";
import { finalizeAuthSession } from "../utils/authSession.js";
import KakaoLoginDialog from "./KakaoLoginDialog.jsx";
import { AppleIcon, GoogleIcon, KakaoIcon } from "./AuthIcons.jsx";

// motion.div를 alias 변수로 잡아서 JSX 사용 시 ESLint no-unused-vars 우회
const MotionBox = motion.div;

/* ── 회원가입 단계 — 앱(mobile/src/app/(auth)/signup.tsx)의 3단계 + 웹 전용 메일 인증 안내 ──
   method   : 가입 방법 선택 (Apple / 카카오 / Google / 이메일)
   account  : 이름·이메일·비밀번호
   workspace: 워크스페이스 만들기 / 초대코드 / 나중에 → 가입 제출
   verify   : 가입 직후 "메일을 확인해주세요" 안내 (인증 없이도 앱 진입 가능) */
const STEPS = ["method", "account", "workspace", "verify"];

/* ── 버튼 톤 — 데스크톱은 LoginPage, 모바일은 LoginPageMobile 값을 그대로 쓴다 ─── */
const TONES = {
    primary: {
        bg: "#1976d2", bgDense: "#1B6FF5", color: "#fff", border: "none", weight: 800,
        shadowDense: "0 4px 12px rgba(27,111,245,0.25)",
    },
    dark:    { bg: "#000000", color: "#fff", border: "none", weight: 700 },
    kakao:   { bg: "#FEE500", color: "#181600", border: "none", weight: 700 },
    google:  { bg: "#FFFFFF", color: "#1F1F1F", border: "1px solid rgba(0,0,0,0.14)", weight: 700 },
    outline: { bg: "#FFFFFF", color: "#0F172A", border: "1.5px solid #E2E8F0", weight: 700 },
};

/**
 * auth 액션 버튼 — 소셜/CTA를 한 곳에서 렌더한다.
 * dense=true(모바일 웹·앱 톤): h50 / radius 14 / #1B6FF5
 * dense=false(데스크톱 로그인 톤): h48 / radius 20(=sx 2.5) / #1976d2
 */
function AuthActionButton({ dense, tone = "primary", icon, label, onClick, disabled }) {
    const t = TONES[tone];
    return (
        <Press
            as="button"
            onClick={onClick}
            disabled={disabled}
            haptic={tone === "outline" ? "light" : "medium"}
            pressScale={0.97}
            // 데스크톱에는 hover 피드백이 필요하다 (Press 자체는 tap만 다룬다)
            whileHover={disabled ? undefined : { filter: "brightness(0.96)" }}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                height: dense ? 50 : 48,
                borderRadius: dense ? 14 : 20,
                background: (dense && t.bgDense) || t.bg,
                color: t.color,
                border: t.border,
                fontSize: dense ? 14.5 : 15,
                fontWeight: t.weight,
                letterSpacing: "-0.01em",
                boxShadow: dense ? (t.shadowDense ?? "none") : "none",
            }}
        >
            {icon}
            {label}
        </Press>
    );
}

/* ── 진행 표시 — n/4. 페이지 배경과 대비되도록 inactive를 진한 슬레이트로 ── */
function StepProgress({ current, dense }) {
    return (
        <Stack direction="row" spacing={0.75} sx={{ mb: dense ? 2.5 : 3 }}>
            {STEPS.map((s, i) => (
                <Box
                    key={s}
                    sx={{
                        flex: 1,
                        height: 4,
                        borderRadius: 999,
                        background: i < current ? "#1B6FF5" : "#CBD5E1",
                        transition: "background 0.3s",
                    }}
                />
            ))}
        </Stack>
    );
}

/* ── 입력 필드 장식 ────────────────────────────────────────────
   로그인 화면과 같은 문법: 라벨은 필드 위(FieldLabel), 무엇을 넣는 칸인지는
   왼쪽 아이콘이 한 번 더 말해준다. 두 화면이 한 제품으로 읽히게 하는 게 목적이다. */
function StartIcon({ icon: Icon }) {
    return (
        <InputAdornment position="start">
            <Icon sx={{ fontSize: 19 }} />
        </InputAdornment>
    );
}

/* 비밀번호 표시 토글 — 오타 때문에 "비밀번호가 일치하지 않습니다"에 갇히는 일이 잦다.
   눈으로 확인할 길을 준다(로그인 화면과 동일한 아이콘·크기). */
function PasswordToggle({ shown, onToggle }) {
    return (
        <InputAdornment position="end">
            <IconButton
                onClick={onToggle}
                edge="end"
                size="small"
                aria-label={shown ? "비밀번호 숨기기" : "비밀번호 표시"}
                sx={{ color: "text.disabled" }}
            >
                {shown
                    ? <VisibilityOffOutlinedIcon sx={{ fontSize: 19 }} />
                    : <VisibilityOutlinedIcon sx={{ fontSize: 19 }} />}
            </IconButton>
        </InputAdornment>
    );
}

/* ── 워크스페이스 옵션 카드 (workspace step) ─────────────────── */
function WorkspaceOption({ active, icon, title, desc, onClick, accent }) {
    return (
        <Press
            onClick={onClick}
            haptic="light"
            pressScale={0.99}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                padding: "16px",
                borderRadius: 16,
                background: active
                    ? "linear-gradient(135deg, rgba(27,111,245,.05), rgba(124,58,237,.05))"
                    : "#fff",
                border: active ? "1.5px solid #1B6FF5" : "1.5px solid #E2E8F0",
                textAlign: "left",
            }}
        >
            <Box
                sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "11px",
                    background: accent
                        ? "linear-gradient(135deg, #1B6FF5, #7C3AED)"
                        : "#F1F5F9",
                    color: accent ? "#fff" : "text.secondary",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.25 }}>
                    {title}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary", lineHeight: 1.4 }}>
                    {desc}
                </Typography>
            </Box>
        </Press>
    );
}

/**
 * 회원가입 흐름 본체 — 상태·검증·제출을 모두 들고, 단계 UI까지 렌더한다.
 * 껍데기(배경/카드/브랜딩 패널)만 RegisterPage(데스크톱)·RegisterPageMobile이 각각 씌운다.
 *
 * @param {boolean} [dense=false] 모바일 웹 톤(앱과 동일한 h50/radius14/#1B6FF5)
 */
export default function SignupFlow({ dense = false }) {
    const navigate = useNavigate();
    const { loadWorkspaces } = useWorkspace();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlStep = searchParams.get("step");
    const urlInviteCode = searchParams.get("inviteCode") || "";

    // 가입 완료(= 세션 오픈) 상태. { email, route } — 있으면 URL과 무관하게 verify 단계를 보여준다
    // (계정이 이미 만들어졌으므로 이전 단계로 돌아갈 수 없다).
    const [done, setDone] = useState(null);
    const step = done ? "verify" : (urlStep === "account" || urlStep === "workspace") ? urlStep : "method";

    /* 단계는 URL에 남긴다 — 브라우저 뒤로가기/하드웨어 백이 그대로 동작한다 */
    const setStep = (next) => {
        const nextParams = new URLSearchParams(searchParams);
        if (next === "method") nextParams.delete("step");
        else nextParams.set("step", next);
        setSearchParams(nextParams, { replace: false });
    };

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        joinMode: urlInviteCode ? "invite" : "create",
        workspaceName: "",
        inviteCode: urlInviteCode,
    });

    const [touched, setTouched] = useState({});
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [kakaoDialogOpen, setKakaoDialogOpen] = useState(false);
    const [privacyOpen, setPrivacyOpen] = useState(false);
    // 비밀번호 표시 여부는 두 칸을 따로 둔다 — 한쪽만 확인하고 싶은 경우가 대부분이다
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);
    const [resending, setResending] = useState(false);
    // 재발송 결과는 페이지 안에서 보여준다 (가입 직후엔 토스트 리스너가 아직 없다)
    const [resendResult, setResendResult] = useState(null);

    /* ── 소셜 가입 ─────────────────────────────────────────────
       Apple은 첫 로그인 시 자동 가입이라 로그인과 동일 흐름을 재사용한다.
       카카오·Google은 백엔드 Spring OAuth2 왕복 — 로그인 페이지와 같은 방식·같은 순서. */
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

    const handleGoogleSignup = async () => {
        const base = `${import.meta.env.VITE_API_BASE_URL ?? ""}/oauth2/authorization/google`;
        if (isNative) {
            await Browser.open({ url: `${base}?platform=app` });
        } else {
            window.location.href = base;
        }
    };

    /* ── account step — 토스 스타일 progressive reveal ─────────
       처음엔 이름만 보이고, 입력 후 Enter/완료 키 또는 blur 시 다음 필드가 등장 + 자동 포커스 */
    const ACCOUNT_FIELDS = ["name", "email", "password", "confirmPassword"];
    const [unlockedIndex, setUnlockedIndex] = useState(0);
    const nameRef = useRef(null);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const confirmPasswordRef = useRef(null);
    const accountRefs = useMemo(
        () => [nameRef, emailRef, passwordRef, confirmPasswordRef],
        []
    );

    const isFieldValid = (field) => {
        switch (field) {
            case "name": {
                const v = form.name.trim();
                return v.length >= 1 && v.length <= 20;
            }
            case "email": return EMAIL_REGEX.test(form.email);
            case "password": return form.password.length >= 8;
            case "confirmPassword":
                return form.confirmPassword.length >= 8 && form.password === form.confirmPassword;
            default: return false;
        }
    };

    const advanceFromField = (idx) => {
        const field = ACCOUNT_FIELDS[idx];
        if (!isFieldValid(field)) return;
        if (idx >= ACCOUNT_FIELDS.length - 1) return; // 마지막 필드는 다음 버튼 활성화로 처리
        if (idx >= unlockedIndex) {
            setUnlockedIndex(idx + 1);
            // render 후 next input focus
            setTimeout(() => accountRefs[idx + 1].current?.focus(), 120);
        }
    };

    const handleAccountFieldBlur = (idx) => () => {
        setTouched((p) => ({ ...p, [ACCOUNT_FIELDS[idx]]: true }));
        advanceFromField(idx);
    };

    const handleAccountFieldKeyDown = (idx) => (e) => {
        if (e.key === "Enter") {
            // IME 조합 중 Enter 무시 — 한글 이름 조합 확정 Enter로 다음 단계가 넘어가는 문제 방지
            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            // 마지막 필드에서 모든 검증 통과 시 자동 다음 step
            if (idx === ACCOUNT_FIELDS.length - 1 && accountValid) {
                setStep("workspace");
                return;
            }
            advanceFromField(idx);
        }
    };

    const onChange = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };
    const onBlur = (key) => () => {
        setTouched((prev) => ({ ...prev, [key]: true }));
    };

    const getFieldError = (key) => {
        if (!touched[key]) return "";
        switch (key) {
            case "name":
                if (!form.name.trim()) return "이름을 입력해주세요.";
                if (form.name.trim().length > 20) return "이름은 20자 이하로 입력해주세요.";
                return "";
            case "email":
                if (!form.email.trim()) return "이메일을 입력해주세요.";
                if (!EMAIL_REGEX.test(form.email)) return "올바른 이메일 형식이 아닙니다.";
                return "";
            case "password":
                if (!form.password) return "비밀번호를 입력해주세요.";
                if (form.password.length < 8) return "비밀번호는 8자 이상 입력해주세요.";
                return "";
            case "confirmPassword":
                if (!form.confirmPassword) return "비밀번호 확인을 입력해주세요.";
                if (form.password !== form.confirmPassword) return "비밀번호가 일치하지 않습니다.";
                return "";
            case "workspaceName":
                if (form.joinMode === "create" && !form.workspaceName.trim()) return "워크스페이스 이름을 입력해주세요.";
                return "";
            case "inviteCode":
                if (form.joinMode === "invite" && !form.inviteCode.trim()) return "초대코드를 입력해주세요.";
                return "";
            default:
                return "";
        }
    };

    const accountValid =
        form.name.trim() &&
        form.email.trim() && EMAIL_REGEX.test(form.email) &&
        form.password.length >= 8 &&
        form.password === form.confirmPassword;

    const goAccountNext = () => {
        setTouched({ name: true, email: true, password: true, confirmPassword: true });
        if (!accountValid) return;
        setErrorMessage("");
        setStep("workspace");
    };

    /* ── workspace step → 가입 제출 ─────────────────────────────
       가입 응답에 accessToken이 오므로 바로 세션을 열고 verify 단계로 넘어간다.
       (인증 메일 재발송은 로그인 상태에서만 되고, 미인증이어도 앱 사용은 허용이다.) */
    const handleSubmit = async () => {
        setErrorMessage("");
        const mode = form.joinMode;

        if (mode === "create" && !form.workspaceName.trim()) {
            setTouched((p) => ({ ...p, workspaceName: true }));
            return setErrorMessage("워크스페이스 이름을 입력해주세요.");
        }
        if (mode === "invite" && !form.inviteCode.trim()) {
            setTouched((p) => ({ ...p, inviteCode: true }));
            return setErrorMessage("초대코드를 입력해주세요.");
        }

        try {
            setLoading(true);
            const email = form.email.trim();
            const payload = { name: form.name.trim(), email, password: form.password };
            if (mode === "create") {
                payload.workspaceName = form.workspaceName.trim();
            } else if (mode === "invite") {
                payload.inviteCode = form.inviteCode.trim();
            } else {
                // 나중에 → 자동 워크스페이스 생성 (`{이름}의 워크스페이스`)
                payload.workspaceName = `${form.name.trim()}의 워크스페이스`;
            }

            const res = await signup(payload);

            // 토큰이 없는 응답이면 세션을 열 수 없다 → 기존 동작(로그인 화면)으로 폴백
            if (!res?.accessToken) {
                navigate("/login", { state: { authError: "가입이 완료됐어요. 로그인해주세요." } });
                return;
            }

            // 초대코드는 서버가 가입 시 함께 처리한다 → finalize에 다시 넘기지 않는다(중복 참여 시도 방지)
            const route = await finalizeAuthSession({
                accessToken: res.accessToken,
                rememberMe: true,
                user: { name: res.name, email: res.email, id: res.id },
                saveLoginEmail: email,
                loadWorkspaces,
            });
            // 단계 쿼리를 지워 verify 화면의 URL을 깔끔하게 남긴다 (뒤로가도 계정은 이미 만들어진 상태)
            setSearchParams(new URLSearchParams(), { replace: true });
            setDone({ email: res.email || email, route });
        } catch (err) {
            setErrorMessage(getApiError(
                err,
                "회원가입에 실패했어요. 이미 사용 중인 이메일인지 확인해주세요.",
            ));
        } finally {
            setLoading(false);
        }
    };

    /* 인증 메일 재발송 — 서버가 3분 쿨다운을 처리하므로 200이어도 실제 발송은 생략될 수 있고,
       주소가 배달 불가면 502로 이유를 내려준다 → 그 메시지를 그대로 보여준다. */
    const handleResend = async () => {
        setResending(true);
        setResendResult(null);
        try {
            await resendVerificationEmail();
            setResendResult({
                severity: "success",
                text: "인증 메일을 다시 보냈어요. 메일함(스팸함도)을 확인해주세요.",
            });
        } catch (err) {
            setResendResult({
                severity: "error",
                text: getApiError(err, "인증 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요."),
            });
        } finally {
            setResending(false);
        }
    };

    const handleBack = () => {
        setErrorMessage("");
        if (step === "method") navigate("/login");
        else if (step === "account") setStep("method");
        else if (step === "workspace") setStep("account");
    };

    /* ── 공통 스타일 ─────────────────────────────────────────────
       입력 필드는 dense 여부와 무관하게 공용 fieldSx 하나로 간다. 예전엔 흰 배경만
       깔고 radius 만 달리 줬는데, 그러면 같은 회원가입 폼인데 웹/모바일이 다른 필드로
       보였다. 버튼 톤(dense)은 그대로 두고 필드만 통일한다. */
    const titleSx = {
        fontSize: dense ? 22 : 24,
        fontWeight: dense ? 800 : 900,
        letterSpacing: "-0.02em",
        mb: 0.5,
        color: "#0F172A",
    };
    const subtitleSx = { fontSize: 13, color: "#64748B", mb: dense ? 2.5 : 3, lineHeight: 1.5 };

    const stepIndex = STEPS.indexOf(step) + 1;

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                // 모바일은 카드 높이를 채워 푸터를 바닥에 붙인다
                ...(dense ? { flex: 1 } : null),
            }}
        >
            {/* 헤더 — back 버튼. verify는 계정이 이미 만들어진 뒤라 되돌릴 수 없다 */}
            {step !== "verify" && (
                <Box sx={{ mb: 1.75 }}>
                    <Press
                        onClick={handleBack}
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
            )}

            <StepProgress current={stepIndex} dense={dense} />

            {/* 단계별 제목 */}
            {step === "method" && (
                <>
                    <Typography sx={titleSx}>시작해볼까요?</Typography>
                    <Typography sx={subtitleSx}>가입 방법을 선택해주세요</Typography>
                </>
            )}
            {step === "account" && (
                <>
                    <Typography sx={titleSx}>계정 정보</Typography>
                    <Typography sx={subtitleSx}>이름, 이메일, 비밀번호를 입력해주세요</Typography>
                </>
            )}
            {step === "workspace" && (
                <>
                    <Typography sx={titleSx}>
                        환영해요{form.name.trim() ? `, ${form.name.trim()}님` : ""}!
                    </Typography>
                    <Typography sx={subtitleSx}>마지막으로 워크스페이스를 설정해볼까요?</Typography>
                </>
            )}

            {errorMessage && (
                <Alert severity="error" sx={{ mb: 1.75, borderRadius: 2 }}>
                    {errorMessage}
                </Alert>
            )}

            {/* ── Step 1: 가입 방법 ──
                App Store 4.8: Apple Sign In은 third-party 로그인보다 위 또는 동등 위치.
                Apple은 네이티브 iOS 전용(웹 브라우저에는 노출하지 않는다) — 로그인 페이지와 동일. */}
            {step === "method" && (
                <Stack spacing={1.25}>
                    {isNative && isIOS && (
                        <AuthActionButton
                            dense={dense}
                            tone="dark"
                            icon={<AppleIcon size={18} color="#fff" />}
                            label={appleLoading ? "처리 중..." : "Apple로 시작하기"}
                            onClick={handleAppleLogin}
                            disabled={appleLoading}
                        />
                    )}

                    <AuthActionButton
                        dense={dense}
                        tone="kakao"
                        icon={<KakaoIcon size={18} />}
                        label="카카오로 시작하기"
                        onClick={() => setKakaoDialogOpen(true)}
                    />

                    <AuthActionButton
                        dense={dense}
                        tone="google"
                        icon={<GoogleIcon size={18} />}
                        label="Google로 시작하기"
                        onClick={handleGoogleSignup}
                    />

                    {/* divider */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            my: 0.5,
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

                    <AuthActionButton
                        dense={dense}
                        tone="outline"
                        icon={<EmailRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />}
                        label="이메일로 가입하기"
                        onClick={() => setStep("account")}
                    />
                </Stack>
            )}

            {/* ── Step 2: 계정 정보 — progressive reveal ── */}
            {step === "account" && (
                <Stack spacing={1.5}>
                    {/* 이름 — 항상 노출 */}
                    <Box>
                        <FieldLabel htmlFor="signup-name">이름</FieldLabel>
                        <TextField
                            fullWidth
                            id="signup-name"
                            value={form.name}
                            onChange={onChange("name")}
                            onBlur={handleAccountFieldBlur(0)}
                            onKeyDown={handleAccountFieldKeyDown(0)}
                            error={!!getFieldError("name")}
                            helperText={getFieldError("name") || "표시될 이름이에요"}
                            inputRef={nameRef}
                            inputProps={{ enterKeyHint: "next" }}
                            placeholder="이름을 입력하세요"
                            required
                            autoFocus
                            sx={fieldSx}
                            InputProps={{ startAdornment: <StartIcon icon={PersonOutlineRoundedIcon} /> }}
                        />
                    </Box>

                    {/* 이메일 — 이름 입력 완료 시 등장 */}
                    {unlockedIndex >= 1 && (
                        <MotionBox
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            <FieldLabel htmlFor="signup-email">이메일</FieldLabel>
                            <TextField
                                fullWidth
                                id="signup-email"
                                type="email"
                                value={form.email}
                                onChange={onChange("email")}
                                onBlur={handleAccountFieldBlur(1)}
                                onKeyDown={handleAccountFieldKeyDown(1)}
                                error={!!getFieldError("email")}
                                helperText={getFieldError("email") || "가입 후 이 주소로 인증 메일을 보내드려요"}
                                inputRef={emailRef}
                                inputProps={{ enterKeyHint: "next" }}
                                placeholder="you@example.com"
                                required
                                sx={fieldSx}
                                InputProps={{ startAdornment: <StartIcon icon={MailOutlineRoundedIcon} /> }}
                            />
                        </MotionBox>
                    )}

                    {/* 비밀번호 */}
                    {unlockedIndex >= 2 && (
                        <MotionBox
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            <FieldLabel htmlFor="signup-password">비밀번호</FieldLabel>
                            <TextField
                                fullWidth
                                id="signup-password"
                                type={showPassword ? "text" : "password"}
                                value={form.password}
                                onChange={onChange("password")}
                                onBlur={handleAccountFieldBlur(2)}
                                onKeyDown={handleAccountFieldKeyDown(2)}
                                error={!!getFieldError("password")}
                                helperText={getFieldError("password") || "8자 이상 입력해주세요"}
                                inputRef={passwordRef}
                                inputProps={{ enterKeyHint: "next" }}
                                placeholder="8자 이상 입력하세요"
                                required
                                sx={fieldSx}
                                InputProps={{
                                    startAdornment: <StartIcon icon={LockOutlinedIcon} />,
                                    endAdornment: (
                                        <PasswordToggle
                                            shown={showPassword}
                                            onToggle={() => setShowPassword((v) => !v)}
                                        />
                                    ),
                                }}
                            />
                        </MotionBox>
                    )}

                    {/* 비밀번호 확인 */}
                    {unlockedIndex >= 3 && (
                        <MotionBox
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            <FieldLabel htmlFor="signup-password-confirm">비밀번호 확인</FieldLabel>
                            <TextField
                                fullWidth
                                id="signup-password-confirm"
                                type={showConfirmPassword ? "text" : "password"}
                                value={form.confirmPassword}
                                onChange={onChange("confirmPassword")}
                                onBlur={handleAccountFieldBlur(3)}
                                onKeyDown={handleAccountFieldKeyDown(3)}
                                error={!!getFieldError("confirmPassword")}
                                helperText={getFieldError("confirmPassword")}
                                inputRef={confirmPasswordRef}
                                inputProps={{ enterKeyHint: "done" }}
                                placeholder="비밀번호를 다시 입력하세요"
                                required
                                sx={fieldSx}
                                InputProps={{
                                    startAdornment: <StartIcon icon={LockOutlinedIcon} />,
                                    endAdornment: (
                                        <PasswordToggle
                                            shown={showConfirmPassword}
                                            onToggle={() => setShowConfirmPassword((v) => !v)}
                                        />
                                    ),
                                }}
                            />
                        </MotionBox>
                    )}

                    <Box sx={{ pt: 1 }}>
                        <AuthActionButton
                            dense={dense}
                            label="다음"
                            onClick={goAccountNext}
                            disabled={!accountValid}
                        />
                    </Box>
                </Stack>
            )}

            {/* ── Step 3: 워크스페이스 — 앱과 동일한 옵션 카드 3종 ── */}
            {step === "workspace" && (
                <Stack spacing={1.25}>
                    <WorkspaceOption
                        active={form.joinMode === "create"}
                        accent
                        icon={<GroupAddRoundedIcon sx={{ fontSize: 22 }} />}
                        title="새 워크스페이스 만들기"
                        desc="나와 팀의 공간을 새로 만들어요"
                        onClick={() => setForm((p) => ({ ...p, joinMode: "create" }))}
                    />

                    {form.joinMode === "create" && (
                        <Box>
                            <FieldLabel htmlFor="signup-workspace-name">워크스페이스 이름</FieldLabel>
                            <TextField
                                fullWidth
                                id="signup-workspace-name"
                                value={form.workspaceName}
                                onChange={onChange("workspaceName")}
                                onBlur={onBlur("workspaceName")}
                                error={!!getFieldError("workspaceName")}
                                helperText={getFieldError("workspaceName") || "추후 변경 가능합니다"}
                                placeholder="팀 이름을 입력하세요"
                                sx={fieldSx}
                                InputProps={{ startAdornment: <StartIcon icon={WorkspacesOutlinedIcon} /> }}
                            />
                        </Box>
                    )}

                    <WorkspaceOption
                        active={form.joinMode === "invite"}
                        icon={<MarkEmailUnreadRoundedIcon sx={{ fontSize: 20 }} />}
                        title="초대코드로 참여"
                        desc="기존 팀에 합류해요"
                        onClick={() => setForm((p) => ({ ...p, joinMode: "invite" }))}
                    />

                    {form.joinMode === "invite" && (
                        <Box>
                            <FieldLabel htmlFor="signup-invite-code">초대코드</FieldLabel>
                            <TextField
                                fullWidth
                                id="signup-invite-code"
                                value={form.inviteCode}
                                onChange={onChange("inviteCode")}
                                onBlur={onBlur("inviteCode")}
                                error={!!getFieldError("inviteCode")}
                                helperText={getFieldError("inviteCode") || "팀원에게 받은 초대코드를 입력하세요"}
                                placeholder="예: ABCD2345"
                                sx={fieldSx}
                                InputProps={{ startAdornment: <StartIcon icon={VpnKeyOutlinedIcon} /> }}
                            />
                        </Box>
                    )}

                    <WorkspaceOption
                        active={form.joinMode === "later"}
                        icon={<ScheduleRoundedIcon sx={{ fontSize: 20 }} />}
                        title="나중에 설정할게요"
                        desc="건너뛰면 자동으로 워크스페이스가 생성되며, 추후 이름을 변경할 수 있어요"
                        onClick={() => setForm((p) => ({ ...p, joinMode: "later" }))}
                    />

                    <Box sx={{ pt: 1 }}>
                        <AuthActionButton
                            dense={dense}
                            label={loading ? "가입 중..." : "가입하기"}
                            onClick={handleSubmit}
                            disabled={loading}
                        />
                    </Box>
                </Stack>
            )}

            {/* ── Step 4: 메일 인증 안내 ──
                정책: 미인증이어도 로그인·개인 사용은 모두 허용. 초대코드로 팀에 참여할 때만 막힌다.
                그래서 여기서 진입을 막지 않고 안내 + 재발송만 제공한다. */}
            {step === "verify" && (
                <Stack spacing={2}>
                    <Box
                        sx={{
                            width: 52,
                            height: 52,
                            borderRadius: "14px",
                            background: "linear-gradient(135deg, #1B6FF5, #7C3AED)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <MarkEmailUnreadRoundedIcon sx={{ fontSize: 26 }} />
                    </Box>

                    <Box>
                        <Typography sx={titleSx}>메일을 확인해주세요</Typography>
                        <Typography sx={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
                            <Box component="span" sx={{ fontWeight: 700, color: "#0F172A" }}>
                                {done?.email}
                            </Box>
                            {" 로 인증 링크를 보냈어요. 링크를 누르면 이메일 인증이 완료돼요."}
                        </Typography>
                    </Box>

                    {/* 인증이 왜 필요한지 — 정책을 그대로 안내 */}
                    <Box
                        sx={{
                            borderRadius: "14px",
                            background: "rgba(27,111,245,0.06)",
                            border: "1px solid rgba(27,111,245,0.16)",
                            px: 2,
                            py: 1.5,
                        }}
                    >
                        <Typography sx={{ fontSize: 12.5, color: "#334155", lineHeight: 1.7 }}>
                            · 인증 전에도 Plan Do!는 바로 사용할 수 있어요.<br />
                            · <Box component="span" sx={{ fontWeight: 700 }}>초대코드로 팀에 참여</Box>할 때만 인증이 필요해요.
                        </Typography>
                    </Box>

                    {resendResult && (
                        <Alert severity={resendResult.severity} sx={{ borderRadius: 2 }}>
                            {resendResult.text}
                        </Alert>
                    )}

                    <Stack spacing={1.25}>
                        <AuthActionButton
                            dense={dense}
                            label="Plan Do! 시작하기"
                            onClick={() => navigate(done?.route || "/dashboard", { replace: true })}
                        />
                        <AuthActionButton
                            dense={dense}
                            tone="outline"
                            label={resending ? "보내는 중..." : "인증 메일 재발송"}
                            onClick={handleResend}
                            disabled={resending}
                        />
                    </Stack>

                    <Typography sx={{ fontSize: 11, color: "text.disabled", lineHeight: 1.6 }}>
                        메일이 보이지 않으면 스팸함도 확인해주세요. 재발송은 3분에 한 번 가능하고,
                        나중에 앱 상단 안내 배너에서도 다시 받을 수 있어요.
                    </Typography>
                </Stack>
            )}

            {/* 푸터 — method 단계에서만 (앱 signup 미러) */}
            {step === "method" && (
                <Box sx={{ mt: dense ? "auto" : 3, pt: 2 }}>
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.75}>
                        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                            이미 계정이 있나요?
                        </Typography>
                        <Box
                            component={RouterLink}
                            to="/login"
                            sx={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: "#1B6FF5",
                                textDecoration: "none",
                            }}
                        >
                            로그인
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
                        계속 진행하면{" "}
                        <Box
                            component="span"
                            onClick={() => setPrivacyOpen(true)}
                            sx={{
                                color: "text.secondary",
                                textDecoration: "underline",
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            개인정보처리방침
                        </Box>
                        에 동의하는 것으로 간주됩니다.
                    </Typography>
                </Box>
            )}

            <KakaoLoginDialog
                open={kakaoDialogOpen}
                onClose={() => setKakaoDialogOpen(false)}
                label="카카오로 시작하기"
            />

            <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
        </Box>
    );
}
