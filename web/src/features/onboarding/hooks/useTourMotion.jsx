import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";

/* ─────────────────────────────────────────────────────────────
   투어 모션 스위치.

   기본 동작은 그대로다 — OS가 prefers-reduced-motion: reduce를 보고하면 투어는
   애니메이션을 끄고 완성된 정적 상태를 그린다. 이 파일이 더하는 건 **사용자 본인이
   그 판단을 뒤집을 수 있는 길** 하나뿐이다.

   왜 필요한가:
   윈도우에서는 "성능 옵션 → 최적 성능으로 조정"이나 접근성의 애니메이션 스위치가
   같은 신호(reduce)를 내보낸다. 즉 reduce가 항상 "움직이면 어지럽다"를 뜻하지 않고,
   상당수는 "PC를 가볍게 쓰고 싶다"에 가깝다. OS 신호를 기본값으로 존중하되,
   보고 싶은 사람은 투어 안에서 한 번 눌러 켤 수 있게 한다.
   (반대 방향은 막는다 — reduce를 요청하지 않은 사용자에게는 토글 자체가 안 보이고,
    reduce를 요청한 사용자에게도 기본값은 여전히 '끔'이다.)

   선택은 localStorage에 남겨 투어를 다시 열어도 유지한다. 저장 실패(프라이빗 모드 등)는
   무시하고 메모리 상태로만 동작한다.
   ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = "plando.tour.playMotion";

const TourMotionContext = createContext(null);

function readStored() {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

export function TourMotionProvider({ children }) {
    // framer의 useReducedMotion은 초기 null을 반환할 수 있어 boolean으로 고정.
    const osReduced = useReducedMotion() === true;
    const [playMotion, setPlayMotion] = useState(readStored);

    const togglePlayMotion = useCallback(() => {
        setPlayMotion((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
            } catch { /* 저장 못 해도 이번 세션에서는 동작한다 */ }
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({
            // 투어 전체가 참조하는 최종 판정. OS가 reduce가 아니면 사용자 선택과 무관하게 false.
            reduced: osReduced && !playMotion,
            osReduced,
            playMotion,
            togglePlayMotion,
        }),
        [osReduced, playMotion, togglePlayMotion],
    );

    return <TourMotionContext.Provider value={value}>{children}</TourMotionContext.Provider>;
}

/**
 * 투어 안에서 쓰는 reduced 판정.
 * Provider 밖(투어 외 재사용 등)에서는 OS 신호를 그대로 따른다 — 기존 동작과 동일.
 */
export function useTourReduced() {
    const ctx = useContext(TourMotionContext);
    const osReduced = useReducedMotion() === true;
    return ctx ? ctx.reduced : osReduced;
}

/** 토글 UI 전용 — Provider가 없으면 null. */
export function useTourMotionControl() {
    return useContext(TourMotionContext);
}
