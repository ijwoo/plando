import { useEffect, useRef } from "react";

/**
 * 창이 다시 포커스될 때 조용히 재조회한다.
 *
 * 실시간 브로드캐스트(useGlobalStomp)가 있어도 이게 필요하다 — 소켓이 끊겨 있던 동안의
 * 변경은 받지 못하고, 재연결해도 그 공백은 채워지지 않는다. 탭을 다시 볼 때 한 번 맞춰주면
 * "내가 보고 있는 화면은 최신"이 실시간 실패와 무관하게 보장된다.
 *
 * 스로틀: 탭을 자주 오가는 사용자가 매번 전체 목록을 다시 받으면 낭비다.
 * 마지막 조회로부터 MIN_INTERVAL 이내면 건너뛴다.
 */
const MIN_INTERVAL_MS = 30_000;

export function useRefetchOnFocus(refresh, enabled = true) {
    const lastRef = useRef(Date.now());

    useEffect(() => {
        if (!enabled || typeof refresh !== "function") return undefined;

        const maybeRefresh = () => {
            // 탭이 실제로 보이는 상태일 때만 — 백그라운드 탭까지 갱신할 이유가 없다
            if (document.visibilityState !== "visible") return;
            const now = Date.now();
            if (now - lastRef.current < MIN_INTERVAL_MS) return;
            lastRef.current = now;
            refresh();
        };

        window.addEventListener("focus", maybeRefresh);
        document.addEventListener("visibilitychange", maybeRefresh);
        return () => {
            window.removeEventListener("focus", maybeRefresh);
            document.removeEventListener("visibilitychange", maybeRefresh);
        };
    }, [refresh, enabled]);
}
