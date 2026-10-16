import { useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

// 로그인 화면(LoginPage)이 navigate state로 받아 안내하는 만료 사유
export const SESSION_EXPIRED_MESSAGE = "세션이 만료됐어요. 다시 로그인해주세요.";

const ProtectedRoute = ({ children }) => {
    const { isLoggedIn, isLoading, sessionExpired } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // replace: true — 뒤로가기로 만료된 화면에 되돌아가 리다이렉트가 반복되지 않게
        const handleExpired = () => navigate("/login", { replace: true, state: { authError: SESSION_EXPIRED_MESSAGE } });
        window.addEventListener(APP_EVENTS.SESSION_EXPIRED, handleExpired);
        return () => window.removeEventListener(APP_EVENTS.SESSION_EXPIRED, handleExpired);
    }, [navigate]);

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100dvh" }}>
                <CircularProgress />
            </Box>
        );
    }

    // 토큰이 만료돼서 튕긴 경우에만 사유 전달 — 로그인한 적 없는 방문은 조용히 이동
    return isLoggedIn
        ? children
        : <Navigate to="/login" replace state={sessionExpired ? { authError: SESSION_EXPIRED_MESSAGE } : undefined} />;
};

export default ProtectedRoute;
