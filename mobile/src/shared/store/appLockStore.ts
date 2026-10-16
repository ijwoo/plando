import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { Widget } from '@/native-modules/widget';

const KEY = 'plando_app_lock_enabled';

/**
 * Face ID 앱 잠금 토글 (기기 로컬). 켜면 콜드 스타트·백그라운드 복귀 시
 * 생체 인증(없으면 기기 암호 폴백)을 통과해야 앱을 볼 수 있다.
 * 기본 false — 사용자가 설정에서 명시적으로 켠 경우에만 잠근다.
 */
interface AppLockState {
  enabled: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (v: boolean) => Promise<void>;
}

export const useAppLockStore = create<AppLockState>((set) => ({
  enabled: false,
  hydrated: false,
  hydrate: async () => {
    try {
      const v = await SecureStore.getItemAsync(KEY);
      set({ enabled: v === '1', hydrated: true });
      // 네이티브 앱 스위처 스냅샷 커버 설정 동기화 (구버전 빌드에서 켠 사용자 포함)
      Widget.setAppLockEnabled(v === '1');
    } catch {
      set({ hydrated: true });
    }
  },
  setEnabled: async (v: boolean) => {
    set({ enabled: v });
    Widget.setAppLockEnabled(v); // 네이티브 앱 스위처 스냅샷 커버 on/off
    try {
      await SecureStore.setItemAsync(KEY, v ? '1' : '0');
    } catch {
      // 저장 실패해도 세션 내에는 반영
    }
  },
}));
