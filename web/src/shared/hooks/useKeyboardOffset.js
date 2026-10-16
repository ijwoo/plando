import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * 키보드 높이를 반환하는 훅.
 * - Native(Capacitor): @capacitor/keyboard 이벤트 기반 (정확)
 * - 브라우저: visualViewport 기반 (fallback)
 */
export function useKeyboardOffset() {
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            // Capacitor 네이티브: Keyboard 플러그인 이벤트 사용
            let showListener, hideListener;

            import("@capacitor/keyboard").then(({ Keyboard }) => {
                Keyboard.addListener("keyboardWillShow", (info) => {
                    setOffset(info.keyboardHeight);
                }).then((l) => { showListener = l; });

                Keyboard.addListener("keyboardWillHide", () => {
                    setOffset(0);
                }).then((l) => { hideListener = l; });
            });

            return () => {
                showListener?.remove();
                hideListener?.remove();
            };
        } else {
            // 브라우저 fallback: visualViewport
            const vv = window.visualViewport;
            if (!vv) return;

            const update = () => {
                const kbH = window.innerHeight - vv.height - vv.offsetTop;
                setOffset(Math.max(0, kbH));
            };

            vv.addEventListener("resize", update);
            vv.addEventListener("scroll", update);
            return () => {
                vv.removeEventListener("resize", update);
                vv.removeEventListener("scroll", update);
            };
        }
    }, []);

    return offset;
}
