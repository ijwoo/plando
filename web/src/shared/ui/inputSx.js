/**
 * MUI TextField outlined variant 용 sx 헬퍼.
 *
 * 기존에 AddTodoMobile / TodoDetailMobile / ChatParsedCard / LoginPageMobile /
 * RegisterPageMobile 5파일에 흩어져 있던 inputSx/fieldSx 정의를 통일.
 *
 * Pattern A — Flat (Toss-style):
 *   transparent border + var(--plando-input-bg) 배경 + focus 시 primary border.
 *   카드 안 입력 필드에 사용.
 *
 * Pattern B — White boxed (Auth on gradient):
 *   #fff 배경 + MUI 기본 outlined border.
 *   그라데이션 페이지 위에 떠있는 폼에 사용.
 */

/**
 * Flat 톤. 카드 내부에서 사용하는 가벼운 입력 필드.
 *
 * @param {Object} [opts]
 * @param {number} [opts.fontSize=14.5]   입력 텍스트 폰트 크기
 * @param {number} [opts.labelSize=13]    InputLabel 폰트 크기
 * @param {number} [opts.radius=2.5]      borderRadius (MUI 단위)
 * @param {string} [opts.bg]              배경 override — 미지정 시 `var(--plando-input-bg)`
 */
export function inputSxFlat({
    fontSize = 14.5,
    labelSize = 13,
    radius = 2.5,
    bg = "var(--plando-input-bg)",
} = {}) {
    return {
        "& .MuiOutlinedInput-root": {
            borderRadius: radius,
            fontSize,
            background: bg,
            "& fieldset": { borderColor: "transparent" },
            "&:hover fieldset": { borderColor: "transparent" },
            "&.Mui-focused fieldset": {
                borderColor: "primary.main",
                borderWidth: 1.5,
            },
        },
        "& .MuiInputLabel-root": { fontSize: labelSize },
    };
}

/**
 * Auth 페이지 같은 그라데이션 배경 위 흰 입력 박스.
 * MUI 기본 outlined border 유지 + 흰 배경만 깔아 명확히 구분.
 *
 * @param {Object} [opts]
 * @param {number} [opts.radius=2.5]
 */
export function inputSxWhite({ radius = 2.5 } = {}) {
    return {
        "& .MuiOutlinedInput-root": {
            borderRadius: radius,
            background: "#fff",
        },
    };
}
