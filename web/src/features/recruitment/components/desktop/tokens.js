// ─────────────────────────────────────────────────────────────
// Desktop design tokens — Toss tone (doc/recruitment/styles-toss.css 기반)
//
// ⚠️ 색은 여기서 정의하지 않습니다.
//    모집 화면의 색은 전부 앱 테마(theme.palette) 또는 --plando-* CSS 변수에서
//    가져옵니다. 이 파일에는 "테마와 무관한 기하/그림자"만 남깁니다.
//    (예전엔 여기서 라이트 전용 hex 팔레트 + 고정 라이트 테마를 만들어
//     모집 데스크탑만 다크모드에서 흰 화면으로 튀었습니다.)
//
// 새 컴포넌트는 components/common/recruitmentSx.js의 sx mixin
// (cardSx, chipSx 등) + theme.palette 토큰을 사용할 것.
// ─────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { createTheme, useTheme } from "@mui/material/styles";

// 카드 경계용 1px ring + soft shadow — 라이트/다크 모두 --plando-* 에서 자동 전환.
// 다크에서는 그림자가 보이지 않으므로 ring이 카드 경계를 대신합니다.
const RING = "var(--plando-shadow-card-ring)";

// Toss soft shadows — 값 자체는 plandoTokens.css가 테마별로 정의.
// 기존 하드코딩 rgba(0,0,0,0.0x) 값과 광량이 비슷한 단계로 1:1 매핑했습니다.
export const SHADOW = {
    sm:   "var(--plando-shadow-1)",
    card: RING,
    pop:  `${RING}, var(--plando-shadow-2)`,
    lift: `${RING}, var(--plando-shadow-3)`,
};

// ─────────────────────────────────────────────────────────────
// 모집 데스크탑 테마 — 앱 테마를 그대로 상속하고 기하(radius)만 Toss 톤으로.
// palette / typography / transitions는 건드리지 않으므로 7가지 테마
// (다크 4종 포함) 어디서 들어와도 색이 그대로 따라옵니다.
// ─────────────────────────────────────────────────────────────
export function buildRecruitmentTheme(base) {
    return createTheme(base, {
        // 모집 카드/칩은 앱 기본(8)보다 둥근 Toss 톤 — 색이 아니라 기하라 테마 무관
        shape: { borderRadius: 12 },
        components: {
            // 다크에서 MUI가 얹는 elevation overlay 제거 (카드 표면이 뿌옇게 뜨는 문제)
            MuiPaper:  { styleOverrides: { root: { backgroundImage: "none" } } },
            MuiCard:   { styleOverrides: { root: { backgroundImage: "none" } } },
            MuiDialog: { styleOverrides: { paper: { backgroundImage: "none" } } },
        },
    });
}

/** 모집 데스크탑 트리 전용 테마 — 현재 앱 테마에서 파생 */
export function useRecruitmentTheme() {
    const base = useTheme();
    return useMemo(() => buildRecruitmentTheme(base), [base]);
}
