import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { MobileTab } from '@/features/todo/todoFilters';

/**
 * 할 일 화면의 마지막 탭·보기 모드.
 *
 * 예전엔 화면 로컬 useState라 앱을 껐다 켤 때마다 '오늘' + 목록으로 돌아갔다.
 * 보드를 주로 쓰는 사람은 실행할 때마다 ⋯ 메뉴에서 보드를 다시 골라야 했다.
 *
 * 워크스페이스로 나누지 않는다 — 탭·보기 취향은 사람에 붙는 것이지 워크스페이스에 붙지 않는다.
 * (프로젝트 스코프는 반대라 워크스페이스별로 저장한다 — projectStore 참고)
 */
export type ViewMode = 'list' | 'board';

const TAB_KEY = 'plando_todo_tab';
const VIEW_KEY = 'plando_todo_view';

const TABS: MobileTab[] = ['today', 'week', 'all', 'done', 'recurring'];

interface ListPrefsState {
  tab: MobileTab;
  view: ViewMode;
  /** 저장값을 읽기 전인지 — 복원 전에 화면이 기본값으로 한 번 그려지는 걸 구분할 때 사용 */
  hydrated: boolean;
  setTab: (t: MobileTab) => void;
  setView: (v: ViewMode) => void;
  hydrate: () => Promise<void>;
}

export const useListPrefs = create<ListPrefsState>((set, get) => ({
  tab: 'today',
  view: 'list',
  hydrated: false,
  setTab: (t) => {
    set({ tab: t });
    void SecureStore.setItemAsync(TAB_KEY, t).catch(() => {});
  },
  setView: (v) => {
    set({ view: v });
    void SecureStore.setItemAsync(VIEW_KEY, v).catch(() => {});
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const [tab, view] = await Promise.all([
        SecureStore.getItemAsync(TAB_KEY),
        SecureStore.getItemAsync(VIEW_KEY),
      ]);
      set({
        // 저장값이 깨졌거나 없어진 탭이면 기본값으로 — 빈 화면이 뜨지 않게
        tab: TABS.includes(tab as MobileTab) ? (tab as MobileTab) : 'today',
        view: view === 'board' ? 'board' : 'list',
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
}));
