import React, {useEffect} from "react";
import { APP_EVENTS } from "./shared/constants/events.js";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { initSentry } from "./shared/monitoring/sentry.js";

// Electron 환경에서는 Service Worker 등록 스킵 (SW는 Electron에서 동작 안 함)
if (navigator.serviceWorker && window.navigator.userAgent.includes("Electron")) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
    });
}

// PWA 세로 방향 고정 (Screen Orientation API — 미지원 환경에서는 무시됨)
if (screen?.orientation?.lock) {
    screen.orientation.lock("portrait").catch(() => {});
}

// iOS PWA: viewport-fit=cover 환경에서 앱 시작 시
// scrollY 가 env(safe-area-inset-top) 만큼 자동 설정되는 현상 방지.
// scrollRestoration = 'manual' 로 복원을 막은 뒤 scrollTo 를 호출해야 효과 있음.
if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);
window.addEventListener('pageshow', () => window.scrollTo(0, 0));


import { CssBaseline, ThemeProvider } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { buildTheme } from "./shared/ui/theme.js";
import { initKakaoSdk } from "./shared/utils/kakaoSdk.js";
import "./shared/ui/plandoTokens.css";
import "./index.css";

const LS_THEME = "settings.themeMode";

function ThemeRoot({ children }) {
    const getMode = () => localStorage.getItem(LS_THEME) || "light";

    const [mode, setMode] = React.useState(getMode);
    const [themeVersion, setThemeVersion] = React.useState(0);


    React.useEffect(() => {
        const onChanged = () => {
            setMode(getMode());
            setThemeVersion((v) => v + 1);
        };
        window.addEventListener(APP_EVENTS.SETTINGS_CHANGED, onChanged);
        return () => window.removeEventListener(APP_EVENTS.SETTINGS_CHANGED, onChanged);
    }, []);

    useEffect(() => {
        initKakaoSdk().catch((err) => {
            console.error("Kakao SDK 초기화 실패", err);
        });
    }, []);

    const theme = React.useMemo(() => buildTheme(mode), [mode, themeVersion]);

    // CSS 변수 싱크
    //  1) MUI palette.mode → [data-theme] 속성 (shadow/surface 등 mode 기준 토큰용)
    //  2) plandoTokens.css는 light/dark 2벌만 갖고 있어서 pink/lavender/mint/midnight/
    //     ocean/custom 6개 모드에서 var(--plando-*)가 전부 틀린 색이었다. 활성 테마의
    //     palette를 루트 인라인 변수로 덮어써서 8개 모드 전부 맞게 한다.
    //     (palette가 단일 출처 — CSS 파일의 값은 하이드레이션 전 기본값 역할)
    React.useEffect(() => {
        const root = document.documentElement;
        const p = theme.palette;
        const dark = p.mode === "dark";
        root.dataset.theme = dark ? "dark" : "light";
        const vars = {
            "--plando-bg":             p.background.default,
            "--plando-surface":        p.background.paper,
            "--plando-primary":        p.primary.main,
            "--plando-primary-soft":   alpha(p.primary.main, dark ? 0.10 : 0.12),
            "--plando-divider":        p.divider,
            "--plando-text-primary":   p.text.primary,
            "--plando-text-secondary": p.text.secondary,
        };
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    }, [theme]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}

// 에러 추적은 렌더보다 먼저 — 초기 렌더에서 터지는 것도 잡으려면 순서가 중요하다
initSentry();

ReactDOM.createRoot(document.getElementById("root")).render(
    <ThemeRoot>
        <App />
    </ThemeRoot>
);