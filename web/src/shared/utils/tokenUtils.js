const TOKEN_KEY = "accessToken";
const USER_KEY = "loginUser";
const SAVED_EMAIL_KEY = "savedEmail";

// remember=true → localStorage (세션 유지), false → sessionStorage (탭 닫으면 만료)
export const saveToken = (token, remember = true) => {
    if (remember) {
        localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.removeItem(TOKEN_KEY);
    } else {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.removeItem(TOKEN_KEY);
    }
};

// localStorage → sessionStorage 순으로 확인
export const getToken = () => {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
};

// 로그아웃 시 정리할 사용자 개인화 키 — 공용 기기에서 다음 사용자에게 노출되면 안 되는 것들.
// (settings.themeMode / taskListColumns / savedEmail 등 기기 UI 설정은 의도적으로 남김)
const PERSONAL_KEYS = [
    "plando.taskView",        // 마지막 할 일 뷰
];
const PERSONAL_KEY_PREFIXES = [
    "activeProject.",         // 워크스페이스별 프로젝트 스코프
    "plando.recentSearches",  // 최근 검색어 (워크스페이스별 키)
    "plando.recentTodos",     // 최근 본 할 일 (워크스페이스별 키, 제목 포함)
    "plando.chat.history",    // AI 대화 기록 — 대화 내용 자체가 남는다. 공용 기기에서
                              //  다음 사용자에게 남의 대화가 보이면 안 된다(실제로 그랬다).
    "plando.dash",            // 대시보드 개인화: dashBookmarks / dashStickies.* / dashFavProjects.* / dashboardGrid
                              //  → 공용 기기에서 다음 사용자(게스트 포함)에게 노출 방지. 서버(UserSettings)가 source of truth라 재하이드레이션됨.
];

// 로그아웃 시 양쪽 모두 삭제 + 워크스페이스 상태도 함께 정리.
// 워크스페이스 키가 남으면 다른 계정 재로그인 시 axios 인터셉터가 이전 X-Workspace-Id 를 그대로
// 보내 403 응답을 받게 됨 (WorkspaceContext 가 새 목록을 로드하기 전 첫 요청들이 실패).
export const removeToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("currentWorkspaceId");
    localStorage.removeItem("workspaces");
    try {
        PERSONAL_KEYS.forEach((k) => localStorage.removeItem(k));
        Object.keys(localStorage)
            .filter((k) => PERSONAL_KEY_PREFIXES.some((p) => k.startsWith(p)))
            .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    // iOS 위젯 정리 — 비 iOS / 비 native 환경에선 no-op. 동적 import 로 부트 시 순환 의존 방지.
    import("./../native/widgetSync.js")
        .then((m) => m.clearWidget?.().catch(() => {}))
        .catch(() => {});
};

export const saveUser = (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = () => {
    const user = localStorage.getItem(USER_KEY);
    if (!user) return null;
    try {
        return JSON.parse(user);
    } catch {
        return null;
    }
};

// 이메일 저장 (로그인 저장 체크 시)
export const saveEmail = (email) => {
    localStorage.setItem(SAVED_EMAIL_KEY, email);
};

export const getSavedEmail = () => {
    return localStorage.getItem(SAVED_EMAIL_KEY) || "";
};

export const removeSavedEmail = () => {
    localStorage.removeItem(SAVED_EMAIL_KEY);
};
