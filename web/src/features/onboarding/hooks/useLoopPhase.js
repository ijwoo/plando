import { useEffect, useState } from "react";

/**
 * 온보딩 목업 데모용 루프 드라이버 — 0..steps-1 을 interval 간격으로 순환한다.
 *
 * enabled=false (= prefers-reduced-motion) 이면 타이머를 아예 돌리지 않고
 * **마지막(=완성된) 단계에 고정**한다. 그래야 모션 없이도 "데모가 끝난 화면"이
 * 정적으로 보인다. (빈 화면으로 멈추면 안 됨)
 */
export default function useLoopPhase(steps, interval = 1800, enabled = true) {
    const [phase, setPhase] = useState(() => (enabled ? 0 : steps - 1));

    useEffect(() => {
        if (!enabled) {
            setPhase(steps - 1);
            return undefined;
        }
        setPhase(0);
        const id = setInterval(() => setPhase((p) => (p + 1) % steps), interval);
        return () => clearInterval(id);
    }, [steps, interval, enabled]);

    return phase;
}
