/**
 * TransferOwnerDialog에 넘기는 테마 토큰.
 * 설정 데스크탑/모바일 페이지에 동일하게 중복돼 있던 객체를 단일 함수로 통합.
 */
export function buildTransferTokens(muiTheme) {
    return {
        sheet:      muiTheme.palette.background.paper,
        surface:    muiTheme.palette.action.hover,
        surfaceMd:  muiTheme.palette.action.selected,
        border:     muiTheme.palette.divider,
        primary:    muiTheme.palette.primary.main,
        primaryDim: muiTheme.palette.action.focus,
        red:        muiTheme.palette.error.main,
        text:       muiTheme.palette.text.primary,
        text2:      muiTheme.palette.text.secondary,
        text3:      muiTheme.palette.text.disabled,
    };
}
