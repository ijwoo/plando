import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';

import type { DueFilter } from '@/features/todo/TaskFilterSheet';
import type { MobileTab, SortKey } from '@/features/todo/todoFilters';
import type { TodoPriority } from '@/shared/ui/tone';

const LEGACY_KEY = 'plando_smart_views';
/**
 * 스마트 뷰는 **워크스페이스별로** 저장한다.
 * 예전엔 전역 키 하나라 A 워크스페이스에서 만든 뷰가 B에서도 떴고, 뷰에 담긴 담당자 이메일·
 * 태그 id가 그 워크스페이스에 없어서 적용하면 목록이 비었다(웹은 plando.savedViews.<wsId>로 분리).
 * 기존 전역 저장분은 처음 로드하는 워크스페이스로 1회 승계한다 — 어디에 속했는지 알 수 없지만
 * 버리는 것보다 낫고, 승계 후 전역 키는 지워 중복 승계를 막는다.
 */
const keyFor = (wsId: number) => `plando_smart_views.${wsId}`;

/**
 * 스마트 뷰 — 탭·담당·우선순위·마감·태그·정렬 조합을 이름 붙여 저장하고 한 번에 불러온다.
 * (클릭업 저장된 뷰) 기기 로컬 저장(SecureStore) — 백엔드 변경 없음.
 */
export type SmartView = {
  id: string;
  name: string;
  tab: MobileTab;
  /** 담당 다중 필터 토큰: 'me'(내 할 일) · 'none'(미지정) · <email>(멤버). 합집합. */
  assignees: string[];
  prio: TodoPriority[];
  due: DueFilter;
  sort: SortKey;
  /** 태그 다중 필터(태그 id). 합집합. 태그 필터 도입 전 저장분엔 없어 viewTags로 정규화한다. */
  tags: number[];
  // ── 레거시(구버전 저장분) — viewAssignees로 자동 승계 ──
  myOnly?: boolean;
  assigneeFilter?: string | null;
};

/** 저장 조건(id·name 제외) — 현재 필터 상태와 뷰의 일치 판정에 사용 */
export type SmartViewCriteria = Omit<SmartView, 'id' | 'name'>;

/** 뷰의 담당 토큰 목록 — 구버전(myOnly/단일 assigneeFilter)을 다중 토큰으로 승계 */
export function viewAssignees(v: Partial<SmartView>): string[] {
  if (Array.isArray(v.assignees)) return v.assignees;
  const out: string[] = [];
  if (v.myOnly) out.push('me');
  if (v.assigneeFilter) out.push(v.assigneeFilter);
  return out;
}

/** 뷰의 태그 id 목록 — 태그 필터 이전에 저장된 뷰(필드 없음)는 "태그 조건 없음"으로 본다 */
export function viewTags(v: Partial<SmartView>): number[] {
  return Array.isArray(v.tags) ? v.tags : [];
}

function sameSet<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** 두 조건이 같은지 — 적용 중인 뷰 하이라이트용 */
export function sameCriteria(a: SmartViewCriteria, b: SmartViewCriteria): boolean {
  return (
    a.tab === b.tab &&
    sameSet(viewAssignees(a), viewAssignees(b)) &&
    sameSet(viewTags(a), viewTags(b)) &&
    a.due === b.due &&
    a.sort === b.sort &&
    a.prio.length === b.prio.length &&
    a.prio.every((p) => b.prio.includes(p))
  );
}

interface SmartViewState {
  views: SmartView[];
  hydrated: boolean;
  /** 지금 메모리에 올라온 뷰가 어느 워크스페이스 것인지 — 전환 시 재로드 판단용 */
  wsId: number | null;
  hydrate: () => Promise<void>;
  add: (name: string, criteria: SmartViewCriteria) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

let seq = 0;
function newId(): string {
  // 앱 런타임 — Date.now 가용. 같은 ms 연속 추가 대비 seq 결합.
  seq += 1;
  return `${Date.now().toString(36)}-${seq}`;
}

function persist(wsId: number | null, views: SmartView[]) {
  if (wsId == null) return; // 워크스페이스 미확정이면 저장하지 않는다(귀속처가 없다)
  void SecureStore.setItemAsync(keyFor(wsId), JSON.stringify(views)).catch(() => {});
}

export const useSmartViews = create<SmartViewState>((set, get) => ({
  views: [],
  hydrated: false,
  wsId: null,
  hydrate: async () => {
    const wsId = useWorkspaceStore.getState().activeId;
    // 워크스페이스가 바뀌면 다시 읽어야 하므로 hydrated로 막지 않고 wsId를 비교한다
    if (get().hydrated && get().wsId === wsId) return;
    if (wsId == null) {
      set({ views: [], hydrated: true, wsId: null });
      return;
    }
    try {
      let raw = await SecureStore.getItemAsync(keyFor(wsId));
      if (raw == null) {
        // 전역 키에 남은 구버전 저장분을 이 워크스페이스로 1회 승계
        const legacy = await SecureStore.getItemAsync(LEGACY_KEY);
        if (legacy != null) {
          await SecureStore.setItemAsync(keyFor(wsId), legacy).catch(() => {});
          await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
          raw = legacy;
        }
      }
      const parsed = raw ? (JSON.parse(raw) as SmartView[]) : [];
      set({ views: Array.isArray(parsed) ? parsed : [], hydrated: true, wsId });
    } catch {
      set({ views: [], hydrated: true, wsId });
    }
  },
  add: (name, criteria) => {
    const view: SmartView = { id: newId(), name: name.trim().slice(0, 20), ...criteria };
    const views = [...get().views, view];
    set({ views });
    persist(get().wsId, views);
  },
  remove: (id) => {
    const views = get().views.filter((v) => v.id !== id);
    set({ views });
    persist(get().wsId, views);
  },
  rename: (id, name) => {
    const views = get().views.map((v) => (v.id === id ? { ...v, name: name.trim().slice(0, 20) } : v));
    set({ views });
    persist(get().wsId, views);
  },
}));
