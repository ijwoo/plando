/**
 * 클립보드 복사 — "성공 여부"를 boolean 으로 돌려준다.
 *
 * navigator.clipboard 는 보안 컨텍스트(HTTPS/localhost)에서만 존재하고, 구형 웹뷰에는 아예 없다.
 * `navigator.clipboard?.writeText(x).catch(() => {})` 처럼 호출만 하고 성공으로 간주하면
 * 실제로는 복사되지 않았는데 UI 는 "복사됨"이라고 알리는 상태가 된다(붙여넣기하면 빈 값).
 * 그래서 실패를 삼키지 않고 호출부가 안내를 띄울 수 있게 결과를 반환한다.
 *
 * 폴백은 settings 의 handleCopyInviteCode 와 같은 형태(textarea + execCommand)이며,
 * execCommand 의 반환값까지 확인한다.
 */
export async function copyToClipboard(text) {
    const value = text == null ? "" : String(text);
    if (!value) return false;

    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        // clipboard API 없음 / 비보안 컨텍스트 / 권한 거부 → 아래 폴백으로
    }

    try {
        const el = document.createElement("textarea");
        el.value = value;
        el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
        document.body.appendChild(el);
        el.focus();
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        return !!ok;
    } catch {
        return false;
    }
}
