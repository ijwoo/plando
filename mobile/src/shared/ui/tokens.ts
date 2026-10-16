/**
 * plando 디자인 토큰 — 웹 `frontend-todo/src/shared/ui/plandoTokens.css`를 RN으로 포팅.
 * 색은 light/dark 페어, 간격·radius·타이포·그림자는 모드 공통.
 * CSS의 em 단위 letterSpacing은 RN(px)에 맞춰 size×em으로 사전 계산.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// ── Radii ──────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  card: 16,
  lg: 20,
  modal: 24,
  xl: 28,
  pill: 9999,
} as const;

// ── Spacing (--plando-space-*) ─────────────────────────
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  14: 56,
} as const;

// ── Type scale (--plando-type-*) → RN TextStyle ────────
// lineHeight: size×lh(px), letterSpacing: size×ls(em)
export const type = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.56 },
  title1: { fontSize: 22, lineHeight: 30, fontWeight: '700', letterSpacing: -0.44 },
  title2: { fontSize: 18, lineHeight: 25, fontWeight: '700', letterSpacing: -0.18 },
  title3: { fontSize: 16, lineHeight: 23, fontWeight: '600', letterSpacing: -0.16 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500', letterSpacing: -0.15 },
  bodyR: { fontSize: 15, lineHeight: 23, fontWeight: '400', letterSpacing: -0.15 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500', letterSpacing: 0 },
  num: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.84 },
  numLg: { fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1.08 },
} satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;

// ── Motion (--plando-dur-*, --plando-ease) ─────────────
export const motion = {
  durFast: 140,
  durBase: 220,
  durSlow: 360,
  // RN Easing.bezier 인자 (cubic-bezier(0.2,0.8,0.2,1))
  easeBezier: [0.2, 0.8, 0.2, 1] as const,
} as const;

// ── Palette (테마별) ───────────────────────────────────
/** 웹 `theme.js`의 THEMES 키와 동일 — settings.themeMode가 웹과 왕복돼야 한다 */
export type ThemeName = 'light' | 'dark' | 'pink' | 'lavender' | 'midnight' | 'mint' | 'ocean';

/** 각 테마의 베이스 모드 — 웹 palettes[].muiMode 미러 (midnight·ocean만 다크 기반) */
export const themeBase: Record<ThemeName, 'light' | 'dark'> = {
  light: 'light',
  dark: 'dark',
  pink: 'light',
  lavender: 'light',
  midnight: 'dark',
  mint: 'light',
  ocean: 'dark',
};

export type Palette = {
  // 표면/배경
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceSelected: string;
  divider: string;
  border: string;
  // 텍스트
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  // 브랜드
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  primarySoft: string;
  // 상태(일반 — 활동/배지 등)
  red: string;
  redSoft: string;
  orange: string;
  orangeSoft: string;
  green: string;
  greenSoft: string;
  gray: string;
  graySoft: string;
  // 입력
  inputBg: string;
  inputBorder: string;
  // 오버레이
  overlay: string;
  sheetHandle: string;
  // AI
  purple: string;
  aiGlow: string;
};

const basePalette: Record<'light' | 'dark', Palette> = {
  light: {
    // 회색 캔버스 위 흰 카드로 표면 깊이. 뉴트럴은 쿨 슬레이트가 아니라 '살짝 웜 그레이' —
    // 쿨톤은 대시보드/개발자 느낌을 키우고, 웜 뉴트럴이 서비스 앱(iOS/슬랙) 톤에 가깝다.
    bg: '#F5F4F2',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F3F0',
    surfaceSelected: '#EEEDE9',
    divider: '#ECEAE6',
    border: '#E5E2DD',
    textPrimary: '#1C1B18',
    textSecondary: '#57534E',
    textTertiary: '#A29E97',
    textDisabled: '#D4D1CB',
    primary: '#1976D2',
    primaryHover: '#1565C0',
    primaryPressed: '#0D47A1',
    primarySoft: '#E3F2FD',
    red: '#E11D48',
    redSoft: '#FFE4E6',
    orange: '#F59E0B',
    orangeSoft: '#FEF3C7',
    green: '#10B981',
    greenSoft: '#D1FAE5',
    gray: '#A29E97',
    graySoft: '#EAE7E1',
    inputBg: 'rgba(0,0,0,0.03)',
    inputBorder: 'rgba(0,0,0,0.12)',
    overlay: 'rgba(20,30,60,0.32)',
    sheetHandle: 'rgba(0,0,0,0.15)',
    purple: '#7C3AED',
    aiGlow: 'rgba(37,99,235,0.25)',
  },
  dark: {
    // 홈과 배경 통일 — bg = surface(차콜). 카드 구분은 border/surfaceAlt로.
    bg: '#17181D',
    surface: '#1E2026',
    surfaceAlt: '#191A1F',
    surfaceSelected: '#2A2C33',
    divider: 'rgba(255,255,255,0.09)',
    border: 'rgba(255,255,255,0.11)',
    textPrimary: '#E8EAED',
    textSecondary: '#9AA0A6',
    textTertiary: '#6B7280',
    textDisabled: '#4B5563',
    primary: '#8AB4F8',
    primaryHover: '#6EA8F5',
    primaryPressed: '#4A8FE2',
    primarySoft: 'rgba(138,180,248,0.12)',
    red: '#FB7185',
    redSoft: 'rgba(225,29,72,0.16)',
    orange: '#FBBF24',
    orangeSoft: 'rgba(245,158,11,0.16)',
    green: '#34D399',
    greenSoft: 'rgba(16,185,129,0.16)',
    gray: '#9AA0A6',
    graySoft: 'rgba(148,163,184,0.12)',
    inputBg: 'rgba(255,255,255,0.04)',
    inputBorder: 'rgba(255,255,255,0.14)',
    overlay: 'rgba(0,0,0,0.50)',
    sheetHandle: 'rgba(255,255,255,0.18)',
    purple: '#9B8AD8',
    aiGlow: 'rgba(74,143,226,0.30)',
  },
};

/** #RRGGBB → rgba() 문자열 (웹 MUI alpha() 미러) */
function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** hex를 흰색/검정과 t비율로 섞기 (t=0 원색, 1 완전 흰/검) — 커스텀 테마 파생용 */
function mix(hex: string, target: '#fff' | '#000', t: number): string {
  const to = target === '#fff' ? 255 : 0;
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (to - v) * t);
  });
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 컬러 테마 스펙 — 값은 전부 웹 theme.js palettes[key]에서 가져온다 */
type ColorThemeSpec = {
  base: 'light' | 'dark';
  /** 웹 primary.main */
  primary: string;
  /** 웹 라이트 기반=primary.dark, 다크 기반=primary.light (기존 light/dark 팔레트 hover 방향과 동일) */
  primaryHover: string;
  primaryPressed: string;
  /** 웹 background.default / background.paper */
  bg: string;
  surface: string;
  /** bg·surface 사이 보조 표면 — 웹엔 없는 모바일 전용 위계, 근사 파생 */
  surfaceAlt: string;
  /** 웹 text.primary/secondary의 알파 베이스 색 */
  textTint: string;
  /** 웹 divider / action.selected / inputBg 의 알파값 */
  dividerAlpha: number;
  selectedAlpha: number;
  inputBgAlpha: number;
};

/**
 * 컬러 테마 팔레트 — 베이스(light/dark) 팔레트를 깔고 웹 palettes[key] 값으로 덮는다.
 * 상태색(red/orange/green)·오버레이·입력 보더는 웹도 테마 공통이라 베이스 그대로 상속.
 */
function themed(s: ColorThemeSpec): Palette {
  const dark = s.base === 'dark';
  return {
    ...basePalette[s.base],
    bg: s.bg,
    surface: s.surface,
    surfaceAlt: s.surfaceAlt,
    surfaceSelected: rgba(s.primary, s.selectedAlpha),
    divider: rgba(s.primary, s.dividerAlpha),
    border: rgba(s.primary, s.dividerAlpha + 0.06),
    textPrimary: rgba(s.textTint, dark ? 0.92 : 0.88),
    textSecondary: rgba(s.textTint, dark ? 0.6 : 0.55),
    textTertiary: rgba(s.textTint, dark ? 0.42 : 0.38),
    textDisabled: rgba(s.textTint, dark ? 0.28 : 0.24),
    primary: s.primary,
    primaryHover: s.primaryHover,
    primaryPressed: s.primaryPressed,
    primarySoft: rgba(s.primary, dark ? 0.14 : 0.12),
    inputBg: rgba(s.primary, s.inputBgAlpha),
    aiGlow: rgba(s.primary, dark ? 0.3 : 0.25),
  };
}

export const palette: Record<ThemeName, Palette> = {
  light: basePalette.light,
  dark: basePalette.dark,
  // 핑크 — 웹: primary #D63384(light #F06292/dark #AD1457), bg #FDF4F7, paper #FFFFFF, text #1A0010
  pink: themed({
    base: 'light',
    primary: '#D63384',
    primaryHover: '#AD1457',
    primaryPressed: '#93114A',
    bg: '#FDF4F7',
    surface: '#FFFFFF',
    surfaceAlt: '#FDF4F7',
    textTint: '#1A0010',
    dividerAlpha: 0.12,
    selectedAlpha: 0.1,
    inputBgAlpha: 0.03,
  }),
  // 라벤더 — 웹: primary #7C3AED(#A78BFA/#5B21B6), bg #F5F3FF, paper #FDFCFF, text #0D0520
  lavender: themed({
    base: 'light',
    primary: '#7C3AED',
    primaryHover: '#5B21B6',
    primaryPressed: '#4D1C9B',
    bg: '#F5F3FF',
    surface: '#FDFCFF',
    surfaceAlt: '#F5F3FF',
    textTint: '#0D0520',
    dividerAlpha: 0.12,
    selectedAlpha: 0.1,
    inputBgAlpha: 0.03,
  }),
  // 미드나잇(다크 기반) — 웹: primary #818CF8(#A5B4FC/#6366F1), bg #0D0E1A, paper #12131F, text #EEF0FF
  midnight: themed({
    base: 'dark',
    primary: '#818CF8',
    primaryHover: '#A5B4FC',
    primaryPressed: '#6366F1',
    bg: '#0D0E1A',
    surface: '#12131F',
    surfaceAlt: '#101120',
    textTint: '#EEF0FF',
    dividerAlpha: 0.12,
    selectedAlpha: 0.14,
    inputBgAlpha: 0.05,
  }),
  // 민트 — 웹: primary #059669(#34D399/#047857), bg #F0FDF8, paper #FFFFFF, text #012615
  mint: themed({
    base: 'light',
    primary: '#059669',
    primaryHover: '#047857',
    primaryPressed: '#03664A',
    bg: '#F0FDF8',
    surface: '#FFFFFF',
    surfaceAlt: '#F0FDF8',
    textTint: '#012615',
    dividerAlpha: 0.12,
    selectedAlpha: 0.1,
    inputBgAlpha: 0.03,
  }),
  // 오션(다크 기반) — 웹: primary #0891B2(#22D3EE/#0E7490), bg #0A1628, paper #0F2040, text #E0F7FF
  ocean: themed({
    base: 'dark',
    primary: '#0891B2',
    primaryHover: '#22D3EE',
    primaryPressed: '#0E7490',
    bg: '#0A1628',
    surface: '#0F2040',
    surfaceAlt: '#0C1B34',
    textTint: '#E0F7FF',
    dividerAlpha: 0.15,
    selectedAlpha: 0.18,
    inputBgAlpha: 0.06,
  }),
};

/**
 * 커스텀 테마 — 사용자가 고른 강조색(accent) 하나에서 전체 팔레트를 파생한다.
 * bg·surface·텍스트를 accent 색조로 은은하게 물들여, 어떤 색을 골라도 프리셋처럼 조화롭게 보이게 한다.
 * (웹은 primary/bg/card를 각각 노출하지만, 모바일은 "예쁜 결과 보장"을 위해 accent 단일 입력으로 단순화)
 */
export function customPalette(base: 'light' | 'dark', accent: string): Palette {
  const dark = base === 'dark';
  return themed({
    base,
    primary: accent,
    primaryHover: dark ? mix(accent, '#fff', 0.18) : mix(accent, '#000', 0.14),
    primaryPressed: dark ? mix(accent, '#fff', 0.3) : mix(accent, '#000', 0.24),
    // 라이트: 거의 흰 배경에 accent 한 방울 / 다크: 아주 어두운 배경에 accent 한 방울(프리셋 미드나잇/오션 톤)
    bg: dark ? mix(accent, '#000', 0.87) : mix(accent, '#fff', 0.95),
    surface: dark ? mix(accent, '#000', 0.78) : '#FFFFFF',
    surfaceAlt: dark ? mix(accent, '#000', 0.83) : mix(accent, '#fff', 0.95),
    textTint: dark ? mix(accent, '#fff', 0.86) : mix(accent, '#000', 0.82),
    dividerAlpha: 0.12,
    selectedAlpha: dark ? 0.16 : 0.1,
    inputBgAlpha: dark ? 0.06 : 0.035,
  });
}

/** 커스텀 테마 강조색 팔레트 — 전부 채도·명도를 다듬은 "예쁜" 세트 */
export const CUSTOM_ACCENTS: string[] = [
  '#2563EB', // 블루
  '#4F46E5', // 인디고
  '#7C3AED', // 바이올렛
  '#C026D3', // 퍼플핑크
  '#DB2777', // 로즈
  '#E11D48', // 레드
  '#EA580C', // 오렌지
  '#D97706', // 앰버
  '#059669', // 에메랄드
  '#0D9488', // 틸
  '#0891B2', // 시안
  '#475569', // 슬레이트
];

// ── Elevation (--plando-shadow-*) → RN 스타일 ──────────
// iOS는 shadow*, Android는 elevation. 다크에선 그림자가 거의 안 보여 elevation만 의미.
type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

function ios(opacity: number, radiusPx: number, dy: number, elevation: number): ShadowStyle {
  return Platform.select<ShadowStyle>({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: dy }, shadowOpacity: opacity, shadowRadius: radiusPx },
    default: { elevation },
  }) as ShadowStyle;
}

export const shadow = {
  none: {} as ShadowStyle,
  // 라이트 모드 카드 부양감 — 반경을 키워 부드러운 확산형(토스풍). 다크에선 거의 안 보임(의도)
  card: ios(0.07, 14, 4, 3),
  raised: ios(0.12, 20, 8, 6),
  float: ios(0.2, 24, 10, 10),
} as const;

export type ShadowToken = keyof typeof shadow;
