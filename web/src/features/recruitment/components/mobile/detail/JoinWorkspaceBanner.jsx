import { useState } from "react";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../../../../../shared/api/axiosInstance.js";
import { joinWorkspace } from "../../../../workspace/api/workspaceApi";
import { useWorkspace } from "../../../../workspace/context/WorkspaceContext";

/**
 * 합류 수락된 지원자에게 워크스페이스 초대를 띄워주는 배너.
 * 이미 참여 중이면 "워크스페이스 보러가기" 액션으로 전환.
 */
export default function JoinWorkspaceBanner({ detail, onClose, onNotify }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const { loadWorkspaces, workspaces, changeWorkspace } = useWorkspace();
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinDone, setJoinDone] = useState(false);

    const hasInviteCode = Boolean(detail.workspaceInviteCode);
    const alreadyInWorkspace = Boolean(
        detail.workspaceId &&
        workspaces.some((ws) => String(ws.workspaceId) === String(detail.workspaceId))
    );
    const showJoined = joinDone || alreadyInWorkspace;

    const handleJoinWorkspace = async () => {
        if (!hasInviteCode) {
            onNotify?.({ msg: "초대 코드 정보가 없어요. 팀장에게 문의해 주세요.", severity: "warning" });
            return;
        }
        setJoinLoading(true);
        try {
            await joinWorkspace({ inviteCode: detail.workspaceInviteCode });
            await loadWorkspaces();
            setJoinDone(true);
            onNotify?.({ msg: "워크스페이스에 참가했어요!", severity: "success" });
        } catch (err) {
            if (err?.response?.status === 409) {
                await loadWorkspaces();
                setJoinDone(true);
                onNotify?.({ msg: "이미 워크스페이스 멤버예요.", severity: "info" });
            } else {
                // 이메일 미인증(403 EMAIL_NOT_VERIFIED) 등 서버 사유가 있으면 그대로 안내
                onNotify?.({ msg: getApiError(err, "참가에 실패했어요. 잠시 후 다시 시도해 주세요."), severity: "error" });
            }
        } finally {
            setJoinLoading(false);
        }
    };

    const handleGoToWorkspace = () => {
        const ws = workspaces.find((w) => String(w.workspaceId) === String(detail.workspaceId));
        if (ws) changeWorkspace(ws);
        onClose?.();
        navigate("/dashboard");
    };

    return (
        <Box sx={{
            mx: 3, mt: 2, mb: 0,
            p: "14px 18px",
            bgcolor: showJoined
                ? alpha(theme.palette.success.main, 0.06)
                : alpha(theme.palette.primary.main, 0.06),
            border: 0,
            borderRadius: 1.75,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
        }}>
            <Stack direction="row" alignItems="center" gap={1.25}>
                <Box sx={{ fontSize: 18 }}>{showJoined ? "✅" : "👋"}</Box>
                <Box>
                    <Typography sx={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: showJoined ? "success.main" : "primary.main",
                        letterSpacing: "-0.015em",
                    }}>
                        {showJoined ? "워크스페이스 준비됐어요!" : "팀 합류가 수락되었어요!"}
                    </Typography>
                    <Typography sx={{
                        fontSize: 11.5,
                        color: "text.secondary",
                        mt: 0.25,
                    }}>
                        {showJoined
                            ? "지금 이동해서 팀원들과 협업을 시작해 보세요."
                            : hasInviteCode
                                ? "워크스페이스에 참가해서 팀원들과 소통해보세요."
                                : "팀장에게 문의해서 워크스페이스 초대를 받아보세요."}
                    </Typography>
                </Box>
            </Stack>
            {showJoined ? (
                <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    onClick={handleGoToWorkspace}
                    sx={{
                        borderRadius: 1.25,
                        fontWeight: 800,
                        px: 2,
                        flexShrink: 0,
                        bgcolor: "success.main",
                        color: "common.white",
                        "&:hover": { bgcolor: "success.dark" },
                    }}
                >
                    워크스페이스로 이동
                </Button>
            ) : hasInviteCode ? (
                <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    disabled={joinLoading}
                    onClick={handleJoinWorkspace}
                    sx={{
                        borderRadius: 1.25,
                        fontWeight: 800,
                        px: 2,
                        flexShrink: 0,
                    }}
                >
                    {joinLoading ? <CircularProgress size={14} color="inherit" /> : "워크스페이스 참가하기"}
                </Button>
            ) : null}
        </Box>
    );
}
