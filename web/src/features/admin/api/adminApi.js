import api from "../../../shared/api/axiosInstance.js";

/*
 * 백오피스 API.
 * 관리자 토큰(OTP 확인 뒤 30분)은 sessionStorage 에 둔다 — 탭을 닫으면 사라지고,
 * 일반 로그인 토큰(localStorage)과 섞이지 않는다.
 */
const KEY = "plando.adminToken";

export const adminToken = {
    get() {
        try {
            const raw = sessionStorage.getItem(KEY);
            if (!raw) return null;
            const t = JSON.parse(raw);
            return new Date(t.expiresAt) > new Date() ? t : null;
        } catch {
            return null;
        }
    },
    set(t) {
        try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch { /* 저장 못 해도 이번 화면에선 동작 */ }
    },
    clear() {
        try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
    },
};

const withAdmin = () => ({ headers: { "X-Admin-Token": adminToken.get()?.token ?? "" } });

export const isStepUpError = (err) => err?.response?.data?.code === "ADMIN_STEP_UP";

export const adminApi = {
    // 인증 (일반 로그인만 필요)
    status: () => api.get("/admin/auth/status").then((r) => r.data),
    startEnroll: () => api.post("/admin/auth/enroll").then((r) => r.data),
    confirmEnroll: (code) => api.post("/admin/auth/enroll/confirm", { code }).then((r) => r.data),
    verify: (code) => api.post("/admin/auth/verify", { code }).then((r) => r.data),

    // OTP 토큰 필요
    stats: () => api.get("/admin/stats", withAdmin()).then((r) => r.data),
    overview: (days = 30) => api.get("/admin/overview", { ...withAdmin(), params: { days } }).then((r) => r.data),
    reports: (status, page = 0) =>
        api.get("/admin/reports", { ...withAdmin(), params: { status, page, size: 20 } }).then((r) => r.data),
    resolve: (id, action, note) => api.post(`/admin/reports/${id}/resolve`, { action, note }, withAdmin()),
    restoreRecruitment: (id, reason) => api.post(`/admin/recruitments/${id}/restore`, { reason }, withAdmin()),
    users: (q, page = 0) => api.get("/admin/users", { ...withAdmin(), params: { q, page, size: 20 } }).then((r) => r.data),
    suspend: (id, reason) => api.post(`/admin/users/${id}/suspend`, { reason }, withAdmin()),
    unsuspend: (id, reason) => api.post(`/admin/users/${id}/unsuspend`, { reason }, withAdmin()),
    audit: (page = 0) => api.get("/admin/audit-logs", { ...withAdmin(), params: { page, size: 30 } }).then((r) => r.data),
};

/* 화면에 쓰는 이름표 — 서버 enum 값 → 한국어 */
export const LABEL = {
    reason: { SPAM: "스팸·광고", ABUSE: "욕설·괴롭힘", SEXUAL: "음란물", ILLEGAL: "불법", PRIVACY: "개인정보 노출", OTHER: "기타" },
    target: { RECRUITMENT: "모집글", QUESTION: "Q&A", USER: "사용자" },
    status: { OPEN: "대기", RESOLVED: "처리", DISMISSED: "기각" },
    resolution: { HIDE_CONTENT: "숨김", SUSPEND_USER: "정지", DISMISS: "기각" },
    action: {
        ADMIN_LOGIN: "관리자 로그인",
        TOTP_ENROLLED: "OTP 등록",
        CONTENT_HIDDEN: "콘텐츠 숨김",
        CONTENT_RESTORED: "숨김 해제",
        REPORT_DISMISSED: "신고 기각",
        USER_SUSPENDED: "계정 정지",
        USER_UNSUSPENDED: "정지 해제",
    },
};

/** 2026.10.16 14:05 */
export const fmt = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
