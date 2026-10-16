/* ─────────────────────────────────────────────────────────────
   재사용 spring/transition 프리셋. Framer Motion `transition` prop에 직접 전달.
   여기 정의된 것 외 ad-hoc spring은 작성하지 말고 필요시 새 프리셋 추가.
   ───────────────────────────────────────────────────────────── */

// 일반 UI: 페이지 전환, 카드 hover, 모달 진입 — 잔잔하고 자연스러운 느낌
export const SPRING_GENTLE = {
    type: "spring",
    stiffness: 320,
    damping: 32,
    mass: 0.9,
};

// 강조 인터랙션: bottom sheet drag-to-dismiss, FAB, 토글 — 살짝 튕기는 반응
export const SPRING_BOUNCY = {
    type: "spring",
    stiffness: 420,
    damping: 22,
    mass: 0.8,
};

// 누름 피드백: scale-down 같은 즉각 반응. spring보다 짧은 tween이 더 자연스러움
export const PRESS_TWEEN = {
    type: "tween",
    duration: 0.12,
    ease: [0.2, 0.8, 0.2, 1],
};

// 페이지 fade-in 등 부드러운 진입. plandoTokens.css의 --plando-dur-base/--plando-ease와 동일 곡선
export const FADE_IN = {
    type: "tween",
    duration: 0.22,
    ease: [0.2, 0.8, 0.2, 1],
};
