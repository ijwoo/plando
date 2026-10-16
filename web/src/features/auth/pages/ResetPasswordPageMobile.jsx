import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";

import { buildTheme } from "../../../shared/ui/theme.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { inputSxWhite } from "../../../shared/ui/inputSx.js";
import { resetPassword } from "../api/authApi.js";
import { AUTH_PAGE_BG_MODERN } from "../utils/pageBg.js";

// motion.div를 alias 변수로 잡아서 JSX 사용 시 ESLint no-unused-vars 우회
const MotionBox = motion.div;

/**
 * 모바일 비밀번호 재설정.
 * URL ?token=... 파라미터 검증 후 새 비밀번호 입력.
 * Toss 스타일 progressive reveal — 새 비밀번호 입력(8자+) 후 비밀번호 확인 fade-in.
 */
export default function ResetPasswordPageMobile() {
    const lightTheme = useMemo(() => buildTheme("light"), []);
    const navigate = useNavigate();
    const location = useLocation();
    const token = new URLSearchParams(location.search).get("token");

    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [touchedConfirm, setTouchedConfirm] = useState(false);
    const [unlockedConfirm, setUnlockedConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    const newPasswordRef = useRef(null);
    const confirmRef = useRef(null);

    const isPasswordValid = newPassword.length >= 8;
    const passwordsMatch = newPassword === confirm;
    const canSubmit = isPasswordValid && confirm.length >= 8 && passwordsMatch && !loading;

    const advanceToConfirm = () => {
        if (!isPasswordValid) return;
        if (!unlockedConfirm) {
            setUnlockedConfirm(true);
            setTimeout(() => confirmRef.current?.focus(), 120);
        }
    };

    // IME 조합 중 Enter는 조합 확정용 — 여기서 처리하면 안 됨
    const isComposingEnter = (e) => e.nativeEvent?.isComposing || e.keyCode === 229;

    const handleNewPasswordKeyDown = (e) => {
        if (e.key === "Enter") {
            if (isComposingEnter(e)) return;
            e.preventDefault();
            advanceToConfirm();
        }
    };

    const handleConfirmKeyDown = (e) => {
        if (e.key === "Enter" && canSubmit) {
            if (isComposingEnter(e)) return;
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSubmit = async (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (!newPassword || !confirm) return;
        if (!passwordsMatch) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
        }
        if (!isPasswordValid) {
            setError("비밀번호는 8자 이상이어야 합니다.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await resetPassword(token, newPassword);
            setDone(true);
        } catch (err) {
            setError(err?.response?.data?.message ?? "비밀번호 재설정에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const confirmError = touchedConfirm && confirm.length > 0 && !passwordsMatch
        ? "비밀번호가 일치하지 않습니다."
        : "";

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

                    {/* 헤더 */}
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
                            새 비밀번호 설정
                        </Typography>
                    </Box>

                    {!token ? (
                        /* ── 토큰 없음 — 잘못된 링크 ── */
                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                            <Alert severity="error" sx={{ borderRadius: 2 }}>
                                유효하지 않은 링크입니다.
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
                    ) : done ? (
                        /* ── 완료 ── */
                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                            <Alert severity="success" sx={{ borderRadius: 2 }}>
                                비밀번호가 재설정되었습니다.
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
                                로그인하러 가기
                            </Press>
                        </Stack>
                    ) : (
                        /* ── 입력 폼 (progressive reveal) ── */
                        <>
                            <Typography sx={{ fontSize: 13, color: "#64748B", mb: 2.5, lineHeight: 1.5 }}>
                                새 비밀번호를 입력해주세요 (8자 이상)
                            </Typography>

                            {error && (
                                <Alert severity="error" sx={{ mb: 1.75, borderRadius: 2 }}>
                                    {error}
                                </Alert>
                            )}

                            <Box component="form" onSubmit={handleSubmit} noValidate>
                                <Stack spacing={1.5}>
                                    <TextField
                                        fullWidth
                                        label="새 비밀번호"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        onBlur={advanceToConfirm}
                                        onKeyDown={handleNewPasswordKeyDown}
                                        helperText="8자 이상 입력해주세요"
                                        required
                                        autoFocus
                                        inputRef={newPasswordRef}
                                        inputProps={{ enterKeyHint: "next" }}
                                        sx={inputSxWhite()}
                                    />

                                    {unlockedConfirm && (
                                        <MotionBox
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.25 }}
                                        >
                                            <TextField
                                                fullWidth
                                                label="비밀번호 확인"
                                                type="password"
                                                value={confirm}
                                                onChange={(e) => setConfirm(e.target.value)}
                                                onBlur={() => setTouchedConfirm(true)}
                                                onKeyDown={handleConfirmKeyDown}
                                                error={Boolean(confirmError)}
                                                helperText={confirmError}
                                                required
                                                inputRef={confirmRef}
                                                inputProps={{ enterKeyHint: "done" }}
                                                sx={inputSxWhite()}
                                            />
                                        </MotionBox>
                                    )}
                                </Stack>

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
                                    {loading ? "변경 중..." : "비밀번호 변경"}
                                </Press>
                            </Box>

                            <Stack
                                direction="row"
                                justifyContent="center"
                                sx={{ mt: "auto", pt: 2, borderTop: 1, borderColor: "divider" }}
                            >
                                <Box
                                    component={RouterLink}
                                    to="/login"
                                    sx={{
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        color: "#64748B",
                                        textDecoration: "none",
                                    }}
                                >
                                    로그인으로 돌아가기
                                </Box>
                            </Stack>
                        </>
                    )}
                </Box>
            </Box>
        </ThemeProvider>
    );
}
