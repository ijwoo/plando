import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useTodos } from '@/features/todo/queries';
import type { Todo } from '@/features/todo/api';
import { Spotlight, type SpotlightTodo } from '@/native-modules/spotlight';
import { useAuthStore } from '@/shared/store/authStore';

/**
 * Spotlight 동기화 브리지 (루트 마운트, 렌더 없음) — WidgetSyncBridge와 동일 패턴.
 * 할 일이 바뀔 때마다 활성(미보관) 할 일을 iOS 시스템 검색에 색인(최대 200개, 디바운스).
 * 로그아웃 시 색인 전체 제거 — 인증 상태 전환을 직접 감시하므로 게이트 없이 마운트한다.
 */

const MAX_ITEMS = 200;
const DEBOUNCE_MS = 800;

function mapToSpotlightTodo(t: Todo): SpotlightTodo {
  return {
    id: Number(t.id) || 0,
    title: String(t.title ?? ''),
    content: t.content ?? null,
    due: t.dueDate ?? null,
  };
}

export function SpotlightSyncBridge() {
  const status = useAuthStore((s) => s.status);
  const { data: todos } = useTodos(); // 활성 워크스페이스의 미보관 목록 (미인증이면 disabled)
  const prevStatusRef = useRef<typeof status | null>(null);

  // 실제 로그아웃(authenticated → unauthenticated)일 때만 색인 제거
  // (_layout의 Widget.clear와 같은 사양 — 비로그인 부팅으로는 지우지 않음)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (status === 'unauthenticated' && prevStatusRef.current === 'authenticated') {
      Spotlight.clearAll();
    }
    prevStatusRef.current = status;
  }, [status]);

  // 할 일 변경 → 디바운스 후 전체 재색인
  useEffect(() => {
    if (Platform.OS !== 'ios' || status !== 'authenticated' || !todos) return;
    const timer = setTimeout(() => {
      const items = todos
        .filter((t) => !t.archived && t.id != null && t.title)
        .slice(0, MAX_ITEMS)
        .map(mapToSpotlightTodo);
      Spotlight.indexTodos(items);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [todos, status]);

  return null;
}
