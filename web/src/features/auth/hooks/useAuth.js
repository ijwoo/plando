import { useEffect, useState, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import { getToken, removeToken } from "../../../shared/utils/tokenUtils.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

const CHECK_INTERVAL_MS = 60_000;

export function useAuth() {
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    // 토큰이 "있었는데" 만료·손상된 경우만 true — 애초에 로그인한 적 없는 방문과 구분해
    // 로그인 화면에서 만료 안내를 띄우기 위한 플래그.
    const [sessionExpired, setSessionExpired] = useState(false);

    const checkToken = useCallback(() => {
        const token = getToken();
        if (token) {
            try {
                const decoded = jwtDecode(token);
                const now = Date.now() / 1000;
                if (decoded.exp > now) {
                    setIsLoggedIn(true);
                    return true;
                }
            } catch { /* invalid token */ }
            setSessionExpired(true);
        }
        setIsLoggedIn(false);
        return false;
    }, []);

    useEffect(() => {
        checkToken();
        setIsLoading(false);

        const interval = setInterval(() => {
            if (!checkToken() && getToken()) {
                removeToken();
                // 하드 해시 리다이렉트 대신 이벤트 — ProtectedRoute가 만료 사유와 함께 /login으로 보냄
                window.dispatchEvent(new Event(APP_EVENTS.SESSION_EXPIRED));
            }
        }, CHECK_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [checkToken]);

    return { isLoggedIn, isLoading, sessionExpired };
}
