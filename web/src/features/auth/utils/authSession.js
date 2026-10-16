import { saveToken, saveUser, saveEmail, removeSavedEmail } from "../../../shared/utils/tokenUtils.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { getMySettings } from "../../settings/api/settingsApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { getMe } from "../../../shared/api/userApi.js";
import { joinWorkspace, createWorkspace } from "../../workspace/api/workspaceApi.js";
import { setWidgetLoggedIn } from "../../../shared/native/widgetSync.js";
import { toast } from "../../../shared/utils/toast.js";

/**
 * 로그인 / OAuth 콜백 / Apple 로그인 / 게스트 로그인 후 공통 후처리.
 *
 * 기존에 LoginPage / LoginPageMobile (각 3개 핸들러: email, Apple, guest) +
 * OAuthCallbackPage 에서 거의 동일하게 반복하던 ~30줄 보일러플레이트를 통합:
 *   1) saveToken (rememberMe 적용)
 *   2) (user 미지정 시) getMe() 로 fetch
 *   3) email "로그인 상태 유지" 저장/삭제
 *   4) getMySettings + localStorage 저장 + saveUser(profileImage 포함) + SETTINGS_CHANGED dispatch
 *   5) inviteCode 있으면 joinWorkspace, 없으면 (isNew && autoCreateWorkspace) 시 기본 워크스페이스 생성
 *   6) loadWorkspaces refresh
 *   7) defaultRoute 반환 (로그인 직후 진입 화면 — 기본 /dashboard)
 *
 * @param {Object} opts
 * @param {string} [opts.accessToken]            저장할 access token (이미 저장됐으면 null/undefined)
 * @param {boolean} [opts.rememberMe=false]      "로그인 상태 유지" — token 저장 위치 결정 + email 저장 여부
 * @param {{ name?: string, email?: string, id?: any }} [opts.user]  로그인 응답에서 받은 user. 없으면 getMe() 호출
 * @param {string|null} [opts.saveLoginEmail]    rememberMe=true 시 저장할 이메일 (이메일 폼에서만)
 * @param {boolean} [opts.isNew=false]           신규 가입자 (Apple / OAuth)
 * @param {string|null} [opts.inviteCode]        있으면 joinWorkspace 시도
 * @param {boolean} [opts.autoCreateWorkspace=false]  isNew && inviteCode 없을 때 기본 워크스페이스 자동 생성
 * @param {() => Promise<any>} [opts.loadWorkspaces]  workspace context refresh
 * @returns {Promise<string>} 진입할 defaultRoute 경로
 */
export async function finalizeAuthSession({
    accessToken,
    rememberMe = false,
    user = null,
    saveLoginEmail = null,
    isNew = false,
    inviteCode = null,
    autoCreateWorkspace = false,
    loadWorkspaces,
} = {}) {
    /* 1) token 저장 (이미 저장된 경우 skip) */
    if (accessToken) {
        saveToken(accessToken, rememberMe);
    }

    /* 3) email 저장/삭제 (이메일 로그인만) */
    if (saveLoginEmail != null) {
        if (rememberMe) saveEmail(saveLoginEmail);
        else removeSavedEmail();
    }

    /* 2) user 미지정 시 fetch */
    let resolvedUser = user;
    if (!resolvedUser) {
        try {
            const meRes = await getMe();
            const me = meRes.data ?? {};
            resolvedUser = { name: me.name ?? "", email: me.email ?? "", id: me.id ?? null };
        } catch (e) {
            console.error("getMe 실패:", e);
            resolvedUser = { name: "", email: "", id: null };
        }
    } else {
        // 부분 user → 기본값 채움
        resolvedUser = {
            name: resolvedUser.name ?? "",
            email: resolvedUser.email ?? "",
            id: resolvedUser.id ?? null,
        };
    }

    /* user 1차 저장 (profileImageUrl 없는 상태) */
    saveUser(resolvedUser);

    /* 4) settings + localStorage + saveUser 재저장 + SETTINGS_CHANGED */
    let defaultRoute = "/dashboard";
    try {
        const settingsRes = await getMySettings();
        const data = settingsRes.data ?? {};
        localStorage.setItem("settings.themeMode", data.themeMode || "light");
        localStorage.setItem("settings.sidebarCollapsed", String(data.sidebarCollapsed ?? false));
        localStorage.setItem("settings.calendarDefaultView", data.calendarDefaultView || "month");
        localStorage.setItem("settings.defaultDue", data.defaultDue || "none");
        saveUser({ ...resolvedUser, profileImageUrl: data.profileImageUrl ?? "" });
        window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
    } catch (e) {
        console.error("로그인 후 설정 조회 실패:", e);
    }

    /* 5) workspace 처리 (invite > autoCreate) */
    let inviteJoinFailed = false;
    let inviteJoinError = null;
    if (inviteCode) {
        try { await joinWorkspace({ inviteCode }); }
        catch (e) {
            console.error("초대코드 참여 실패:", e);
            inviteJoinFailed = true;
            // 서버가 이유를 준 경우(이메일 미인증 등)는 "코드가 잘못되었어요" 대신 그 이유를 알린다
            inviteJoinError = e;
        }
    }
    // 초대코드가 없거나 참여에 실패한 경우, 신규 유저가 워크스페이스 0개로 남지 않도록
    // 기본 워크스페이스 자동 생성으로 fall through
    if ((!inviteCode || inviteJoinFailed) && isNew && autoCreateWorkspace) {
        try {
            await createWorkspace({ name: `${resolvedUser.name || "내"}의 워크스페이스` });
        } catch (e) {
            console.error("기본 워크스페이스 생성 실패:", e);
        }
    }

    /* 6) loadWorkspaces refresh */
    if (loadWorkspaces) {
        try { await loadWorkspaces(); }
        catch (e) { console.error("워크스페이스 조회 실패:", e); }
    }

    /* 7) iOS 위젯 — 로그인 상태 갱신. 실제 todo push 는 useWidgetSync 가 마운트 시 처리. */
    setWidgetLoggedIn(true).catch(() => {});

    /* 초대코드 참여 실패 알림 — 토스트 리스너(Layout)는 로그인 후 화면에서 마운트되므로
       내비게이션이 끝난 뒤 발화되도록 지연시킨다. (호출부는 이 함수 resolve 직후 navigate) */
    if (inviteJoinFailed) {
        setTimeout(() => {
            toast.error(getApiError(
                inviteJoinError,
                "초대코드로 워크스페이스에 참여하지 못했어요. 코드가 만료되었거나 잘못되었을 수 있어요.",
            ));
        }, 600);
    }

    return defaultRoute;
}
