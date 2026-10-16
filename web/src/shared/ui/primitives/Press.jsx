import { motion } from "framer-motion";
import { hapticLight, hapticMedium } from "../../utils/haptics.js";
import { PRESS_TWEEN } from "./motion.js";

/* ─────────────────────────────────────────────────────────────
   탭 가능한 모든 요소(버튼/카드/리스트 아이템)를 감싸는 wrapper.
   - 누름 시 scale-down 마이크로 인터랙션
   - 네이티브에서만 햅틱 (web/PWA에서는 hapticLight가 no-op)
   - 기본 button semantics 유지: role="button", keyboard 접근, disabled 처리

   사용 예:
     <Press onClick={...}>
       <Card>...</Card>
     </Press>

   ─ as: 렌더할 motion 컴포넌트 (기본 div). 의미상 button이 맞으면 "button" 전달
   ─ haptic: "light" | "medium" | false (기본 "light")
   ─ pressScale: 0~1 (기본 0.97)

   주의: motion 요소는 MUI sx를 지원하지 않음. 스타일이 필요하면 style prop을 쓰거나
         children에 MUI Box를 넣고 그 위를 Press로 감싸세요.
   ───────────────────────────────────────────────────────────── */
export default function Press({
    as = "div",
    children,
    onClick,
    disabled = false,
    haptic = "light",
    pressScale = 0.97,
    activeBg,   // 누름 중 배경색 — 시각 피드백 강화 시 사용
    style,
    ...rest
}) {
    const Component = motion[as] || motion.div;

    const handleClick = (e) => {
        if (disabled) return;
        if (haptic === "light") hapticLight();
        else if (haptic === "medium") hapticMedium();
        onClick?.(e);
    };

    const handleKeyDown = (e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e);
        }
    };

    /**
     * whileTap 은 **backgroundColor** 를 애니메이션한다.
     * 그래서 style 에 단축 속성 `background` 로 기본 배경을 주면 되돌아갈 기준값이 없어
     * 탭이 끝나도 눌린 색이 남는다 — 탭 UI 에서 비활성 항목까지 선택된 것처럼 보인 적이 있다.
     * activeBg 를 쓸 때는 호출부도 `backgroundColor` 로 줄 것.
     */
    const tapAnim = disabled
        ? undefined
        : { scale: pressScale, ...(activeBg ? { backgroundColor: activeBg } : {}) };

    return (
        <Component
            role={as === "button" ? undefined : "button"}
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled || undefined}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            whileTap={tapAnim}
            transition={PRESS_TWEEN}
            style={{
                cursor: disabled ? "default" : "pointer",
                outline: "none",
                opacity: disabled ? 0.5 : 1,
                ...style,
            }}
            {...rest}
        >
            {children}
        </Component>
    );
}
