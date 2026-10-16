import { toast } from "../../../shared/utils/toast.js";

/**
 * HTTP 환경(로컬 IP)에서도 동작하는 클립보드 복사.
 * iOS Safari/HTTPS 외 환경에서 navigator.clipboard 실패 시 contenteditable 폴백.
 */
export function copyText(text, container) {
    if (!text) return;
    const done = () => toast.success("복사되었습니다.");
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {
            const ok = iosFallbackCopy(text, container);
            if (ok) done();
        });
    } else {
        const ok = iosFallbackCopy(text, container);
        if (ok) done();
    }
}

/**
 * iOS Safari 대응 클립보드 복사
 *  - container를 받아 Dialog 내부 등 focus 제약 환경에서 동작
 *  - contenteditable span + selectAllChildren 조합이 iOS Safari에서 가장 안정적
 */
function iosFallbackCopy(text, container) {
    const root = container || document.body;
    const span = document.createElement("span");
    span.contentEditable = "true";
    span.textContent = text;
    span.style.cssText = "position:fixed;top:50%;left:50%;width:1px;height:1px;padding:0;border:none;outline:none;opacity:0;overflow:hidden;white-space:pre;";
    root.appendChild(span);
    span.focus();
    try {
        const range = document.createRange();
        range.selectNodeContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } catch { /* selection 실패는 무시 */ }
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* 실행 실패는 무시 */ }
    try { window.getSelection()?.removeAllRanges(); } catch { /* 무시 */ }
    root.removeChild(span);
    return ok;
}
