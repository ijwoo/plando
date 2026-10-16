import { useMemo } from 'react';

import { useTheme } from '@/hooks/use-theme';
import { readableOn } from '@/shared/ui/tone';
import { radius, shadow, space } from '@/shared/ui/tokens';

/**
 * 목업 전용 파생 토큰 — 웹 `tourTokens.js`의 RN 미러.
 *
 * 규칙: **여기서 파생되지 않은 새 hex 리터럴을 목업에 쓰지 않는다.** 앱 테마가 8종 + 커스텀
 * 액센트라, 목업이 색을 직접 들고 있으면 그 화면만 테마를 안 따라간다(예전 온보딩이 그랬다).
 *
 * ⚠️ 알파 합성 금지: theme.text / textSecondary / textTertiary / divider / border는 테마에 따라
 * `rgba(...)` 문자열이다. `theme.text + '20'` 같은 hex-알파 이어붙이기는 6개 테마에서 깨진다.
 * 흐린 면이 필요하면 이미 알파가 반영된 textTertiary·divider·surfaceSelected·surfaceAlt를 고른다.
 * readableOn()도 hex만 파싱하므로 primary/danger/orange/green에만 쓴다.
 */
export function useTourTokens() {
  const theme = useTheme();

  return useMemo(
    () => ({
      theme,

      // 목업 프레임 — 실제 앱 화면의 한 조각처럼 보이게 하는 바깥 틀
      frameBg: theme.surface,
      frameBorder: theme.border,
      // 다크 계열에선 그림자가 거의 안 보여 생략하는 게 리포 관례
      frameShadow: theme.isDark ? shadow.none : shadow.card,

      // 목업 안 표면
      canvas: theme.surfaceAlt, // 지도 등 넓은 바탕
      row: theme.surface, // 카드/행
      rowPressed: theme.surfaceSelected,
      block: theme.surfaceSelected, // 지도 건물 같은 추상 덩어리
      line: theme.divider, // 구분선·추상 도로

      // 텍스트
      text: theme.text,
      textSub: theme.textSecondary,
      textDim: theme.textTertiary,

      // 액센트
      accent: theme.primary,
      accentSoft: theme.primarySoft,
      onAccent: readableOn(theme.primary),

      // 완료(스와이프 액션 판)
      done: theme.green,
      onDone: readableOn(theme.green),

      radius,
      space,
    }),
    [theme],
  );
}

export type TourTokens = ReturnType<typeof useTourTokens>;
