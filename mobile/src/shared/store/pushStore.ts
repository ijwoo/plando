import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'plando_push_enabled';

/**
 * 앱 푸시 알림 사용자 토글 (기기 로컬). OS 권한과 별개로 사용자가 앱 차원에서 끌 수 있다
 * (웹 '앱 푸시 알림' 채널 토글 미러 — 끄면 서버에서 토큰 해제).
 * 기본 true — 권한 플로우는 기존대로, 명시적으로 끈 경우만 등록을 건너뛴다.
 */
interface PushState {
  enabled: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (v: boolean) => Promise<void>;
}

export const usePushStore = create<PushState>((set) => ({
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
