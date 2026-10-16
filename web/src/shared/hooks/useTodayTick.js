import { useEffect, useState } from "react";

/**
 * 자정을 넘기면 갱신되는 "오늘" Date.
 *
 * 왜 필요한가: 화면 곳곳이 렌더 시점의 `new Date()`(또는 마운트 시점에 고정한 값)로
 * 오늘을 판단한다. 페이지를 켜 둔 채 자정을 넘기면 **어제가 계속 오늘로 표시된다.**
 * 캘린더에 같은 로직이 인라인으로 들어 있었는데, 구현이 두 벌이면 한쪽만 고쳐진다.
 *
 * 두 가지를 함께 처리한다.
 *  - 다음 자정에 정확히 한 번 깨어난다(주기적 폴링이 아니다).
 *  - 탭이 백그라운드거나 기기가 절전이면 setTimeout 이 제때 깨지 않는다.
 *    화면이 다시 보이는 순간에도 날짜가 넘어갔는지 확인한다.
 *
 * 날짜가 실제로 바뀐 경우에만 새 Date 를 심어 불필요한 리렌더를 막는다.
 */
export function useTodayTick() {
    const [today, setToday] = useState(() => new Date());

    useEffect(() => {
        let timer;
        const isSameCalendarDay = (a, b) =>
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();

        const scheduleNext = () => {
            clearTimeout(timer);
            const now = new Date();
            const msUntilMidnight =
                new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
            timer = setTimeout(tick, msUntilMidnight + 100);
        };
        const tick = () => {
            setToday((prev) => (isSameCalendarDay(prev, new Date()) ? prev : new Date()));
            scheduleNext();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") tick();
        };

        scheduleNext();
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    return today;
}
