/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { buildCustomColors, Colors } from '@/constants/theme';
import { useCustomThemeStore } from '@/shared/store/customThemeStore';
import { useThemeStore } from '@/shared/store/themeStore';
import type { ThemeName } from '@/shared/ui/tokens';

/**
 * 현재 적용할 테마 이름(웹 THEMES 키) — 테마 오버라이드(themeMode) 반영. 'custom'은 별도 파생.
 * 시스템 모드는 RN useColorScheme() 대신 themeStore.systemScheme(Appearance 리스너 단일 소스)을
 * 읽는다 — 컴포넌트별 useColorScheme은 비활성 화면에서 갱신이 누락돼 화면마다 스킴이 어긋났다.
 */
export function useResolvedThemeName(): ThemeName {
  const mode = useThemeStore((s) => s.mode);
  const system = useThemeStore((s) => s.systemScheme);
  if (mode === 'system') return system;
  if (mode === 'custom') return 'light'; // 이름이 필요한 곳의 폴백 — 실제 색은 useTheme의 커스텀 분기가 담당
  return mode;
}

/** 현재 테마의 베이스 스킴('light'|'dark') — 네이티브 피커 themeVariant·상태바 등에 사용 */
export function useResolvedScheme(): 'light' | 'dark' {
  const mode = useThemeStore((s) => s.mode);
  const base = useCustomThemeStore((s) => s.base);
  const name = useResolvedThemeName();
  if (mode === 'custom') return base;
  return Colors[name].isDark ? 'dark' : 'light';
}

export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const name = useResolvedThemeName();
  const base = useCustomThemeStore((s) => s.base);
  const accent = useCustomThemeStore((s) => s.accent);
  if (mode === 'custom') return buildCustomColors(base, accent);
  return Colors[name];
}
