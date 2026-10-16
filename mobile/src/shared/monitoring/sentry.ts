import * as Sentry from '@sentry/react-native';

/**
 * 에러 모니터링 — DSN이 설정된 경우에만 활성화.
 * DSN 은 **EAS production 환경변수**로 등록한다 — `.env` 는 gitignore 라 EAS 빌드 머신에
 * 올라가지 않아서, 거기 넣으면 빌드에 조용히 빠진다(빌드 43 때 실제로 겪었다).
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!DSN;

export function initSentry(): void {
  if (!DSN) return;
  try {
    Sentry.init({
      dsn: DSN,
      // 개발 중 노이즈 방지 — dev 빌드에선 전송 안 함
      enabled: !__DEV__,
      // 성능 추적은 끈다 — 백엔드·웹과 같은 이유. 서버에서 0.1 로 켰더니 실제 요청은
      // 분당 3~7건인데 트랜잭션이 20분 만에 4,220 건 쌓였고 원인을 특정하지 못했다.
      // 필요한 건 크래시·오류 추적이지 성능 추적이 아니다.
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
  } catch {
    // 네이티브 모듈 없는 빌드(리빌드 전) — 무시
  }
}

/** 바운더리/핸들러에서 수동 보고 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // 무시
  }
}
