import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";

import { buildTheme } from "../../../shared/ui/theme.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { getToken } from "../../../shared/utils/tokenUtils.js";
import { joinWorkspace } from "../../workspace/api/workspaceApi.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import BrandMark from "../components/BrandMark.jsx";
import { KakaoIcon } from "../components/AuthIcons.jsx";
import { AUTH_PAGE_BG_MODERN } from "../utils/pageBg.js";

/**
 * 모바일 워크스페이스 초대 페이지.
 * 카카오톡 초대 링크 진입 (`/join?code=ABC123`) 시 보이는 화면 — 99% 모바일 진입 경로.
 *
 * 흐름:
 *   - 로그인 상태 → 자동으로 joinWorkspace + /dashboard 이동 (loading screen)
 *   - 비로그인 → 카카오/이메일 가입/이메일 로그인 옵션 노출. 코드 chip 표시.
 *
 * Phase 8 LoginPageMobile / Phase J 디자인과 동일 chrome (그라데이션 배경 + 흰 카드 + #1B6FF5).
 */
export default function InvitePageMobile() {
    const lightTheme = useMemo(() => buildTheme("light"), []);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loadWorkspaces, changeWorkspace } = useWorkspace();

    const code = searchParams.get("code") || "";
    const isLoggedIn = !!getToken();

    const [joining, setJoining] = useState(false);
    const [error, setError] = useState("");

    /* 로그인 상태면 자동 참여 */
    useEffect(() => {
        if (!isLoggedIn || !code) return;
        setJoining(true);
        joinWorkspace({ inviteCode: code })
            .then(async (result) => {
                await loadWorkspaces?.();
                changeWorkspace?.({
                    workspaceId: result.workspaceId,
                    workspaceName: result.workspaceName,
                    inviteCode: result.inviteCode,
                    role: result.role,
                });
                navigate("/dashboard", { replace: true });
            })
            .catch((err) => {
                setError(getApiError(err, "워크스페이스 참여에 실패했습니다."));
                setJoining(false);
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleKakao = () => {
        if (code) sessionStorage.setItem("oauthInviteCode", code);
        window.location.href = `${import.meta.env.VITE_API_BASE_URL ?? ""}/oauth2/authorization/kakao`;
    };
    const handleRegister = () => {
        navigate(`/register?inviteCode=${code}`);
    };
    const handleLogin = () => {
        if (code) sessionStorage.setItem("pendingInviteCode", code);
        navigate("/login");
    };

    /* ── 로그인 상태: 자동 참여 진행 화면 ── */
    if (isLoggedIn) {
        return (
            <ThemeProvider theme={lightTheme}>
                <Box
                    sx={{
                        minHeight: "100dvh",
                        background: AUTH_PAGE_BG_MODERN,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        px: 3,
                        pt: "calc(env(safe-area-inset-top) + 24px)",
                        pb: "calc(env(safe-area-inset-bottom) + 16px)",
                    }}
                >
                    {joining ? (
                        <Stack alignItems="center" spacing={2}>
                            <CircularProgress sx={{ color: "#1B6FF5" }} />
                            <Typography sx={{ fontSize: 14, color: "#64748B" }}>
                                워크스페이스에 참여하는 중...
                            </Typography>
                        </Stack>
                    ) : (
                        <Stack alignItems="center" spacing={2}>
                            {error && (
                                <Alert severity="error" sx={{ borderRadius: 2 }}>
                                    {error}
                                </Alert>
                            )}
                            <Press
                                as="button"
                                onClick={() => navigate("/dashboard")}
                                haptic="medium"
                                pressScale={0.97}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: 50,
                                    padding: "0 28px",
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
                                대시보드로 이동
                            </Press>
                        </Stack>
                    )}
                </Box>
            </ThemeProvider>
        );
    }

    /* ── 비로그인: 가입/로그인 안내 ── */
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
                    {/* 상단 BrandMark */}
                    <Box sx={{ display: "flex", justifyContent: "center", mb: 3, mt: 1 }}>
                        <BrandMark size="large" />
                    </Box>

                    {/* 환영 헤더 + 코드 */}
                    <Stack alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 2,
                                background: "#1B6FF5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <GroupAddRoundedIcon sx={{ color: "#fff", fontSize: 26 }} />
                        </Box>
                        <Typography
                            sx={{
                                fontSize: 20,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                                color: "#0F172A",
                                textAlign: "center",
                            }}
                        >
                            워크스페이스에 초대받으셨어요
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, textAlign: "center" }}>
                            팀원과 함께 할 일을 관리해보세요
                        </Typography>

                        {code && (
                            <Box
                                sx={{
                                    display: "inline-flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    px: 2.5,
                                    py: 1,
                                    borderRadius: 2,
                                    bgcolor: "rgba(27,111,245,0.08)",
                                    mt: 0.5,
                                }}
                            >
                                <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#1B6FF5", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                                    초대 코드
                                </Typography>
                                <Typography sx={{ fontWeight: 900, fontSize: 18, letterSpacing: 2, color: "#0F172A", mt: 0.25 }}>
                                    {code}
                                </Typography>
                            </Box>
                        )}
                    </Stack>

                    {/* 버튼 그룹 — 중앙 정렬 영역 */}
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            minHeight: 0,
                        }}
                    >
                        <Stack spacing={1.25}>
                            {/* 카카오 */}
                            <Press
                                onClick={handleKakao}
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
                                카카오로 참여하기
                            </Press>

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
                                <Typography sx={{ fontSize: 11, color: "#94A3B8" }}>또는</Typography>
                            </Box>

                            {/* 이메일 가입 */}
                            <Press
                                onClick={handleRegister}
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
                                <EmailRoundedIcon sx={{ fontSize: 18, color: "#64748B" }} />
                                이메일로 가입하기
                            </Press>
                        </Stack>
                    </Box>

                    {/* 푸터 — 이미 계정이 있으면 */}
                    <Stack
                        direction="row"
                        justifyContent="center"
                        alignItems="center"
                        spacing={0.75}
                        sx={{
                            pt: 2,
                            borderTop: 1,
                            borderColor: "divider",
                        }}
                    >
                        <Typography sx={{ fontSize: 12.5, color: "#64748B" }}>
                            이미 계정이 있나요?
                        </Typography>
                        <Box
                            component="button"
                            onClick={handleLogin}
                            sx={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: "#1B6FF5",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                p: 0,
                                textDecoration: "none",
                            }}
                        >
                            로그인하기
                        </Box>
                    </Stack>
                </Box>
            </Box>
        </ThemeProvider>
    );
}
