/**
 * Auth 페이지 공용 배경 그라데이션.
 * 6개 auth 페이지 (Login/LoginMobile/Register/RegisterMobile/ForgotPassword/ResetPassword)에
 * 거의 동일하게 정의되던 그라데이션을 한곳으로 모음.
 *
 * 두 가지 톤:
 *  - "modern"  : Phase 8 LoginPageMobile / RegisterPageMobile에서 도입한 토스 톤 (블루+퍼플)
 *  - "glass"   : 데스크톱 LoginPage / RegisterPage의 glass 카드 밑에 깔리는 옅은 블루 레이어
 */

export const AUTH_PAGE_BG_MODERN = `
    radial-gradient(1200px 600px at 10% -10%, rgba(27,111,245,.10), transparent 50%),
    radial-gradient(900px 500px at 110% 110%, rgba(124,58,237,.08), transparent 50%),
    linear-gradient(180deg, #F4F7FC 0%, #EAF1FB 100%)
`;

export const AUTH_PAGE_BG_GLASS = `
    radial-gradient(ellipse 65% 55% at 12% 20%, rgba(25,118,210,0.13) 0%, transparent 100%),
    radial-gradient(ellipse 55% 45% at 88% 80%, rgba(66,165,245,0.10) 0%, transparent 100%),
    radial-gradient(ellipse 40% 35% at 55% 50%, rgba(144,202,249,0.07) 0%, transparent 100%),
    #E8EEF8
`;

