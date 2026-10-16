import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'plando_onboarded';

/**
 * 온보딩 완료 여부 (기기 로컬). 기존 웹의 localStorage 'plando_onboarded' 미러.
 * null = 아직 확인 전(스플래시 유지용).
 */
interface OnboardingState {
  onboarded: boolean | null;
  hydrate: () => Promise<void>;
  complete: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  onboarded: null,
  hydrate: async () => {
    try {
      const v = await SecureStore.getItemAsync(KEY);
      set({ onboarded: v === '1' });
    } catch {
      set({ onboarded: true }); // 읽기 실패 시 막지 않음
    }
  },
  complete: async () => {
    set({ onboarded: true });
    try {
      await SecureStore.setItemAsync(KEY, '1');
    } catch {
      // 저장 실패해도 세션 내에는 완료 처리
    }
  },
}));
