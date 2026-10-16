import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { getToken } from "../../../shared/utils/tokenUtils.js";
import { joinWorkspace } from "../../workspace/api/workspaceApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import {
    Box,
    Button,
    Container,
    Typography,
    Paper,
    Stack,
    Alert,
    CircularProgress,
    Divider,
    useMediaQuery,
} from "@mui/material";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import InvitePageMobile from "./InvitePageMobile.jsx";

// ── 라우터 wrapper — 모바일/데스크톱 분기 ─────────────────────────
export default function InvitePage() {
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
    return isMobile ? <InvitePageMobile /> : <InvitePageDesktop />;
}

// ── 데스크톱 (기존 구현 그대로) ─────────────────────────────────────
function InvitePageDesktop() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loadWorkspaces, changeWorkspace } = useWorkspace();

    const code = searchParams.get("code") || "";
    const isLoggedIn = !!getToken();

    const [joining, setJoining] = useState(false);
    const [error, setError] = useState("");

    // 로그인 상태면 바로 참여 처리
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
    }, []);

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

    if (isLoggedIn) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100dvh">
                {joining ? (
                    <Stack alignItems="center" spacing={2}>
                        <CircularProgress />
                        <Typography color="text.secondary">워크스페이스에 참여하는 중...</Typography>
                    </Stack>
                ) : (
                    <Stack alignItems="center" spacing={2}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <Button variant="contained" onClick={() => navigate("/dashboard")}>
                            대시보드로 이동
                        </Button>
                    </Stack>
                )}
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: "100dvh",
                bgcolor: "background.default",
                display: "flex",
                alignItems: "center",
                py: 4,
                pt: "calc(32px + env(safe-area-inset-top))",
                pb: "calc(32px + env(safe-area-inset-bottom))",
            }}
        >
            <Container maxWidth="sm">
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        p: { xs: 3, sm: 5 },
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        textAlign: "center",
                    }}
                >
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 3,
                            bgcolor: "primary.main",
                            display: "grid",
                            placeItems: "center",
                            mx: "auto",
                            mb: 2,
                        }}
                    >
                        <TaskAltIcon sx={{ color: "primary.contrastText", fontSize: 28 }} />
                    </Box>

                    <Typography sx={{ fontWeight: 900, fontSize: 26, mb: 1 }}>
                        Plan <Box component="span" sx={{ color: "primary.main" }}>Do!</Box>
                    </Typography>

                    <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>
                        워크스페이스에 초대받으셨어요
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        팀원과 함께 할 일을 관리해보세요.
                    </Typography>

                    {code && (
                        <Box
                            sx={{
                                display: "inline-block",
                                px: 2,
                                py: 0.5,
                                borderRadius: 2,
                                bgcolor: "action.selected",
                                mb: 3,
                            }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                초대 코드
                            </Typography>
                            <Typography sx={{ fontWeight: 900, fontSize: 18, letterSpacing: 2 }}>
                                {code}
                            </Typography>
                        </Box>
                    )}

                    <Stack spacing={1.5}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<GroupAddIcon />}
                            onClick={handleKakao}
                            sx={{
                                height: 48,
                                borderRadius: 2.5,
                                fontWeight: 900,
                                backgroundColor: "#FEE500",
                                color: "#000",
                                "&:hover": { backgroundColor: "#e6cf00" },
                            }}
                        >
                            카카오로 참여하기
                        </Button>

                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={handleRegister}
                            sx={{ height: 48, borderRadius: 2.5, fontWeight: 700 }}
                        >
                            이메일로 회원가입 후 참여하기
                        </Button>

                        <Divider sx={{ my: 0.5 }}>이미 계정이 있으신가요?</Divider>

                        <Button
                            fullWidth
                            variant="text"
                            onClick={handleLogin}
                            sx={{ height: 44, borderRadius: 2.5, fontWeight: 700 }}
                        >
                            로그인하기
                        </Button>
                    </Stack>
                </Paper>
            </Container>
        </Box>
    );
}
