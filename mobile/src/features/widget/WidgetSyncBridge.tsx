import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getToken } from '@/api/auth';
import { isTodoDone, useStatusMap } from '@/features/status/queries';
import { useMyWorkspaces } from '@/features/workspace/queries';
import { useTodos } from '@/features/todo/queries';
import type { Todo } from '@/features/todo/api';
import { Widget, type WidgetTodo } from '@/native-modules/widget';
import { API_BASE_URL } from '@/shared/config/env';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toDateString } from '@/shared/utils/datetime';

/**
 * 위젯 동기화 브리지 (인증 시 루트 마운트, 렌더 없음) — 웹 widgetSync.js 포팅.
 * 할 일이 바뀔 때마다 오늘 목록(상위 10) + 달력 범위(±7일, 최대 60)를 App Group에 push.
 * 로그인 상태·토큰·워크스페이스는 인터랙티브 체크박스(ToggleTodoIntent)용.
 */

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** "YYYY-MM-DD"를 로컬 자정으로 — new Date(문자열)은 UTC 자정으로 읽어 UTC 서쪽에서 하루 밀린다 */
function parseLocalDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeDDay(dateStr?: string | null): string | null {
  const due = parseLocalDate(dateStr);
  if (!due) return null;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'D-day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

/** 상태 key → 카테고리 판정 (useStatusMap().category) */
type CategoryOf = (key?: string | null) => string;

/**
 * "오늘 task": dueDate가 오늘 OR 오늘 생성된 TODO (웹 isTodayTodo와 동일 사양).
 *
 * 예전엔 key를 'TODO' 문자열과 직접 비교했다. 커스텀 상태(st_<uuid>)를 쓰는 워크스페이스에서는
 * 오늘 만든 할 일이 전부 이 조건에서 탈락해 위젯 집계에서 사라졌다. 같은 파일의 완료 판정은
 * 이미 상태 맵을 쓰고 있었는데 여기만 남아 있었다 — 카테고리 기준으로 통일한다.
 */
function isTodayTodo(t: Todo, category: CategoryOf): boolean {
  const todayStr = toDateString(new Date());
  if (t.dueDate === todayStr) return true;
  // createdAt은 ISO 타임스탬프 — 로컬 날짜로 환산해 비교
  const created = t.createdAt ? toDateString(new Date(String(t.createdAt))) : null;
  return created === todayStr && category(t.status) === 'TODO';
}

function compareTodos(a: Todo, b: Todo): number {
  const aDue = a.dueDate ?? null;
  const bDue = b.dueDate ?? null;
  if (aDue && bDue) {
    const diff = new Date(aDue).getTime() - new Date(bDue).getTime();
    if (diff !== 0) return diff;
  } else if (aDue) return -1;
  else if (bDue) return 1;
  const aP = PRIORITY_ORDER[String(a.priority ?? '').toUpperCase()] ?? 99;
  const bP = PRIORITY_ORDER[String(b.priority ?? '').toUpperCase()] ?? 99;
  return aP - bP;
}

function mapToWidgetTodo(t: Todo, category: CategoryOf): WidgetTodo {
  return {
    id: Number(t.id) || 0,
    title: String(t.title ?? ''),
    priority: String(t.priority ?? 'LOW').toUpperCase(),
    // 위젯(Swift)은 status를 "TODO"|"IN_PROGRESS"|"DONE"으로만 비교한다(TodoEntry.swift).
    // 커스텀 키를 그대로 넘기면 완료 취소선·진행 아이콘이 전부 죽으므로 카테고리로 환산해 보낸다.
    status: isTodoDone(t) ? 'DONE' : category(t.status) === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TODO',
    starred: !!t.focused,
    dueDate: t.dueDate ?? null,
    dDay: computeDDay(t.dueDate),
    projectId: t.projectId != null ? Number(t.projectId) : null,
  };
}

function buildPayload(all: Todo[], category: CategoryOf, workspaceName?: string) {
  const today = all.filter((t) => isTodayTodo(t, category));
  const sorted = [...today].sort(compareTodos);

  // 달력 위젯 — 이번 달 ±7일 범위의 dueDate 일정 (웹 buildCalendarWidgetData 동일)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1 - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0 + 7);
  end.setHours(23, 59, 59, 999);
  const dated = all
    .filter((t) => {
      const d = parseLocalDate(t.dueDate);
      return !!d && d >= start && d <= end;
    })
    .sort((a, b) => (parseLocalDate(a.dueDate)?.getTime() ?? 0) - (parseLocalDate(b.dueDate)?.getTime() ?? 0));

  return {
    total: today.length,
    done: today.filter((t) => isTodoDone(t)).length,
    todos: sorted.slice(0, 10).map((t) => mapToWidgetTodo(t, category)),
    calendarTodos: dated.slice(0, 60).map((t) => mapToWidgetTodo(t, category)),
    ...(workspaceName ? { workspaceName } : {}),
  };
}

export function WidgetSyncBridge() {
  const { data: todos } = useTodos();
  const { data: workspaces } = useMyWorkspaces();
  const { category } = useStatusMap();
  const activeId = useWorkspaceStore((s) => s.activeId);

  // 로그인 상태 + 토큰/워크스페이스/API 베이스 — 위젯 체크박스 백엔드 호출용
  useEffect(() => {
    if (Platform.OS !== 'ios' || activeId == null) return;
    void (async () => {
      const token = await getToken().catch(() => null);
      Widget.setLoggedIn(true, token, activeId, API_BASE_URL);
    })();
  }, [activeId]);

  // 할 일 변경 → 스냅샷 push
  useEffect(() => {
    if (Platform.OS !== 'ios' || !todos) return;
    const wsName = workspaces?.find((w) => w.workspaceId === activeId)?.workspaceName;
    Widget.updateTodos(buildPayload(todos, category, wsName ?? undefined));
  }, [todos, workspaces, activeId, category]);

  return null;
}
