import { useEffect, useRef } from "react";

/**
 * date prop 변경 시 컨테이너에 슬라이드 인 애니메이션 적용.
 * Web Animations API 사용 — re-mount 없이 동작, 스크롤 위치 유지.
 *
 * @param {React.RefObject} ref  애니메이션 적용할 DOM
 * @param {Date|number} date     변경 감지 대상
 */
export default function useDateSlideAnim(ref, date) {
    const prevRef = useRef(null);

    useEffect(() => {
        const key = date instanceof Date ? date.getTime() : date;
        if (prevRef.current === null) {
            prevRef.current = key;
            return;
        }
        if (prevRef.current === key) return;

        const dir = key > prevRef.current ? 1 : -1;
        prevRef.current = key;

        const el = ref.current;
        if (!el || !el.animate) return;

        el.animate(
            [
                { transform: `translateX(${dir > 0 ? 24 : -24}px)`, opacity: 0.2 },
                { transform: "translateX(0)", opacity: 1 },
            ],
            {
                duration: 260,
                easing: "cubic-bezier(0.32, 0.72, 0, 1)",
                fill: "none",
            },
        );
    }, [date]);
}
