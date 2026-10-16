/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { customPalette, palette, type Palette, type ThemeName } from '@/shared/ui/tokens';

/**
 * 앱 색 테마 — plando 토큰(palette)에서 파생.
 * 레거시 시맨틱 키(text/background/backgroundElement/backgroundSelected/textSecondary)는
 * 기존 화면 호환을 위해 유지하되 값은 plando 팔레트로 교체:
 *   background=앱 베이스(라이트=연회색), backgroundElement=카드 표면(라이트=흰색).
 * 신규 화면/컴포넌트는 surface/primary/border/textTertiary 등 plando 키를 직접 사용.
 */
function build(p: Palette) {
  return {
    // 레거시 키 (값은 plando로 교체)
    text: p.textPrimary,
    textSecondary: p.textSecondary,
    background: p.bg,
    backgroundElement: p.surface,
    backgroundSelected: p.surfaceSelected,
    // plando 시맨틱 (신규)
    surface: p.surface,
    surfaceAlt: p.surfaceAlt,
    surfaceSelected: p.surfaceSelected,
    textTertiary: p.textTertiary,
    textDisabled: p.textDisabled,
    divider: p.divider,
    border: p.border,
    primary: p.primary,
    primarySoft: p.primarySoft,
    danger: p.red,
    orange: p.orange,
    green: p.green,
    purple: p.purple,
    inputBg: p.inputBg,
    inputBorder: p.inputBorder,
    overlay: p.overlay,
  };
}

/**
 * 테마별 색 셋 — 키는 웹 THEMES와 동일(light/dark/pink/lavender/midnight/mint/ocean).
 * isDark = 베이스 모드(themeBase) — midnight·ocean만 다크 기반(웹 muiMode 미러).
 * 그림자(!isDark && shadow.*)·네이티브 외관 강제가 전부 이 플래그를 따른다.
 */
export const Colors = {
  light: { ...build(palette.light), isDark: false },
  dark: { ...build(palette.dark), isDark: true },
  pink: { ...build(palette.pink), isDark: false },
  lavender: { ...build(palette.lavender), isDark: false },
  midnight: { ...build(palette.midnight), isDark: true },
  mint: { ...build(palette.mint), isDark: false },
  ocean: { ...build(palette.ocean), isDark: true },
} as const satisfies Record<ThemeName, unknown>;

export type ThemeColor = Exclude<keyof typeof Colors.light & keyof typeof Colors.dark, 'isDark'>;

/** 커스텀 테마 색 셋 — 사용자가 고른 강조색·베이스에서 파생 (themeMode='custom') */
export function buildCustomColors(base: 'light' | 'dark', accent: string): typeof Colors.light {
  return { ...build(customPalette(base, accent)), isDark: base === 'dark' } as typeof Colors.light;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
