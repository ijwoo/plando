import { Appearance, AppState } from 'react-native';
import { create } from 'zustand';

import { themeBase, type ThemeName } from '@/shared/ui/tokens';

export type ThemeMode = 'system' | 'custom' | ThemeName;

/**
 * 앱 테마 오버라이드. 백엔드 UserSettings.themeMode와 동기화한다(웹 THEMES 키와 동일 —
 * light/dark/pink/lavender/midnight/mint/ocean이 웹과 왕복된다).
 * - 'system': OS 설정 따름(useColorScheme)
 * - 그 외: 해당 테마 강제 (네이티브 외관은 테마의 베이스 모드 — midnight·ocean=다크)
 * 설정 화면에서 변경 시 이 스토어 + 백엔드 PUT 둘 다 갱신, 로그인 후 설정 로드 시 hydrate.
 *
 * 중요: JS 스토어만 바꾸면 RN의 useColorScheme()와 네이티브 UI(NativeTabs UITabBar,
 * 상태바, 얼어붙은 화면)는 여전히 OS 외관을 따라가 탭 전환 시 색이 어긋난다.
 * 그래서 Appearance.setColorScheme로 앱 전역 외관 자체를 강제해 네이티브 크롬까지 일치시킨다.
 */
interface ThemeState {
  mode: ThemeMode;
  /** OS 색 스킴 — Appearance 리스너로 갱신되는 단일 소스 (컴포넌트별 useColorScheme 의존 제거) */
  systemScheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

function normalize(v?: string | null): ThemeMode {
  if (v && v in themeBase) return v as ThemeName;
  // 커스텀 팔레트는 기기 로컬(customThemeStore)에 저장 — 여기선 모드만 유지
  if (v === 'custom') return 'custom';
  return 'system';
}

function readSystemScheme(): 'light' | 'dark' {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * 앱 전역 네이티브 외관 강제 ('system'이면 'unspecified'로 OS 따름).
 *
 * 주의: RN 0.85에서 해제값은 null이 아니라 'unspecified'다. null을 넘기면
 * Appearance의 JS 캐시가 null로 오염돼 getColorScheme()/useColorScheme()이
 * 계속 null(→라이트로 매핑)을 반환한다 — 시스템 모드가 항상 라이트로 보이던 원인.
 * 'unspecified'는 RN이 즉시 실제 OS 스킴을 다시 읽어 캐시를 채운다.
 */
// 커스텀 테마 베이스 소스 — customThemeStore가 주입(순환 정적 import 회피)
let customBaseGetter: () => 'light' | 'dark' = () => 'light';
export function registerCustomBaseGetter(fn: () => 'light' | 'dark') {
  customBaseGetter = fn;
}

function applyNativeAppearance(mode: ThemeMode) {
  const scheme: 'light' | 'dark' | 'unspecified' =
    mode === 'system' ? 'unspecified' : mode === 'custom' ? customBaseGetter() : themeBase[mode];
  // 컬러 테마는 베이스 모드(light/dark)로 네이티브 크롬(UITabBar·상태바 등)을 강제
  (Appearance.setColorScheme as (s: 'light' | 'dark' | 'unspecified') => void)(scheme);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  systemScheme: readSystemScheme(),
  setMode: (mode) => {
    // 같은 모드 재적용 스킵 — 설정 refetch마다 ThemeHydrator가 호출해도 네이티브 호출/렌더 없음
    if (get().mode === mode) return;
    applyNativeAppearance(mode);
    // 'system' 복귀 시 강제값이 아니라 실제 OS 스킴을 다시 읽는다
    set({ mode, systemScheme: readSystemScheme() });
  },
}));

/**
 * 시스템 모드 일관성 보장:
 * - OS 외관 변경을 스토어 상태로 반영 → 모든 화면이 같은 소스에서 리렌더.
 *   (컴포넌트별 useColorScheme()는 비활성/frozen 화면에서 갱신이 누락돼 화면마다 스킴이 어긋났다)
 * - iOS는 백그라운드 스냅샷 중 반대 스킴 이벤트를 쏘므로, 포그라운드(active)일 때만 반영.
 * 강제 모드에서 setColorScheme이 일으키는 이벤트는 mode!=='system'이라 UI에 영향 없음.
 */
Appearance.addChangeListener(({ colorScheme }) => {
  if (AppState.currentState !== 'active') return;
  const next = colorScheme === 'dark' ? 'dark' : 'light';
  if (useThemeStore.getState().systemScheme !== next) useThemeStore.setState({ systemScheme: next });
});
// 백그라운드 중 무시된 변경은 포그라운드 복귀 시 한 번 보정
AppState.addEventListener('change', (s) => {
  if (s !== 'active') return;
  const next = readSystemScheme();
  if (useThemeStore.getState().systemScheme !== next) useThemeStore.setState({ systemScheme: next });
});

/** 백엔드 themeMode 문자열로 스토어 동기화 (설정 로드 시) */
export function hydrateThemeMode(themeMode?: string | null) {
  useThemeStore.getState().setMode(normalize(themeMode));
}

/** 커스텀 테마의 베이스가 바뀌었을 때 네이티브 크롬(상태바·탭바) 재적용 */
export function reapplyNativeAppearance() {
  applyNativeAppearance(useThemeStore.getState().mode);
}
