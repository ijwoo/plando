import React, { useMemo, useState } from "react";
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
import { buildTheme } from "../../../shared/ui/theme.js";
import { resetPassword } from "../api/authApi.js";
import { Box, Button, TextField, Typography, Stack, Alert, Link } from "@mui/material";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import ResetPasswordPageMobile from "./ResetPasswordPageMobile.jsx";
import { AUTH_PAGE_BG_MODERN } from "../utils/pageBg.js";

const BLUE = "#1976d2";
const BLUE_DARK = "#1565c0";
const PAGE_BG = AUTH_PAGE_BG_MODERN;

// ── 라우터 wrapper — 모바일/데스크톱 분기 ─────────────────────────
export default function ResetPasswordPage() {
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
    return isMobile ? <ResetPasswordPageMobile /> : <ResetPasswordPageDesktop />;
}

// ── 데스크톱 (기존 구현 그대로) ─────────────────────────────────────
function ResetPasswordPageDesktop() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useMemo(() => buildTheme("light"), []);

    const token = new URLSearchParams(location.search).get("token");

    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newPassword || !confirm) return;
        if (newPassword !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
        if (newPassword.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }

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

    if (!token) {
        return (
            <ThemeProvider theme={theme}>
                <Box sx={{ minHeight: "100dvh", background: PAGE_BG, display: "flex", alignItems: "center", justifyContent: "center", p: 2, pt: "calc(16px + env(safe-area-inset-top))", pb: "calc(16px + env(safe-area-inset-bottom))" }}>
                    <Box sx={{ bgcolor: "rgba(255,255,255,0.88)", borderRadius: 4, p: 4, maxWidth: 400, width: "100%" }}>
                        <Alert severity="error">유효하지 않은 링크입니다.</Alert>
                        <Button fullWidth variant="outlined" onClick={() => navigate("/login")} sx={{ mt: 2, borderRadius: 2.5, fontWeight: 700 }}>
                            로그인으로 돌아가기
                        </Button>
                    </Box>
                </Box>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={theme}>
            <Box sx={{ minHeight: "100dvh", background: PAGE_BG, display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
                <Box sx={{
                    width: "100%", maxWidth: 400,
                    bgcolor: "rgba(255,255,255,0.88)",
                    borderRadius: 4,
                    boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
                    p: { xs: 3, sm: 4 },
                    backdropFilter: "blur(12px)",
                }}>
                    <Stack alignItems="center" spacing={1} mb={3}>
                        <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <LockResetRoundedIcon sx={{ color: "#fff", fontSize: 26 }} />
                        </Box>
                        <Typography fontWeight={900} fontSize={22}>새 비밀번호 설정</Typography>
                    </Stack>

                    {done ? (
                        <Stack spacing={2}>
                            <Alert severity="success">비밀번호가 재설정되었습니다.</Alert>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={() => navigate("/login")}
                                sx={{ height: 48, borderRadius: 2.5, fontWeight: 900, bgcolor: BLUE, "&:hover": { bgcolor: BLUE_DARK } }}
                            >
                                로그인하러 가기
                            </Button>
                        </Stack>
                    ) : (
                        <Box component="form" onSubmit={handleSubmit}>
                            <Stack spacing={2}>
                                {error && <Alert severity="error">{error}</Alert>}
                                <TextField
                                    fullWidth
                                    label="새 비밀번호"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="8자 이상"
                                    required
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.70)" } }}
                                />
                                <TextField
                                    fullWidth
                                    label="비밀번호 확인"
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.70)" } }}
                                />
                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    disabled={loading}
                                    sx={{ height: 48, borderRadius: 2.5, fontWeight: 900, fontSize: 15, bgcolor: BLUE, "&:hover": { bgcolor: BLUE_DARK } }}
                                >
                                    {loading ? "변경 중..." : "비밀번호 변경"}
                                </Button>
                            </Stack>
                        </Box>
                    )}

                    {!done && (
                        <Stack direction="row" justifyContent="center" spacing={0.5} mt={2.5}>
                            <Link component={RouterLink} to="/login" underline="hover" sx={{ fontWeight: 700, fontSize: "0.875rem", color: "text.secondary" }}>
                                로그인으로 돌아가기
                            </Link>
                        </Stack>
                    )}
                </Box>
            </Box>
        </ThemeProvider>
    );
}
