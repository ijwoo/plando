import { alpha, getContrastRatio } from "@mui/material/styles";
import { isAndroid } from "../utils/platformUtils.js";
export { isAndroid };

/**
 * ⚠️ 이 파일의 헬퍼들은 모두 **MUI theme 객체**를 받는다 (과거엔 isDark boolean).
 * 앱은 7개 named 테마 + custom = 8개 모드를 지원하는데, isDark 분기는 이를 2개로
 * 뭉개서 pink/lavender/mint/midnight/ocean/custom 이 전부 light/dark 색을 쓰고 있었다.
 * 색은 반드시 theme.palette 에서 파생시킬 것. 새 hex 리터럴 추가 금지.
 */

/** theme 인자 방어 — 혹시 남은 boolean 호출이 있어도 앱이 죽지 않게. */
function pal(theme) {
    return theme?.palette ?? null;
}
function isDarkTheme(theme) {
    return pal(theme) ? theme.palette.mode === "dark" : Boolean(theme);
}

export function blurSx(blur = "blur(20px)") {
    if (isAndroid) return {};
    return { backdropFilter: blur, WebkitBackdropFilter: blur };
}

/**
 * 스크롤바 숨김 공용 sx — 여러 파일에 흩어진 동일 패턴 통합.
 * 사용: sx={{ overflowY: "auto", ...hideScrollbarSx }}
 */
export const hideScrollbarSx = {
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "&::-webkit-scrollbar": { display: "none" },
};

/**
 * 모바일 웹 전 화면의 루트 배경. 색의 출처는 **활성 테마의 background.default** 이며,
 * 다크 계열에서만 미세한 흰색 sheen 그라데이션을 그 위에 레이어로 얹는다.
 * (그라데이션이 색의 출처가 되면 테마별 배경이 무시되므로 반드시 오버레이로 유지)
 */
export function getMobilePageBg(theme) {
    const p = pal(theme);
    const bg = p?.background?.default ?? "#F5F6F8";
    if (!isDarkTheme(theme)) return bg;
    const white = p?.common?.white ?? "#FFFFFF";
    const sheen = alpha(white, 0.016);
    const clear = alpha(white, 0);
    return `linear-gradient(145deg, ${clear} 0%, ${sheen} 50%, ${clear} 100%), ${bg}`;
}

export function getGlassSx(theme, override = {}) {
    const p = pal(theme);
    const dark = isDarkTheme(theme);
    const paper = p?.background?.paper ?? "#FFFFFF";
    const white = p?.common?.white ?? "#FFFFFF";
    const blurProps = isAndroid ? {} : {
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
    };
    return {
        bgcolor: dark
            ? isAndroid ? alpha(paper, 0.97) : alpha(white, 0.04)
            : paper,
        ...blurProps,
        border: "none",
        boxShadow: "none",
        ...override,
    };
}

/** Android는 blur를 못 써서 반투명 solid로 대체 — 색은 테마 배경에서 파생. */
export function getAndroidSolidBg(theme) {
    const p = pal(theme);
    const bg = p?.background?.default ?? (isDarkTheme(theme) ? "#0A0A0F" : "#F5F6F8");
    return alpha(bg, isDarkTheme(theme) ? 0.97 : 0.98);
}

export function getMenuGlassSx(theme) {
    const p = pal(theme);
    const dark = isDarkTheme(theme);
    const paper = p?.background?.paper ?? "#FFFFFF";
    const text = p?.text?.primary ?? (dark ? "#E8EAED" : "#0F172A");
    return {
        background: alpha(paper, 0.97),
        ...blurSx("blur(40px)"),
        border: `1px solid ${alpha(text, dark ? 0.08 : 0.12)}`,
        // 그림자는 hue가 아니라 depth 토큰 — mode 기준 유지 (테마별로 바뀌면 안 됨)
        boxShadow: dark
            ? "0 16px 48px rgba(0,0,0,0.6)"
            : "0 8px 32px rgba(0,0,0,0.12)",
        backgroundImage: "none",
        overflow: "hidden",
    };
}

/**
 * 채워진 primary 표면 위 글자색. 흰 글씨 대비가 3:1 미만일 때만 어두운 글자로 전환.
 * (MUI 기본 contrastThreshold=3 은 라이트 primary에서 곧바로 검은 글씨로 뒤집혀
 *  기존 다크 테마 룩을 바꿔버리므로, 흰 글씨 우선 + 실패 시에만 폴백)
 */
function safeContrastText(bg, white = "#FFFFFF") {
    try {
        return getContrastRatio(bg, white) >= 3 ? white : "rgba(0,0,0,0.87)";
    } catch {
        return white;
    }
}

/**
 * DM 전용 색 토큰. 예전엔 theme.js의 light/dark 팔레트를 그대로 복사해 둬서
 * DM 기능 전체가 선택된 테마를 무시했다. 이제 전부 theme.palette 파생.
 */
export function getDmColors(theme) {
    const p = pal(theme);
    const dark = isDarkTheme(theme);
    const paper = p?.background?.paper ?? "#FFFFFF";
    const bg = p?.background?.default ?? "#F5F6F8";
    const textPrimary = p?.text?.primary ?? (dark ? "#E8EAED" : "#0F172A");
    const textSecondary = p?.text?.secondary ?? (dark ? "#9AA0A6" : "#475569");
    const white = p?.common?.white ?? "#FFFFFF";
    const primary = p?.primary ?? { main: "#1976D2", dark: "#1565C0" };
    // 내 말풍선: 다크는 primary.dark(기존 #4A8FE2와 동일), 라이트는 primary.main
    const myBubble = (dark ? primary.dark : primary.main) ?? primary.main;
    return {
        myBubble,
        /**
         * 말풍선 위 글자색. named 테마 8종은 전부 흰 글씨가 유지되지만(기존 룩 보존),
         * custom 테마에서 사용자가 밝은 primary를 고르면 흰 글씨 대비가 무너지므로
         * 그때만 어두운 글자로 자동 전환한다. (MUI contrastText는 primary.main 기준이라
         * primary.dark를 쓰는 다크 말풍선에서 오판 → 실제 말풍선 색으로 직접 계산)
         */
        myBubbleText:  safeContrastText(myBubble, white),
        theirBubble:   alpha(textPrimary, dark ? 0.07 : 0.05),
        inputCardBg:   alpha(paper, dark ? 0.88 : 0.85),
        headerBg:      alpha(bg, dark ? 0.95 : 0.92),
        pageBg:        bg,
        textPrimary,
        textSecondary,
        textDisabled:  alpha(textPrimary, dark ? 0.28 : 0.45),
        iconColor:     alpha(textPrimary, dark ? 0.40 : 0.62),
        primaryColor:  primary.main,
    };
}

export function fadeDividerSx(color, direction = "top") {
    return {
        backgroundImage: `linear-gradient(to right, transparent, ${color} 15%, ${color} 85%, transparent)`,
        backgroundSize: "100% 1px",
        backgroundRepeat: "no-repeat",
        backgroundPosition: direction,
    };
}
