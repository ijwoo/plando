import axios from "axios";
import { getToken, removeToken } from "../utils/tokenUtils.js";
import { APP_EVENTS } from "../constants/events.js";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL
        ? `${import.meta.env.VITE_API_BASE_URL}/api`
        : "/api",
    withCredentials: true,
});

api.interceptors.request.use(
    (config) => {
        const token = getToken();
        const workspaceId = localStorage.getItem("currentWorkspaceId");

        config.headers = config.headers || {};

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (workspaceId) {
            config.headers["X-Workspace-Id"] = workspaceId;
        }

        // PWA standalone 모드에서 GET 응답이 캐시되는 문제 방지
        if (!config.method || config.method.toLowerCase() === "get") {
            config.headers["Cache-Control"] = "no-cache";
            config.headers["Pragma"] = "no-cache";
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// 응답 인터셉터: 401 → 로그인 리다이렉트, 백엔드 { message } 필드를 error.userMessage로 노출
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401 && getToken()) {
            removeToken();
            window.dispatchEvent(new Event(APP_EVENTS.SESSION_EXPIRED));
        }
        const serverMessage = error?.response?.data?.message;
        if (serverMessage === "GUEST_NOT_ALLOWED") {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.GUEST_BLOCK_REQUEST));
            error.handled = true;
            error.userMessage = "";
            return Promise.reject(error);
        }
        if (serverMessage) {
            error.userMessage = serverMessage;
        }
        return Promise.reject(error);
    }
);

/**
 * 백엔드가 문구 대신 **고정 코드**로 내려주는 에러 → 사용자 문구.
 * (클라이언트가 분기할 수 있게 코드로 오는 것들이라 그대로 노출하면 안 된다)
 */
const ERROR_CODE_MESSAGES = {
    // 초대코드로 워크스페이스 참여 — 이메일 미인증이면 서버가 403 EMAIL_NOT_VERIFIED
    EMAIL_NOT_VERIFIED: "이메일 인증을 완료해야 팀에 참여할 수 있어요. 메일함에서 인증 링크를 확인해주세요.",
};

/** 에러 객체에서 사용자에게 보여줄 메시지 추출 */
export const getApiError = (err, fallback = "오류가 발생했습니다.") => {
    if (err?.handled) return "";
    const msg = err?.userMessage || err?.response?.data?.message;
    if (msg && ERROR_CODE_MESSAGES[msg]) return ERROR_CODE_MESSAGES[msg];
    return msg && msg !== "GUEST_NOT_ALLOWED" ? msg : fallback;
};

export default api;
