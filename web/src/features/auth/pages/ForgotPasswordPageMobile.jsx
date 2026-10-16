import React, { useMemo, useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";

import { buildTheme } from "../../../shared/ui/theme.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { inputSxWhite } from "../../../shared/ui/inputSx.js";
import { forgotPassword } from "../api/authApi.js";
import { AUTH_PAGE_BG_MODERN } from "../utils/pageBg.js";

/**
 * 모바일 비밀번호 찾기.
 * Phase 8 Login/Register 모바일과 동일한 chrome (그라데이션 배경 + 흰 카드 + #1B6FF5 브랜드 블루).
 * 테마 무관 고정 light 톤.
 */
export default function ForgotPasswordPageMobile() {
    const lightTheme = useMemo(() => buildTheme("light"), []);
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const canSubmit = email.trim().length > 0 && !loading;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        setError("");
        try {
            await forgotPassword(email.trim());
            setSent(true);
        } catch (err) {
            setError(err?.response?.data?.message ?? "이메일 전송에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemeProvider theme={lightTheme}>
            <Box
                sx={{
                    minHeight: "100dvh",
                    background: AUTH_PAGE_BG_MODERN,
                    display: "flex",
                    flexDirection: "column",
                    pt: "calc(env(safe-area-inset-top) + 24px)",
                    pb: "calc(env(safe-area-inset-bottom) + 16px)",
                    px: 2,
                }}
            >
                {/* 흰 카드 wrapper */}
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: "#fff",
                        borderRadius: "22px",
                        p: 2.75,
                        boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                    }}
                >
                    {/* 뒤로가기 */}
                    <Box sx={{ mb: 1.75 }}>
                        <Press
                            onClick={() => navigate("/login")}
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

                    {/* 헤더 — 아이콘 + 타이틀 + 안내 */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.75 }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                background: "#1B6FF5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <LockResetRoundedIcon sx={{ color: "#fff", fontSize: 22 }} />
                        </Box>
                        <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#0F172A" }}>
                            비밀번호 찾기
                        </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 13, color: "#64748B", mb: 2.75, lineHeight: 1.5 }}>
                        가입한 이메일을 입력하면 재설정 링크를 보내드려요
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 1.75, borderRadius: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {sent ? (
                        /* ── 성공 상태 ── */
                        <Stack spacing={1.5}>
                            {/* 특정 주소로 "보냈다"고 단정하지 않는다 — 서버는 가입 여부·가입 수단을
                                노출하지 않으려고 어떤 경우든 성공으로 답한다(계정 존재 여부 탐색 방지).
                                비밀번호가 없는 소셜 계정에는 실제로 메일이 나가지 않으므로 그 경우도 함께 안내. */}
                            <Alert severity="success" sx={{ borderRadius: 2 }}>
                                가입된 이메일이면 재설정 링크를 보냈어요.<br />
                                메일함을 확인해주세요. (스팸 폴더도 확인)<br />
                                소셜 로그인(카카오·Google·Apple)으로 가입하셨다면 비밀번호가 없으니 그 소셜 로그인으로 로그인해주세요.
                            </Alert>
                            <Press
                                as="button"
                                onClick={() => navigate("/login")}
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
                                로그인으로 돌아가기
                            </Press>
                        </Stack>
                    ) : (
                        /* ── 입력 폼 ── */
                        <Box component="form" onSubmit={handleSubmit} noValidate>
                            <TextField
                                fullWidth
                                label="이메일"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                                required
                                autoFocus
                                sx={inputSxWhite()}
                                inputProps={{ enterKeyHint: "send" }}
                            />
                            <Press
                                as="button"
                                type="submit"
                                disabled={!canSubmit}
                                haptic="medium"
                                pressScale={0.97}
                                style={{
                                    marginTop: 16,
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
                                {loading ? "전송 중..." : "재설정 링크 전송"}
                            </Press>
                        </Box>
                    )}

                    {!sent && (
                        <Stack
                            direction="row"
                            justifyContent="center"
                            alignItems="center"
                            spacing={0.75}
                            sx={{ mt: "auto", pt: 2, borderTop: 1, borderColor: "divider" }}
                        >
                            <Typography sx={{ fontSize: 12.5, color: "#64748B" }}>
                                생각났어요?
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
                    )}
                </Box>
            </Box>
        </ThemeProvider>
    );
}
