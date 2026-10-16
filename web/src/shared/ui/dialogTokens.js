import { alpha } from "@mui/material/styles";

/**
 * Dialog/Modal 공통 색상 토큰 — ConfirmDialog / DmCreateTodoModal / DmEditMessageModal 등이
 * 각자 동일/유사 정의를 들고 있던 것을 단일 출처로 통합.
 *
 * ⚠️ isDark boolean이 아니라 **MUI theme 객체**를 받는다. 예전엔 light/dark 하드코딩이라
 * pink/lavender/mint/midnight/ocean/custom 6개 모드에서 다이얼로그가 전부 잘못된 색이었다.
 *
 * 사용:
 *   const tok = getDialogTokens(theme);
 *   <Paper sx={{ bgcolor: tok.bg, border: `1px solid ${tok.border}`, ... }} />
 */
export function getDialogTokens(theme) {
    const p = theme?.palette ?? null;
    const dark = p ? p.mode === "dark" : Boolean(theme);
    const paper = p?.background?.paper ?? "#FFFFFF";
    const text = p?.text?.primary ?? (dark ? "#E8EAED" : "#0F172A");
    const text2 = p?.text?.secondary ?? (dark ? "#9AA0A6" : "#475569");
    return {
        bg:      alpha(paper, 0.98),
        border:  alpha(text, dark ? 0.10 : 0.18),
        text,
        text2,
        sep:     alpha(text, 0.07),
        inputBg: alpha(text, dark ? 0.05 : 0.04),
    };
}
