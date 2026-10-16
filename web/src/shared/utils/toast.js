import { APP_EVENTS } from "../constants/events.js";

/**
 * App-level toast 발화 헬퍼.
 *
 * 기존에 여러 파일이 다음 패턴을 직접 사용:
 *   window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message, severity } }));
 *
 * 그리고 여러 파일 (DmMessageList / ArchiveView / TodoRecurrenceSection 등)이
 * 동일한 `dispatchToast` 함수를 자체 정의 → 모두 이 모듈로 통합.
 *
 * Layout.jsx 가 APP_EVENTS.APP_TOAST 리스너로 Snackbar를 띄움.
 */
function dispatch(severity, message) {
    if (!message) return;
    window.dispatchEvent(
        new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message, severity } })
    );
}

export const toast = {
    success: (message) => dispatch("success", message),
    error:   (message) => dispatch("error",   message),
    warning: (message) => dispatch("warning", message),
    info:    (message) => dispatch("info",    message),
};
