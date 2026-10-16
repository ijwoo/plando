import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "plando_onboarded";        // localStorage — 영구 ("다시 보지 않기")
const SNOOZE_KEY = "plando_onboarding_snoozed"; // sessionStorage — 이번 방문에만 ("건너뛰기")
const DONE_EVENT = "plando_onboarded_done";

/** 온보딩을 지금 보여줘야 하는지. 영구 완료도, 이번 방문 스누즈도 없을 때만 true. */
function shouldShowWelcome() {
    try {
        if (localStorage.getItem(STORAGE_KEY)) return false;
        if (sessionStorage.getItem(SNOOZE_KEY)) return false;
        return true;
    } catch {
        // 프라이빗 모드 등 스토리지 접근 불가 — 온보딩으로 막지 않는다.
        return false;
    }
}

export default function useWelcomeFlow() {
    const [showWelcome, setShowWelcome] = useState(shouldShowWelcome);

    useEffect(() => {
        const handler = () => setShowWelcome(shouldShowWelcome());
        window.addEventListener(DONE_EVENT, handler);
        return () => window.removeEventListener(DONE_EVENT, handler);
    }, []);

    /** 온보딩 완료/영구 숨김 — 다시는 보여주지 않는다. */
    const completeWelcome = useCallback(() => {
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
        setShowWelcome(false);
        window.dispatchEvent(new Event(DONE_EVENT));
    }, []);

    /** 이번 방문에만 닫기 — 탭을 새로 열면 다시 보여준다. (데스크탑 모달의 "건너뛰기") */
    const snoozeWelcome = useCallback(() => {
        try { sessionStorage.setItem(SNOOZE_KEY, "1"); } catch { /* noop */ }
        setShowWelcome(false);
        window.dispatchEvent(new Event(DONE_EVENT));
    }, []);

    return { showWelcome, completeWelcome, snoozeWelcome };
}
