import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";

import { buildTheme } from "../../../shared/ui/theme.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { getToken } from "../../../shared/utils/tokenUtils.js";
import { verifyEmail } from "../api/authApi.js";
import { AUTH_PAGE_BG_MODERN } from "../utils/pageBg.js";

const BLUE = "#1976d2";
const BLUE_DARK = "#1565c0";
const PAGE_BG = AUTH_PAGE_BG_MODERN;

/**
 * 이메일 인증 완료 페이지 — 인증 메일의 링크(`/#/verify-email?token=...`) 진입점.
 *
 * 로그인하지 않은 상태에서도 동작해야 한다(메일을 다른 브라우저·기기에서 여는 게 흔하다).
 * 그래서 ProtectedRoute 밖 라우트이고, 서버도 이 엔드포인트만 permitAll로 열어둔다.
 * 데스크탑/모바일 분기 없이 한 화면 — 카드 하나라 좁은 폭에서도 그대로 쓸 수 있다.
 */
export default function VerifyEmailPage() {
    const theme = useMemo(() => buildTheme("light"), []);
    const navigate = useNavigate();
    const location = useLocation();

    const token = new URLSearchParams(location.search).get("token");
    const isLoggedIn = !!getToken();

    const [loading, setLoading] = useState(!!token);
    const [done, setDone] = useState(false);
    // 가입 때 초대코드를 넣었다면 서버가 합류 결과를 함께 내려준다. 예전엔 인증 성공만 알리고
    // 팀에 들어갔는지는 말해 주지 않아, 사용자가 확인할 방법이 없었다.
    const [joinInfo, setJoinInfo] = useState({ name: null, error: null });
    const [error, setError] = useState(token ? "" : "유효하지 않은 링크입니다.");
    // StrictMode 이중 마운트로 토큰이 두 번 소비되면 두 번째가 "이미 사용된 링크"로 실패한다
    const ran = useRef(false);

    useEffect(() => {
        if (!token || ran.current) return;
        ran.current = true;
        (async () => {
            try {
                const data = (await verifyEmail(token)) ?? {};   // authApi 가 response.data 를 그대로 준다
                setJoinInfo({ name: data.joinedWorkspaceName ?? null, error: data.joinError ?? null });
                setDone(true);
            } catch (err) {
                setError(getApiError(err, "이메일 인증에 실패했습니다."));
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    const goBack = () => navigate(isLoggedIn ? "/dashboard" : "/login", { replace: true });

    return (
        <ThemeProvider theme={theme}>
            <Box sx={{
                minHeight: "100dvh",
                background: PAGE_BG,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
                pt: "calc(16px + env(safe-area-inset-top))",
                pb: "calc(16px + env(safe-area-inset-bottom))",
            }}>
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
                            <MarkEmailReadRoundedIcon sx={{ color: "#fff", fontSize: 26 }} />
                        </Box>
                        <Typography fontWeight={900} fontSize={22}>이메일 인증</Typography>
                    </Stack>

                    {loading ? (
                        <Stack alignItems="center" spacing={2} py={2}>
                            <CircularProgress size={28} />
                            <Typography variant="body2" color="text.secondary">인증을 확인하는 중...</Typography>
                        </Stack>
                    ) : (
                        <Stack spacing={2}>
                            {done ? (
                                <>
                                    <Alert severity="success">이메일 인증이 완료되었습니다.</Alert>
                                    {joinInfo.name ? (
                                        <Typography variant="caption" color="text.secondary">
                                            <strong>{joinInfo.name}</strong> 워크스페이스에 합류했어요.
                                        </Typography>
                                    ) : joinInfo.error ? (
                                        <Alert severity="warning" sx={{ py: 0.5 }}>
                                            {joinInfo.error} 로그인 후 설정 → 워크스페이스에서 초대코드를 다시 입력해 주세요.
                                        </Alert>
                                    ) : (
                                        <Typography variant="caption" color="text.secondary">
                                            이제 초대코드로 팀 워크스페이스에 참여할 수 있어요.
                                        </Typography>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Alert severity="error">{error}</Alert>
                                    <Typography variant="caption" color="text.secondary">
                                        링크가 만료됐거나 이미 사용됐다면, 로그인 후 상단 안내 배너에서
                                        인증 메일을 다시 받을 수 있어요.
                                    </Typography>
                                </>
                            )}
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={goBack}
                                sx={{ height: 48, borderRadius: 2.5, fontWeight: 900, bgcolor: BLUE, "&:hover": { bgcolor: BLUE_DARK } }}
                            >
                                {isLoggedIn ? "Plan Do! 로 돌아가기" : "로그인하러 가기"}
                            </Button>
                        </Stack>
                    )}
                </Box>
            </Box>
        </ThemeProvider>
    );
}
