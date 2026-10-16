import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";

import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { finalizeAuthSession } from "../utils/authSession.js";

export default function OAuthCallbackPage() {
    const navigate = useNavigate();
    const { loadWorkspaces } = useWorkspace();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const token = searchParams.get("token");
        const isNew = searchParams.get("isNew") === "true";

        if (!token) {
            // 토큰 없이 도착 = 사용자 거부 / 백엔드 오류. 사유가 쿼리로 오면 함께 표시.
            const reason = searchParams.get("error_description") || searchParams.get("message") || searchParams.get("error");
            navigate("/login", {
                replace: true,
                state: {
                    oauthError: reason
                        ? `카카오 로그인에 실패했어요. (${reason})`
                        : "카카오 로그인에 실패했어요. 다시 시도해주세요.",
                },
            });
            return;
        }

        // 토큰을 URL에서 즉시 제거 (히스토리/로그/Referrer 노출 방지)
        window.history.replaceState(null, "", window.location.pathname + window.location.hash.split("?")[0]);

        const inviteCode = sessionStorage.getItem("oauthInviteCode");
        if (inviteCode) sessionStorage.removeItem("oauthInviteCode");

        (async () => {
            const defaultRoute = await finalizeAuthSession({
                accessToken: token,
                rememberMe: true,
                isNew,
                inviteCode,
                autoCreateWorkspace: true,
                loadWorkspaces,
            });
            navigate(defaultRoute, { replace: true });
        })();
    }, []);

    return (
        <Box display="flex" justifyContent="center" alignItems="center" height="100dvh">
            <CircularProgress />
        </Box>
    );
}
