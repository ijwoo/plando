import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { reapplyNativeAppearance, registerCustomBaseGetter } from '@/shared/store/themeStore';
import { CUSTOM_ACCENTS } from '@/shared/ui/tokens';

const KEY = 'plando_custom_theme';

export type CustomBase = 'light' | 'dark';

/**
 * 커스텀 테마 정의 (기기 로컬) — themeMode='custom'일 때 사용할 강조색·베이스.
 * 웹은 localStorage에 primary/bg/card를 저장하지만, 모바일은 accent 단일 입력으로 단순화하고
 * 전체 팔레트는 tokens.customPalette()가 파생한다(어떤 색이든 조화롭게).
 */
interface CustomThemeState {
  base: CustomBase;
  accent: string;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  set: (next: { base?: CustomBase; accent?: string }) => void;
}

export const useCustomThemeStore = create<CustomThemeState>((setState, get) => ({
  base: 'light',
  accent: CUSTOM_ACCENTS[0],
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) {
        const p = JSON.parse(raw) as { base?: CustomBase; accent?: string };
        setState({
          base: p.base === 'dark' ? 'dark' : 'light',
          accent: typeof p.accent === 'string' ? p.accent : CUSTOM_ACCENTS[0],
          hydrated: true,
        });
        return;
      }
    } catch {
      // 무시 — 기본값 사용
    }
    setState({ hydrated: true });
  },
  set: ({ base, accent }) => {
    const prevBase = get().base;
    const next = { base: base ?? prevBase, accent: accent ?? get().accent };
    setState(next);
    // 베이스(light/dark)가 바뀌면 네이티브 크롬도 갱신 (커스텀 모드일 때만 효과)
    if (next.base !== prevBase) reapplyNativeAppearance();
    void SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
  },
}));

// themeStore가 커스텀 베이스를 읽을 수 있도록 getter 주입 (순환 정적 import 회피)
registerCustomBaseGetter(() => useCustomThemeStore.getState().base);
