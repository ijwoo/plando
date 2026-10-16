import { createTheme, alpha } from "@mui/material/styles";

export const THEMES = [
    { key: "light",     label: "라이트",   color: "#F6F7FB", dot: "#94A3B8" },
    { key: "dark",      label: "다크",     color: "#0F1621", dot: "#90CAF9" },
    { key: "pink",      label: "핑크",     color: "#ffa7c4", dot: "#E879A0" },
    { key: "lavender",  label: "라벤더",   color: "#F5F3FF", dot: "#7C3AED" },
    { key: "midnight",  label: "미드나잇", color: "#0D0E1A", dot: "#818CF8" },
    { key: "mint",      label: "민트",     color: "#F0FDF8", dot: "#059669" },
    { key: "ocean",     label: "오션",     color: "#0A1628", dot: "#0891B2" },
];

function hexLighten(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = Math.round(r + (255 - r) * amount);
    const ng = Math.round(g + (255 - g) * amount);
    const nb = Math.round(b + (255 - b) * amount);
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

function hexDarken(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = Math.round(r * (1 - amount));
    const ng = Math.round(g * (1 - amount));
    const nb = Math.round(b * (1 - amount));
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/**
 * 사용자 커스텀 테마 — primaryColor + baseMode(light/dark) + bgColor 기반 자동 derivation.
 * cardColor가 주어지면 background.paper(카드 표면)을 그 값으로 override.
 */
export function buildCustomPalette(primaryColor, baseMode, bgColor, cardColor) {
    const light = hexLighten(primaryColor, 0.35);
    const dark  = hexDarken(primaryColor, 0.25);
    if (baseMode === "dark") {
        const bg = bgColor || "#0B0F14";
        const paper = cardColor || hexLighten(bg, 0.18);
        return {
            muiMode: "dark",
            primary:    { main: primaryColor, light, dark },
            background: { default: bg, paper },
            divider:    alpha(primaryColor, 0.15),
            text:       { primary: alpha("#FFFFFF", 0.92), secondary: alpha("#FFFFFF", 0.65) },
            action:     { hover: alpha(primaryColor, 0.08), selected: alpha(primaryColor, 0.14) },
            inputBg:    alpha(primaryColor, 0.05),
        };
    }
    const bg = bgColor || "#F6F7FB";
    const paper = cardColor || hexLighten(bg, 0.65);
    return {
        muiMode: "light",
        primary:    { main: primaryColor, light, dark },
        background: { default: bg, paper },
        divider:    alpha(primaryColor, 0.12),
        text:       { primary: alpha("#000000", 0.88), secondary: alpha("#000000", 0.55) },
        action:     { hover: alpha(primaryColor, 0.05), selected: alpha(primaryColor, 0.10) },
        inputBg:    alpha(primaryColor, 0.03),
    };
}

const PRETENDARD = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

const palettes = {
    light: {
        muiMode: "light",
        primary:    { main: "#1976D2", light: "#42A5F5", dark: "#1565C0" },
        background: { default: "#F5F6F8", paper: "#FFFFFF" },
        divider:    "#ECEEF2",
        text:       { primary: "#0F172A", secondary: "#475569" },
        action:     { hover: alpha("#000000", 0.04), selected: alpha("#1976D2", 0.08) },
        inputBg:    alpha("#000000", 0.03),
    },
    dark: {
        muiMode: "dark",
        primary:    { main: "#8AB4F8", light: "#AECBFA", dark: "#4A8FE2" },
        background: { default: "#0A0A0F", paper: "#131317" },
        divider:    "rgba(255,255,255,0.06)",
        text:       { primary: "#E8EAED", secondary: "#9AA0A6" },
        action:     { hover: alpha("#FFFFFF", 0.06), selected: alpha("#8AB4F8", 0.10) },
        inputBg:    alpha("#FFFFFF", 0.04),
    },
    pink: {
        muiMode: "light",
        primary:    { main: "#D63384", light: "#F06292", dark: "#AD1457" },
        background: { default: "#FDF4F7", paper: "#FFFFFF" },
        divider:    alpha("#D63384", 0.12),
        text:       { primary: alpha("#1A0010", 0.88), secondary: alpha("#1A0010", 0.55) },
        action:     { hover: alpha("#D63384", 0.05), selected: alpha("#D63384", 0.10) },
        inputBg:    alpha("#D63384", 0.03),
    },
    lavender: {
        muiMode: "light",
        primary:    { main: "#7C3AED", light: "#A78BFA", dark: "#5B21B6" },
        background: { default: "#F5F3FF", paper: "#FDFCFF" },
        divider:    alpha("#7C3AED", 0.12),
        text:       { primary: alpha("#0D0520", 0.88), secondary: alpha("#0D0520", 0.55) },
        action:     { hover: alpha("#7C3AED", 0.05), selected: alpha("#7C3AED", 0.10) },
        inputBg:    alpha("#7C3AED", 0.03),
    },
    midnight: {
        muiMode: "dark",
        primary:    { main: "#818CF8", light: "#A5B4FC", dark: "#6366F1" },
        background: { default: "#0D0E1A", paper: "#12131F" },
        divider:    alpha("#818CF8", 0.12),
        text:       { primary: alpha("#EEF0FF", 0.92), secondary: alpha("#EEF0FF", 0.60) },
        action:     { hover: alpha("#818CF8", 0.08), selected: alpha("#818CF8", 0.14) },
        inputBg:    alpha("#818CF8", 0.05),
    },
    mint: {
        muiMode: "light",
        primary:    { main: "#059669", light: "#34D399", dark: "#047857" },
        background: { default: "#F0FDF8", paper: "#FFFFFF" },
        divider:    alpha("#059669", 0.12),
        text:       { primary: alpha("#012615", 0.88), secondary: alpha("#012615", 0.55) },
        action:     { hover: alpha("#059669", 0.05), selected: alpha("#059669", 0.10) },
        inputBg:    alpha("#059669", 0.03),
    },
    ocean: {
        muiMode: "dark",
        primary:    { main: "#0891B2", light: "#22D3EE", dark: "#0E7490" },
        background: { default: "#0A1628", paper: "#0F2040" },
        divider:    alpha("#0891B2", 0.15),
        text:       { primary: alpha("#E0F7FF", 0.92), secondary: alpha("#E0F7FF", 0.60) },
        action:     { hover: alpha("#0891B2", 0.10), selected: alpha("#0891B2", 0.18) },
        inputBg:    alpha("#0891B2", 0.06),
    },
};

function createThemeFromPalette(p) {
    return createTheme({
        palette: {
            mode: p.muiMode,
            primary: p.primary,
            background: p.background,
            divider: p.divider,
            text: p.text,
            action: p.action,
            error:   { main: "#E11D48" },
            warning: { main: "#F59E0B" },
            success: { main: "#10B981" },
        },
        shape: { borderRadius: 8 },
        transitions: {
            // plandoTokens.css의 --plando-dur-*, --plando-ease와 동일 곡선 — sx 표현식과 MUI 컴포넌트 사이 일관성 유지
            duration: { shortest: 140, shorter: 180, short: 220, standard: 260, complex: 320, enteringScreen: 220, leavingScreen: 180 },
            easing:   { easeInOut: "cubic-bezier(0.2, 0.8, 0.2, 1)", easeOut: "cubic-bezier(0.2, 0.8, 0.2, 1)", easeIn: "cubic-bezier(0.4, 0, 1, 1)", sharp: "cubic-bezier(0.4, 0, 0.6, 1)" },
        },
        typography: {
            fontFamily: PRETENDARD,
            h1: { fontWeight: 700, letterSpacing: "-0.015em" },
            h2: { fontWeight: 700, letterSpacing: "-0.01em" },
            h3: { fontWeight: 600 },
            button: { fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none" },
            /* body2·caption에 크기를 명시한다. 예전엔 typography에 fontSize가 하나도 없어서
               MUI 기본 스케일이 plando 토큰과 별개인 **세 번째 체계**로 돌았다.
               특히 MUI caption 기본 자간 0.03333em은 라틴 문자용이라 한글에서 자간이 벌어진다.
               값은 --plando-type-{body2,caption}-* 와 1:1로 맞춘다(변경 시 양쪽 같이). */
            body2:   { fontSize: 14, fontWeight: 500, lineHeight: 1.5,  letterSpacing: "-0.01em" },
            caption: { fontSize: 12, fontWeight: 500, lineHeight: 1.45, letterSpacing: 0 },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        backgroundColor: p.background.default,
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                        fontFeatureSettings: "'ss01', 'tnum'",
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: "none",
                        fontWeight: 600,
                        minHeight: 36,
                        borderRadius: "10px",
                    },
                },
            },
            MuiFab: {
                styleOverrides: {
                    root: { boxShadow: "var(--plando-shadow-float)" },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: { backgroundImage: "none" },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: { border: "none" },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        backgroundColor: p.inputBg,
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            boxShadow: "0 0 0 3px var(--plando-primary-soft)",
                        },
                    },
                },
            },
        },
    });
}

export function buildTheme(themeMode) {
    if (themeMode === "custom") {
        try {
            const raw = localStorage.getItem("settings.customTheme");
            if (raw) {
                const { primaryColor, baseMode, bgColor, cardColor } = JSON.parse(raw);
                return createThemeFromPalette(buildCustomPalette(
                    primaryColor || "#6366F1",
                    baseMode || "light",
                    bgColor || null,
                    cardColor || null
                ));
            }
        } catch { /* ignore parse error */ }
    }
    return createThemeFromPalette(palettes[themeMode] ?? palettes.light);
}

