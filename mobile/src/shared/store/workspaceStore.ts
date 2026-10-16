import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { setActiveWorkspaceId } from '@/api/client';
import { getMyWorkspaces } from '@/features/workspace/api';

const LAST_WS_KEY = 'plando.lastWorkspaceId';

/**
 * 활성 워크스페이스. 대부분의 리소스(todo·DM·알림 등)가 워크스페이스 스코프라
 * 로그인 후 활성 워크스페이스를 해석해 X-Workspace-Id 헤더로 주입한다.
 * (DM 방 목록 등 일부 엔드포인트는 이 헤더가 필수)
 *
 * 마지막 선택은 SecureStore에 저장 — 리로드/재시작해도 보던 워크스페이스로 복원.
 * 저장된 id가 내 목록에 없으면(탈퇴·다른 계정 로그인) OWNER 우선 기본값으로 폴백.
 */
interface WorkspaceState {
  activeId: number | null;
  ready: boolean;
  /** 해석이 실패한 상태인지 — 재시도 UI/자동 재시도 판단용 */
  failed: boolean;
  /** 마지막 선택 → 없으면 기본값(OWNER 우선)을 골라 활성화 */
  resolve: () => Promise<void>;
  /** 활성 워크스페이스 전환 (호출 측에서 쿼리 무효화 필요) */
  setActive: (id: number) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeId: null,
  ready: false,
  failed: false,
  resolve: async () => {
    try {
      const [list, saved] = await Promise.all([
        getMyWorkspaces(),
        SecureStore.getItemAsync(LAST_WS_KEY).catch(() => null),
      ]);
      const savedId = saved != null ? Number(saved) : null;
      const chosen =
        list.find((w) => w.workspaceId === savedId) ?? list.find((w) => w.role === 'OWNER') ?? list[0];
      const id = chosen?.workspaceId ?? null;
      setActiveWorkspaceId(id);
      set({ activeId: id, ready: true });
    } catch {
      /* 해석 실패. 예전엔 여기서 ready=true만 세우고 activeId를 null로 남겼는데, 그러면
         워크스페이스 스코프 쿼리가 전부 enabled:false로 죽고 홈이 "워크스페이스를 만들어
         시작하세요"를 띄운다 — 이미 워크스페이스가 있는 사용자에게. 호출부가 로그인 전환에만
         걸려 있어 재시도도 없어서 앱을 완전히 종료해야만 복구됐다.
         실패는 실패로 남기고(ready=false), 화면이 "로딩 중"으로 보이게 한 뒤 재시도를 허용한다. */
      set({ ready: false, failed: true });
    }
  },
  setActive: (id) => {
    setActiveWorkspaceId(id);
    set({ activeId: id });
    void SecureStore.setItemAsync(LAST_WS_KEY, String(id)).catch(() => {});
  },
  reset: () => {
    setActiveWorkspaceId(null);
    set({ activeId: null, ready: false });
    void SecureStore.deleteItemAsync(LAST_WS_KEY).catch(() => {});
  },
}));
