import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { Todo } from '@/features/todo/api';
import { isTodoDone } from '@/features/status/queries';
import { useTodos } from '@/features/todo/queries';
import { LiveActivity } from '@/native-modules/liveactivity';
import { useLiveActivityStore } from '@/shared/store/liveActivityStore';
import { toDateString } from '@/shared/utils/datetime';

/**
 * Live Activity 동기화 브리지 (인증 시 루트 마운트, 렌더 없음).
 * 오늘 시간 일정이 남아 있는 동안 잠금화면·다이나믹 아일랜드에 진행 상황(완료/전체 + 다음 일정)을 유지하고,
 * 모두 끝나면 마지막 상태(🎉)로 갱신 후 다음 날 자동 교체된다. 할 일 캐시가 바뀔 때마다 갱신.
 */
export function LiveActivityBridge() {
  const { data: todos } = useTodos();
  const enabled = useLiveActivityStore((s) => s.enabled);
  const hydrated = useLiveActivityStore((s) => s.hydrated);

  useEffect(() => {
    void useLiveActivityStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !todos || !hydrated) return;
    if (!enabled) {
      LiveActivity.end();
      return;
    }

    const today = toDateString(new Date());
    const todayTodos = todos.filter((t) => t.dueDate === today);
    if (todayTodos.length === 0) {
      LiveActivity.end();
      return;
    }

    const done = todayTodos.filter((t) => isTodoDone(t)).length;
    const next = nextUpcoming(todayTodos);
    LiveActivity.startOrUpdate(today, done, todayTodos.length, next?.title ?? null, next?.startTime ?? null, next?.id ?? null);
  }, [todos, enabled, hydrated]);

  return null;
}

/** 다음 일정 — 미완료 중 현재 시각 이후 startTime이 가장 이른 것, 없으면 시간 미정 미완료 첫 항목 */
function nextUpcoming(todayTodos: Todo[]): { title: string; startTime: string | null; id: number | null } | null {
  const now = new Date();
  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const open = todayTodos.filter((t) => !isTodoDone(t));
  if (open.length === 0) return null;

  const timed = open
    .filter((t) => !!t.startTime && String(t.startTime) >= nowHm)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  if (timed[0]) return { title: timed[0].title ?? '할 일', startTime: String(timed[0].startTime).slice(0, 5), id: timed[0].id ?? null };

  return { title: open[0].title ?? '할 일', startTime: null, id: open[0].id ?? null };
}
