import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'plando_live_activity_enabled';

/**
 * Live Activity(잠금화면 오늘 진행) 사용자 토글 (기기 로컬, 기본 켬).
 * 끄면 진행 중인 활동을 즉시 종료하고 이후 시작하지 않는다.
 */
interface LiveActivityState {
  enabled: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (v: boolean) => Promise<void>;
}

export const useLiveActivityStore = create<LiveActivityState>((set) => ({
  enabled: true,
  hydrated: false,
  hydrate: async () => {
    try {
      const v = await SecureStore.getItemAsync(KEY);
      set({ enabled: v !== '0', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setEnabled: async (v: boolean) => {
    set({ enabled: v });
    try {
      await SecureStore.setItemAsync(KEY, v ? '1' : '0');
    } catch {
      // 저장 실패해도 세션 내에는 반영
    }
  },
}));
