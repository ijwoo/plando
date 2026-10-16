import api from "../../../shared/api/axiosInstance.js";

// 로그인
export const login = async (payload) => {
    const response = await api.post("/auth/login", payload);
    return response.data;
};

// 회원가입
export const signup = async (payload) => {
    const response = await api.post("/auth/signup", payload);
    return response.data;
};

// 게스트 로그인
export const guestLogin = async () => {
    const response = await api.post("/auth/guest");
    return response.data;
};

// 비밀번호 재설정 메일 발송
export const forgotPassword = async (email) => {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data;
};

// 비밀번호 재설정
export const resetPassword = async (token, newPassword) => {
    const response = await api.post("/auth/reset-password", { token, newPassword });
    return response.data;
};

// 현재 로그인 사용자 (이메일 + 이메일 인증 여부) — 미인증 안내 배너 판단용
export const getAuthMe = async () => {
    const response = await api.get("/auth/me");
    return response.data;
};

// 이메일 인증 완료 (메일 링크의 토큰) — 비로그인 상태(다른 브라우저)에서도 호출 가능
export const verifyEmail = async (token) => {
    const response = await api.post("/auth/verify-email", { token });
    return response.data;
};

// 인증 메일 재발송 — 서버가 3분 쿨다운을 처리하므로 200이어도 실제 발송은 생략될 수 있다
export const resendVerificationEmail = async () => {
    const response = await api.post("/auth/verify-email/resend");
    return response.data;
};

// Apple 로그인
export const appleLogin = async (identityToken, firstName, lastName) => {
    const response = await api.post("/auth/apple", { identityToken, firstName, lastName });
    return response.data;
};