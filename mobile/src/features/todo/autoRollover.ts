import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { isTodoDone } from '@/features/status/queries';
import type { Todo } from '@/features/todo/api';
import { toDateString } from '@/shared/utils/datetime';

const ENABLED_KEY = 'plando_auto_rollover';
const LASTRUN_KEY = 'plando_auto_rollover_lastrun';

/**
 * 미완료 자동 이월 — 켜면 하루 1회, 마감이 지난 미완료 '내 할 일'의 마감일을 오늘로 옮긴다.
 * (Things/Todoist식) 기기 로컬 옵트인(기본 꺼짐). 협업 워크스페이스이므로 **남의 마감은 절대
 * 건드리지 않는다** — 담당자 없음 또는 담당자가 나 혼자인 할 일만 대상. 실행 결과는 토스트로 투명하게.
 */
interface AutoRolloverState {
  enabled: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (v: boolean) => Promise<void>;
}

export const useAutoRollover = create<AutoRolloverState>((set, get) => ({
  enabled: false,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const v = await SecureStore.getItemAsync(ENABLED_KEY);
      set({ enabled: v === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setEnabled: async (v) => {
    set({ enabled: v });
    try {
      await SecureStore.setItemAsync(ENABLED_KEY, v ? '1' : '0');
    } catch {
      /* 세션 내 반영됨 */
    }
  },
}));

/** 이 할 일이 '순수하게 내 것'인가 — 담당자 없음 또는 나 혼자. (팀 마감 보호) */
function isMineOnly(todo: Todo, myEmail: string): boolean {
  const emails = (todo.assignees ?? []).map((a) => a.email).filter(Boolean) as string[];
  if (emails.length === 0) return true;
  return emails.length === 1 && emails[0] === myEmail;
}

/**
 * 오늘 아직 안 돌았으면, 지난 미완료 '내 할 일'을 오늘로 이월.
 * @returns 이월한 할 일 id 목록 (0건이면 빈 배열 — 호출부에서 토스트 억제)
 */
export async function collectRolloverTargets(todos: Todo[], myEmail: string): Promise<Todo[]> {
  const today = toDateString(new Date());
  let lastRun: string | null = null;
  try {
    lastRun = await SecureStore.getItemAsync(LASTRUN_KEY);
  } catch {
    lastRun = null;
  }
  if (lastRun === today) return []; // 오늘 이미 실행

  return todos.filter(
    (t) =>
      !isTodoDone(t) &&
      !t.archived &&
      t.parentId == null && // 서브태스크는 부모 따라감 — 개별 이월 안 함
      !!t.dueDate &&
      t.dueDate < today &&
      isMineOnly(t, myEmail),
  );
}

/** 실행 완료 표시 — 대상이 없어도 오늘 돌았음을 기록해 반복 스캔 방지 */
export async function markRolloverRun(): Promise<void> {
  try {
    await SecureStore.setItemAsync(LASTRUN_KEY, toDateString(new Date()));
  } catch {
    /* 무시 */
  }
}
