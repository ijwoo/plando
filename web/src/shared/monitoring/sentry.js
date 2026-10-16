import * as Sentry from "@sentry/react";

/**
 * 웹 에러 추적 — DSN 이 있을 때만 켜진다.
 *
 * DSN 이 없으면 조용히 아무것도 하지 않는다. 지금은 Sentry 프로젝트를 아직 만들지 않았으므로
 * 코드만 넣어 두고, `.env` 에 VITE_SENTRY_DSN 을 넣는 순간 수집이 시작된다.
 * (앱도 같은 구조다 — mobile/src/shared/monitoring/sentry.ts)
 *
 * 주의: DSN 이 없는 동안에는 **아무것도 수집되지 않는다.** 그때까지 단서는 백엔드의
 * 구조적 에러 로그(`[ERR]` 접두사)뿐이다.
 */
const DSN = import.meta.env.VITE_SENTRY_DSN;

export const sentryEnabled = Boolean(DSN);

export function initSentry() {
    if (!DSN) return;
    Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        enabled: import.meta.env.PROD,   // 개발 중 노이즈 방지
        // 성능 추적은 끈다 — 백엔드와 같은 이유. 0.1 로 켰더니 실제 요청은 분당 3~7건인데
        // 트랜잭션이 20분 만에 4,220 건 쌓였고 원인을 특정하지 못했다. 필요한 건 오류 추적이다.
        tracesSampleRate: 0,
        // Sentry 설치 안내는 사용자 정보·HTTP 본문을 기본으로 보내라고 하지만 끈다.
        // 실사용자가 쓰는 서비스이고, 개인정보처리방침에 "오류 진단 목적의 국외 전송"이 없다.
        sendDefaultPii: false,
        // 사용자가 손 쓸 수 없는 잡음은 걸러낸다 — 실제 결함이 묻히면 아무도 안 보게 된다
        ignoreErrors: [
            "ResizeObserver loop limit exceeded",
            "ResizeObserver loop completed with undelivered notifications",
            "Non-Error promise rejection captured",
        ],
    });
}

/** 에러 바운더리 등에서 수동 보고 */
export function captureError(error, context) {
    if (!DSN) return;
    try {
        Sentry.captureException(error, context ? { extra: context } : undefined);
    } catch {
        /* 보고 실패가 화면을 깨뜨리면 안 된다 */
    }
}
