import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';

/**
 * 활성 프로젝트 필터 (글로벌).
 * - `null`    = 전체 할 일
 * - `'inbox'` = 인박스(프로젝트 미지정 할 일)
 * - `number`  = 특정 프로젝트
 * 기존 앱 ActiveProjectContext와 동일하게 보드/리스트/캘린더를 필터링하는 데 사용.
 *
 * **워크스페이스별로 저장한다.** 예전엔 영속화가 없어 앱을 껐다 켜면 항상 '전체'로 돌아갔다
 * (웹 ActiveProjectContext는 워크스페이스별 localStorage에 저장 중 — 앱만 빠져 있었다).
 * 프로젝트 id는 워크스페이스마다 다르므로 키를 나눈다 — 전역 키였다면 워크스페이스를 바꿨을 때
 * 남의 프로젝트 id로 필터가 걸려 목록이 비어 보인다.
 */
export type ProjectScope = number | 'inbox' | null;

const keyFor = (wsId: number) => `plando_active_project.${wsId}`;

function serialize(scope: ProjectScope): string {
  return scope == null ? '' : String(scope);
}

function deserialize(raw: string | null): ProjectScope {
  if (!raw) return null;
  if (raw === 'inbox') return 'inbox';
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

interface ProjectFilterState {
  activeProjectId: ProjectScope;
  setActive: (id: ProjectScope) => void;
  /** 워크스페이스가 정해진(또는 바뀐) 뒤 호출 — 그 워크스페이스의 마지막 선택을 복원 */
  hydrateFor: (workspaceId: number | null) => Promise<void>;
}

export const useProjectFilter = create<ProjectFilterState>((set) => ({
  activeProjectId: null,
  setActive: (id) => {
    set({ activeProjectId: id });
    const wsId = useWorkspaceStore.getState().activeId;
    // 워크스페이스 미확정이면 저장하지 않는다 — 어느 워크스페이스의 선택인지 알 수 없다
    if (wsId == null) return;
    void SecureStore.setItemAsync(keyFor(wsId), serialize(id)).catch(() => {});
  },
  hydrateFor: async (workspaceId) => {
    if (workspaceId == null) {
      set({ activeProjectId: null });
      return;
    }
    try {
      const raw = await SecureStore.getItemAsync(keyFor(workspaceId));
      set({ activeProjectId: deserialize(raw) });
    } catch {
      set({ activeProjectId: null });
    }
  },
}));
