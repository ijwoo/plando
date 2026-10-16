import React, { useMemo, useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
import { buildTheme } from "../../../shared/ui/theme.js";
import { forgotPassword } from "../api/authApi.js";
import { Box, Button, TextField, Typography, Stack, Alert, Link } from "@mui/material";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import ForgotPasswordPageMobile from "./ForgotPasswordPageMobile.jsx";
import { AUTH_PAGE_BG_MODERN } from "../utils/pageBg.js";

const BLUE = "#1976d2";
const BLUE_DARK = "#1565c0";
const PAGE_BG = AUTH_PAGE_BG_MODERN;

// ── 라우터 wrapper — 모바일/데스크톱 분기 ─────────────────────────
export default function ForgotPasswordPage() {
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
    return isMobile ? <ForgotPasswordPageMobile /> : <ForgotPasswordPageDesktop />;
}

// ── 데스크톱 (기존 구현 그대로) ─────────────────────────────────────
function ForgotPasswordPageDesktop() {
    const navigate = useNavigate();
    const theme = useMemo(() => buildTheme("light"), []);

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
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
        <ThemeProvider theme={theme}>
            <Box sx={{ minHeight: "100dvh", background: PAGE_BG, display: "flex", alignItems: "center", justifyContent: "center", p: 2, pt: "calc(16px + env(safe-area-inset-top))", pb: "calc(16px + env(safe-area-inset-bottom))" }}>
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
                        <Typography fontWeight={900} fontSize={22}>비밀번호 찾기</Typography>
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                            가입한 이메일을 입력하면 재설정 링크를 보내드립니다
                        </Typography>
                    </Stack>

                    {sent ? (
                        <Stack spacing={2}>
                            {/* 특정 주소로 "보냈다"고 단정하지 않는다 — 서버는 가입 여부·가입 수단을
                                노출하지 않으려고 어떤 경우든 성공으로 답한다(계정 존재 여부 탐색 방지).
                                비밀번호가 없는 소셜 계정에는 실제로 메일이 나가지 않으므로 그 경우도 함께 안내. */}
                            <Alert severity="success">
                                가입된 이메일이면 재설정 링크를 보냈어요.<br />
                                메일함을 확인해주세요. (스팸 폴더도 확인)<br />
                                소셜 로그인(카카오·Google·Apple)으로 가입하셨다면 비밀번호가 없으니 그 소셜 로그인으로 로그인해주세요.
                            </Alert>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={() => navigate("/login")}
                                sx={{ borderRadius: 2.5, fontWeight: 700 }}
                            >
                                로그인으로 돌아가기
                            </Button>
                        </Stack>
                    ) : (
                        <Box component="form" onSubmit={handleSubmit}>
                            <Stack spacing={2}>
                                {error && <Alert severity="error">{error}</Alert>}
                                <TextField
                                    fullWidth
                                    label="이메일"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email"
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
                                    {loading ? "전송 중..." : "재설정 링크 전송"}
                                </Button>
                            </Stack>
                        </Box>
                    )}

                    {!sent && (
                        <Stack direction="row" justifyContent="center" spacing={0.5} mt={2.5}>
                            <Typography variant="body2" color="text.secondary">생각났어요!</Typography>
                            <Link component={RouterLink} to="/login" underline="hover" sx={{ fontWeight: 800, fontSize: "0.875rem", color: BLUE }}>
                                로그인
                            </Link>
                        </Stack>
                    )}
                </Box>
            </Box>
        </ThemeProvider>
    );
}
