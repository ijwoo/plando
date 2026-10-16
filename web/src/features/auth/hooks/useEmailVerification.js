import { useCallback, useEffect, useState } from "react";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { isGuestEmail } from "../../../shared/utils/guestUtils.js";
import { getToken } from "../../../shared/utils/tokenUtils.js";
import { toast } from "../../../shared/utils/toast.js";
import { getAuthMe, resendVerificationEmail } from "../api/authApi.js";

/** 배너 닫기는 이 브라우저 세션 동안만 유지 — 새 세션에는 다시 안내한다 */
const DISMISS_KEY = "emailVerifyBannerDismissed";

/**
 * 이메일 인증 상태 + 안내 배너 제어.
 *
 * 정책: 미인증이어도 로그인·개인 사용은 모두 허용한다. 초대코드로 팀 워크스페이스에
 * 참여할 때만 서버가 막는다(403 EMAIL_NOT_VERIFIED). 그래서 UI를 잠그지 않고
 * 이 배너로만 인증을 유도한다.
 *
 * 인증 여부는 GET /auth/me 만 알고 있다(/users/me 응답에는 없음).
 * 배너(EmailVerifyBanner)가 유일한 소비자이므로 조회도 이 훅 한 곳에서만 한다.
 */
export default function useEmailVerification() {
    // null = 아직 모름 (응답 전에는 배너를 띄우지 않아 깜빡임이 없다)
    const [me, setMe] = useState(null);
    const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");
    const [resending, setResending] = useState(false);

    const [token, setToken] = useState(() => getToken());
    const loggedIn = !!token;

    const load = useCallback(() => {
        if (!loggedIn) return;
        getAuthMe()
            .then((data) => setMe(data ?? null))
            .catch(() => {
                // 조회 실패 시엔 배너를 띄우지 않는다 (미인증으로 오탐하지 않도록)
            });
    }, [loggedIn]);

    useEffect(() => { load(); }, [load]);

    /**
     * 계정이 바뀌면 다시 조회한다.
     *
     * 이게 없으면 SPA 안에서 로그아웃 후 다른 계정으로 들어와도 이전 계정의 상태가 남는다.
     * 실제로 미인증 계정에서 배너를 본 뒤 인증된 계정으로 전환했더니 배너가 그대로 떠 있었고,
     * '다시 받기'가 "이미 인증된 이메일" 400 을 맞았다.
     */
    useEffect(() => {
        const sync = () => {
            const next = getToken();
            setToken((prev) => {
                if (prev === next) return prev;
                setMe(null);            // 이전 계정 상태를 즉시 버린다
                return next;
            });
        };
        window.addEventListener(APP_EVENTS.SETTINGS_CHANGED, sync);
        window.addEventListener("storage", sync);   // 다른 탭에서 로그인/로그아웃
        window.addEventListener("focus", sync);
        return () => {
            window.removeEventListener(APP_EVENTS.SETTINGS_CHANGED, sync);
            window.removeEventListener("storage", sync);
            window.removeEventListener("focus", sync);
        };
    }, []);

    // 메일 링크는 다른 탭·다른 기기에서 열릴 수 있다 → 탭이 다시 보일 때 인증 여부 재확인
    useEffect(() => {
        if (!loggedIn) return;
        const onVisible = () => { if (document.visibilityState === "visible") load(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [loggedIn, load]);

    const dismiss = useCallback(() => {
        sessionStorage.setItem(DISMISS_KEY, "1");
        setDismissed(true);
    }, []);

    const resend = useCallback(async () => {
        setResending(true);
        try {
            await resendVerificationEmail();
            // 서버가 3분 쿨다운 중이면 실제로 보내지 않고도 200 — 양쪽에 다 맞는 문구로 안내
            toast.success("인증 메일을 보냈어요. 메일함을 확인해주세요.");
        } catch (e) {
            toast.error(getApiError(e, "인증 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요."));
        } finally {
            setResending(false);
        }
    }, []);

    return {
        email: me?.email ?? "",
        // 게스트 계정은 메일함이 없으니 안내하지 않는다. 소셜 로그인은 서버에서 인증 완료로 두므로 애초에 안 걸린다.
        show: me?.emailVerified === false && !isGuestEmail(me?.email) && !dismissed,
        resending,
        resend,
        dismiss,
    };
}
