/**
 * 할 일 목록 필터·그룹핑 — 웹 `frontend-todo/.../utils/todoFilters.js` +
 * `MobileListView.jsx`의 buildGroups/getDueTone를 RN으로 미러. 기존 앱과 동일한 동작.
 */
import type { Todo } from './api';
import { isTodoDone } from '@/features/status/queries';

export type MobileTab = 'today' | 'week' | 'all' | 'done' | 'recurring';

export type AssigneeLike = string | { email?: string };

function toDateOnly(ymd?: string): Date | null {
  if (!ymd) return null;
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** todo의 일정 범위(startAt~dueDate)가 [from, to]와 겹치는지 */
function isInRange(todo: Todo, from: Date, to: Date): boolean {
  const start = toDateOnly(todo.startAt);
  const due = toDateOnly(todo.dueDate);
  if (!start && !due) return false;
  const s = start ?? due!;
  const e = due ?? start!;
  return s <= to && e >= from;
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function getTomorrowRange() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function getThisWeekRange() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // 이번 주 월요일
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export const isRecurring = (t: Todo) => !!t.hasRecurrence || t.recurrenceSourceId != null;

/** "내 할 일" 필터 (담당자에 내 이메일 포함) */
export function filterMine(todos: Todo[], myEmail: string): Todo[] {
  if (!myEmail) return todos;
  return filterByAssigneeEmail(todos, myEmail);
}

/** 특정 담당자(email) 필터 */
export function filterByAssigneeEmail(todos: Todo[], email: string): Todo[] {
  return todos.filter((t) =>
    Array.isArray(t.assignees) &&
    t.assignees.some((a: AssigneeLike) => (typeof a === 'string' ? a === email : a?.email === email)),
  );
}

/** 담당자 미지정 필터 */
export function filterUnassigned(todos: Todo[]): Todo[] {
  return todos.filter((t) => !Array.isArray(t.assignees) || t.assignees.length === 0);
}

/**
 * 담당자 다중 필터(합집합). tokens 각 원소: 'me'(현재 사용자) · 'none'(미지정) · <email>(특정 멤버).
 * 빈 배열이면 필터 없음(그대로). 선택된 어느 하나라도 매칭되면 통과(OR).
 */
export function filterByAssignees(todos: Todo[], tokens: string[], myEmail: string): Todo[] {
  if (!tokens.length) return todos;
  const emails = new Set(tokens.filter((t) => t !== 'me' && t !== 'none'));
  if (tokens.includes('me') && myEmail) emails.add(myEmail);
  const wantNone = tokens.includes('none');
  return todos.filter((t) => {
    const list = Array.isArray(t.assignees) ? t.assignees : [];
    if (wantNone && list.length === 0) return true;
    return list.some((a: AssigneeLike) => emails.has(typeof a === 'string' ? a : a?.email ?? ''));
  });
}

/**
 * 태그 다중 필터(합집합). tagIds 중 **하나라도** 부착돼 있으면 통과(OR) — 담당 필터와 같은 규칙.
 * 빈 배열이면 필터 없음(그대로).
 */
export function filterByTags(todos: Todo[], tagIds: number[]): Todo[] {
  if (!tagIds.length) return todos;
  const want = new Set(tagIds);
  return todos.filter((t) => (t.tags ?? []).some((tag) => want.has(tag.id)));
}

/**
 * 홈 카드용 카운트 — **할 일 탭과 반드시 같은 기준**으로 센다.
 *
 * 예전엔 홈이 `dueDate === 오늘` 정확 일치로 셌고 할 일 탭은 startAt~dueDate 구간 겹침으로 셌다.
 * 그래서 홈이 "오늘 2"라고 해서 눌러 들어가면 4개가 나오는 식으로 숫자가 어긋났다(기간 있는 일은
 * 홈에서 아예 빠졌다). '완료'도 홈은 마감일 기준이라 마감일 없는 일을 끝내면 0으로 표시됐다 —
 * doneAt(실제 완료 시각) 기준으로 바꾼다.
 */
export function homeCounts(todos: Todo[], todayYmd: string) {
  const live = todos.filter((t) => !isTodoDone(t));
  const { start: ts, end: te } = getTodayRange();
  const { start: ws, end: we } = getThisWeekRange();
  return {
    today: live.filter((t) => isInRange(t, ts, te)).length,
    week: live.filter((t) => isInRange(t, ws, we)).length,
    // 지연: 마감일이 오늘보다 이전인 미완료
    overdue: live.filter((t) => t.dueDate != null && t.dueDate.slice(0, 10) < todayYmd).length,
    // 오늘 완료: 마감일이 아니라 실제 완료 시각 기준
    doneToday: todos.filter((t) => t.doneAt != null && t.doneAt.slice(0, 10) === todayYmd).length,
  };
}

/** 탭별 카운트 (완료 제외, done/recurring은 그대로) */
export function tabCounts(todos: Todo[]) {
  const live = todos.filter((t) => !isTodoDone(t));
  const { start: ts, end: te } = getTodayRange();
  const { start: ws, end: we } = getThisWeekRange();
  return {
    today: live.filter((t) => isInRange(t, ts, te)).length,
    week: live.filter((t) => isInRange(t, ws, we)).length,
    all: live.length,
    done: todos.filter((t) => isTodoDone(t)).length,
    recurring: todos.filter(isRecurring).length,
  };
}

/** 탭별 flat 필터 — 칸반(보드) 뷰용. (done 탭은 보드에서 의미 없어 호출부에서 all로 대체) */
export function filterForTab(tab: MobileTab, todos: Todo[]): Todo[] {
  const live = todos.filter((t) => (t.status as string) !== 'ARCHIVED' && !t.archived);
  if (tab === 'recurring') return live.filter(isRecurring);
  if (tab === 'today') {
    const { start, end } = getTodayRange();
    return live.filter((t) => isInRange(t, start, end));
  }
  if (tab === 'week') {
    const { start, end } = getThisWeekRange();
    return live.filter((t) => isInRange(t, start, end));
  }
  return live; // all / done
}

export type SortKey = 'default' | 'due' | 'priority' | 'title';
const PRIO_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** 정렬 — default는 원순서 유지. due는 마감 빠른 순(없으면 뒤), priority는 높→낮, title은 가나다. */
export function sortTodos(todos: Todo[], key: SortKey): Todo[] {
  if (key === 'default') return todos;
  const arr = [...todos];
  if (key === 'due') {
    arr.sort((a, b) => (a.dueDate ?? '~').localeCompare(b.dueDate ?? '~'));
  } else if (key === 'priority') {
    arr.sort((a, b) => (PRIO_RANK[a.priority ?? 'LOW'] ?? 2) - (PRIO_RANK[b.priority ?? 'LOW'] ?? 2));
  } else if (key === 'title') {
    arr.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  }
  return arr;
}

export type TodoGroup = { label: string; accent?: boolean; items: Todo[] };

/** 탭별 그룹핑 — 웹 MobileListView.buildGroups와 동일 */
export function buildGroups(tab: MobileTab, todos: Todo[]): TodoGroup[] {
  const live = todos.filter((t) => (t.status as string) !== 'ARCHIVED' && !t.archived);
  const undone = (arr: Todo[]) => arr.filter((t) => !isTodoDone(t));
  const done = (arr: Todo[]) => arr.filter((t) => isTodoDone(t));

  if (tab === 'today') {
    const { start, end } = getTodayRange();
    const inToday = live.filter((t) => isInRange(t, start, end));
    return [
      { label: '진행 중', accent: true, items: undone(inToday) },
      { label: '완료', items: done(inToday) },
    ].filter((g) => g.items.length > 0);
  }

  if (tab === 'week') {
    const { start: tS, end: tE } = getTodayRange();
    const { start: mS, end: mE } = getTomorrowRange();
    const { start: wS, end: wE } = getThisWeekRange();
    const u = undone(live);
    const todayItems = u.filter((t) => isInRange(t, tS, tE));
    const tmrItems = u.filter((t) => isInRange(t, mS, mE));
    const seen = new Set([...todayItems, ...tmrItems].map((t) => t.id));
    const weekItems = u.filter((t) => isInRange(t, wS, wE) && !seen.has(t.id));
    return [
      { label: '오늘', accent: true, items: todayItems },
      { label: '내일', items: tmrItems },
      { label: '이번 주', items: weekItems },
    ].filter((g) => g.items.length > 0);
  }

  if (tab === 'all') {
    const u = undone(live);
    return [
      { label: '높은 우선순위', accent: true, items: u.filter((t) => t.priority === 'HIGH') },
      { label: '중간', items: u.filter((t) => t.priority === 'MEDIUM') },
      { label: '낮음', items: u.filter((t) => !t.priority || t.priority === 'LOW') },
      { label: '완료', items: done(live) },
    ].filter((g) => g.items.length > 0);
  }

  if (tab === 'done') {
    return [{ label: '완료', accent: true, items: done(live) }].filter((g) => g.items.length > 0);
  }

  // recurring
  const recurring = live.filter(isRecurring);
  return [
    { label: '진행 중', accent: true, items: undone(recurring) },
    { label: '완료', items: done(recurring) },
  ].filter((g) => g.items.length > 0);
}

export type DueTone = { color: string; label: string; weight: '700' } | null;

/** 마감일 D-day 색조/라벨 — 지연(red)/오늘(blue)/내일(orange), 그 외 null */
export function getDueTone(dateStr?: string): DueTone {
  const due = toDateOnly(dateStr);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dDiff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (dDiff < 0) return { color: '#E5484D', label: `${Math.abs(dDiff)}일 지연`, weight: '700' };
  if (dDiff === 0) return { color: '#3D7BFF', label: '오늘', weight: '700' };
  if (dDiff === 1) return { color: '#fb923c', label: '내일', weight: '700' };
  return null;
}

/** "M월 D일" */
export function formatMonthDay(dateStr?: string): string {
  const d = toDateOnly(dateStr);
  if (!d) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
