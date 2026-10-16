import { create } from 'zustand';

import { clearToken, getToken, isTokenExpired, setToken } from '@/api/auth';
import { unregisterPush } from '@/features/notification/push';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id?: number;
  name?: string;
  email?: string;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** 보안 저장소에서 초기 인증 상태 복원 (앱 시작 시 1회 호출) */
  hydrate: () => Promise<void>;
  /** 새로 발급된 JWT 저장 후 인증 상태로 전환 */
  signIn: (token: string, user?: AuthUser) => Promise<void>;
  /** 토큰 비우고 인증 흐름으로 복귀 */
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  hydrate: async () => {
    try {
      const token = await getToken();
      // 만료된 토큰으로 부팅하면 인증 UI가 잠깐 떴다 강제 로그아웃되고,
      // 오프라인이면 401도 안 와서 갇힌다 → 시작 시점에 만료를 직접 검사
      if (token && isTokenExpired(token)) {
        await clearToken().catch(() => {});
        set({ status: 'unauthenticated' });
        return;
      }
      set({ status: token ? 'authenticated' : 'unauthenticated' });
    } catch {
      // SecureStore 읽기 실패 — 'loading'에 갇혀 스플래시가 안 내려가는 것 방지
      set({ status: 'unauthenticated' });
    }
  },
  signIn: async (token, user) => {
    await setToken(token);
    set({ status: 'authenticated', user: user ?? null });
  },
  signOut: async () => {
    /* 푸시 토큰 해제를 **토큰을 지우기 전에** 한다.
       예전엔 clearToken()이 먼저라 PushBridge 언마운트 시점의 unregisterPush()가 항상 401로
       실패했고, 서버에 APNs 토큰이 남아 이전 사용자가 그 기기로 계속 푸시를 받았다. */
    try {
      await unregisterPush();
    } catch {
      // 해제 실패해도 로그아웃은 진행 — 로그아웃을 막는 게 더 나쁘다
    }
    await clearToken();
    set({ status: 'unauthenticated', user: null });
  },
}));
