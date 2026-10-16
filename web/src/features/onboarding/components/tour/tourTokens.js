import { alpha } from "@mui/material/styles";
import { readableOn } from "../../../../shared/ui/tone.js";

/**
 * 데스크탑 온보딩 투어의 미니 목업 전용 색 토큰.
 *
 * 스크린샷 이미지를 쓰지 않는 이유 — UI가 계속 리디자인 중이라 캡쳐가 금방 낡고,
 * 앱이 8개 테마 모드(light/dark/pink/lavender/midnight/mint/ocean/custom)를 지원해서
 * 래스터 에셋은 활성 테마와 반드시 충돌한다. 대신 ThemePreview.jsx와 같은 방식으로
 * **테마 토큰만으로 앱 화면 축소판을 그린다.**
 *
 * ⚠️ 여기서 파생되지 않는 새 hex 리터럴을 목업 안에 쓰지 말 것.
 */
export function getTourTokens(theme) {
    const p = theme.palette;
    const dark = p.mode === "dark";
    const ink = p.text.primary;

    return {
        dark,

        /* 미니 앱 창 */
        frameBg: dark ? alpha(p.background.default, 0.72) : p.background.paper,
        frameBorder: alpha(ink, dark ? 0.12 : 0.09),
        /* 겹친 아바타 링처럼 불투명해야 하는 자리 (frameBg는 다크에서 반투명) */
        solid: p.background.paper,

        /* 창 안쪽 표면 (컬럼 배경 / 카드 / 셀) */
        surface: alpha(ink, dark ? 0.05 : 0.032),
        surfaceStrong: alpha(ink, dark ? 0.09 : 0.055),
        border: alpha(ink, dark ? 0.10 : 0.07),

        /* 텍스트 자리를 대신하는 바 */
        bar: alpha(ink, dark ? 0.30 : 0.24),
        barSoft: alpha(ink, dark ? 0.17 : 0.13),
        barFaint: alpha(ink, dark ? 0.10 : 0.075),

        accent: p.primary.main,
        accentSoft: alpha(p.primary.main, dark ? 0.26 : 0.15),
        accentFaint: alpha(p.primary.main, dark ? 0.14 : 0.08),
        onAccent: readableOn(p.primary.main),

        text: ink,
        text2: p.text.secondary,
        text3: alpha(ink, dark ? 0.42 : 0.48),
    };
}

/** 목업 안 미니 카드 공통 sx. */
export function mockCardSx(k) {
    return {
        bgcolor: k.dark ? k.surfaceStrong : k.frameBg,
        border: `1px solid ${k.border}`,
        borderRadius: "var(--plando-radius-sm)",
        boxShadow: "var(--plando-elev-3)",
    };
}
