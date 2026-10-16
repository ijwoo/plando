import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { getApiErrorMessage } from '@/api/error';
import { isTodoDone } from '@/features/status/queries';
import { updateTodoStatus } from './api';
import type { Todo } from './api';
import { queryClient } from '@/shared/query/queryClient';
import type { WorkflowStatusLite } from '@/api/typesExt';

/**
 * 할 일 마감 리마인더 — 전부 클라이언트 로컬(백엔드 무변경).
 * - 대상: 내 할 일(담당자가 나이거나 담당자 없음) 중 미완료·미보관.
 * - 시점: 시간 있는 할 일은 시작(startAt+startTime)/마감(dueDate+endTime) N분 전(설정: 정시/10/30/60),
 *   날짜만 있는 할 일은 마감일 아침 9시 고정.
 * - reconcile: 예약된 `todo-due-*`와 원하는 예약을 diff해 추가/취소. 과거 시점 스킵,
 *   iOS 예약 상한(64) 고려 가까운 순 최대 32개.
 * - 알림 액션: [완료] / [1시간 뒤 알림] (응답 처리는 PushBridge 전역 리스너에서 호출).
 * 설정은 기기 로컬(SecureStore) — completionFeedback 패턴(키+모듈 캐시).
 * 모든 네이티브 호출은 try/catch — 네이티브 모듈 없는 빌드에서 크래시 방지.
 */


/**
 * 완료 상태 key — 훅 밖(알림 액션 핸들러)이라 쿼리 캐시에서 직접 읽는다.
 * 'DONE' 하드코딩은 그 key를 지운 워크스페이스에서 400이 난다.
 */
function resolveDoneKey(): string {
  try {
    const qc = queryClient;
    for (const [, data] of qc.getQueriesData<WorkflowStatusLite[]>({ queryKey: ['statuses'] })) {
      const hit = (data ?? []).find((x) => x.category === 'DONE');
      if (hit?.statusKey) return hit.statusKey;
    }
  } catch {
    // 캐시 접근 실패 — 기본값으로 진행
  }
  return 'DONE';
}

export const TODO_DUE_CATEGORY = 'plando.todo.due';
export const TODO_DUE_ACTION_COMPLETE = 'todo-due-complete';
export const TODO_DUE_ACTION_SNOOZE = 'todo-due-snooze';

const DUE_PREFIX = 'todo-due-'; // 예약 identifier: todo-due-{todoId}-{발화시각ms}
const SNOOZE_PREFIX = 'todo-snooze-'; // 스누즈 identifier: todo-snooze-{todoId}
const LEGACY_PREFIX = 'due-'; // 구 syncDueReminders 잔여 예약 — reconcile 때 청소
const MAX_SCHEDULED = 32; // iOS 로컬 예약 상한 64의 절반 — leave-/route-briefing-/checkin- 여유분
const DATE_ONLY_HOUR = 9; // 날짜만 있는 할 일 알림 시각 (아침 9시 고정)
const SNOOZE_MS = 60 * 60_000;
const DEBOUNCE_MS = 5_000;

const ENABLED_KEY = 'plando_todo_reminder_enabled';
const LEAD_KEY = 'plando_todo_reminder_lead';
const LEAD_VALUES = [0, 10, 30, 60];
const DEFAULT_LEAD = 30;

/** 설정 세그먼트 옵션 — 시간 있는 할 일에 적용되는 선행 분 */
export const REMINDER_LEAD_OPTIONS = [
  { value: '0', label: '정시' },
  { value: '10', label: '10분 전' },
  { value: '30', label: '30분 전' },
  { value: '60', label: '1시간 전' },
];

export type ReminderSettings = { enabled: boolean; leadMinutes: number };

// ── 기기 로컬 설정 (SecureStore + 캐시) ──────────────────────────
let settingsCache: ReminderSettings | null = null;

export async function hydrateReminderSettings(): Promise<ReminderSettings> {
  if (settingsCache) return settingsCache;
  let enabled = true; // 기본 켬
  let leadMinutes = DEFAULT_LEAD;
  try {
    const [e, l] = await Promise.all([SecureStore.getItemAsync(ENABLED_KEY), SecureStore.getItemAsync(LEAD_KEY)]);
    if (e != null) enabled = e === '1';
    const n = l != null ? Number(l) : NaN;
    if (LEAD_VALUES.includes(n)) leadMinutes = n;
  } catch {
    // 읽기 실패 — 기본값 사용
  }
  settingsCache = { enabled, leadMinutes };
  return settingsCache;
}

export async function setReminderEnabled(v: boolean): Promise<void> {
  const cur = await hydrateReminderSettings();
  settingsCache = { ...cur, enabled: v };
  try {
    await SecureStore.setItemAsync(ENABLED_KEY, v ? '1' : '0');
  } catch {
    // 저장 실패해도 세션 내에는 반영
  }
  void runReconcile(); // 끄면 전부 취소, 켜면 즉시 재예약
}

export async function setReminderLead(leadMinutes: number): Promise<void> {
  const cur = await hydrateReminderSettings();
  settingsCache = { ...cur, leadMinutes };
  try {
    await SecureStore.setItemAsync(LEAD_KEY, String(leadMinutes));
  } catch {
    // 저장 실패해도 세션 내에는 반영
  }
  void runReconcile();
}

/** 알림 권한 보장 — 이미 허용이면 그대로, 미결정일 때만 요청(영구 거부면 요청하지 않음). */
export async function ensureReminderPermission(): Promise<boolean> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.status === 'granted') return true;
    if (p.status !== 'undetermined' && !p.canAskAgain) return false; // 영구 거부 — 설정 앱 안내는 호출부에서
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch {
    return false;
  }
}

/** 알림 액션 카테고리 등록 — 앱 시작 시 1회 (PushBridge 콜드스타트에서 호출) */
export async function registerTodoDueCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(TODO_DUE_CATEGORY, [
      { identifier: TODO_DUE_ACTION_COMPLETE, buttonTitle: '✓ 완료', options: { opensAppToForeground: false } },
      { identifier: TODO_DUE_ACTION_SNOOZE, buttonTitle: '1시간 뒤 알림', options: { opensAppToForeground: false } },
    ]);
  } catch {
    // 네이티브 모듈 없음(리빌드 전) — 무시
  }
}

// ── 스케줄 계산 ──────────────────────────────────────────────
type Planned = { id: number; at: Date; title: string; body: string };

function parseHm(s?: string): { h: number; m: number } | null {
  if (!s) return null;
  const [h, m] = String(s).split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return { h, m: Number.isFinite(m) ? m : 0 };
}

function dayAt(ymd: string | undefined, h: number, m: number): Date | null {
  if (!ymd) return null;
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(h, m, 0, 0);
  return d;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const LEAD_LABEL: Record<number, string> = { 10: '10분', 30: '30분', 60: '1시간' };

/** 내 할 일 — 담당자에 내가 있거나 담당자가 아무도 없는 경우 (todoFilters '내 할 일'의 확장) */
function isMine(t: Todo, myEmail?: string): boolean {
  const assignees = t.assignees ?? [];
  if (assignees.length === 0) return true;
  if (!myEmail) return false;
  return assignees.some((a) => a.email === myEmail);
}

/**
 * 예약 대상 — 미완료·미보관, 그리고 **샘플이 아닌** 할 일.
 *
 * 샘플(isSample)은 서버가 역할과 무관하게 수정을 막는다(403). 예약해 두면 알림의 [✓ 완료]가
 * 반드시 실패하는데, 알림은 이미 사라진 뒤라 사용자에겐 "완료했는데 그대로"로 보인다.
 * 둘러보기 워크스페이스는 전부 샘플이라 리마인더 전체가 그 상태였다. 실패를 안내하는 것보다
 * 아예 예약하지 않는 쪽이 맞다 — 할 수 없는 동작은 보여주지 않는다.
 */
function isActive(t: Todo): boolean {
  return t.id != null && !t.isSample && !isTodoDone(t) && (t.status as string) !== 'ARCHIVED' && !t.archived;
}

/**
 * 할 일 1건의 리마인더 시점 — 시간 있는 할 일은 시작/마감 중 아직 오지 않은 가장 가까운
 * 시점의 lead분 전, 날짜만 있으면 마감일 09:00. 과거면 null(예약 안 함).
 */
function planReminder(t: Todo, leadMinutes: number, now: number): Planned | null {
  const id = t.id!;
  const title = t.title ?? '할 일';
  const start = parseHm(t.startTime);
  const end = parseHm(t.endTime);

  if (start || end) {
    // 시작일은 startAt(없으면 dueDate), 마감일은 dueDate(없으면 startAt) — 캘린더 이벤트 빌드와 동일 해석
    const candidates: { event: Date; kind: '시작' | '마감' }[] = [];
    const startEvent = start ? dayAt(t.startAt ?? t.dueDate, start.h, start.m) : null;
    if (startEvent) candidates.push({ event: startEvent, kind: '시작' });
    const dueEvent = end ? dayAt(t.dueDate ?? t.startAt, end.h, end.m) : null;
    if (dueEvent) candidates.push({ event: dueEvent, kind: '마감' });
    candidates.sort((a, b) => a.event.getTime() - b.event.getTime());
    for (const c of candidates) {
      const at = new Date(c.event.getTime() - leadMinutes * 60_000);
      if (at.getTime() <= now) continue; // 과거 시점 스킵 (시작이 지났으면 마감으로 폴백)
      const body =
        leadMinutes > 0
          ? `${LEAD_LABEL[leadMinutes] ?? `${leadMinutes}분`} 후 ${c.kind} (${hhmm(c.event)})`
          : c.kind === '시작'
            ? `지금 시작할 시간이에요 (${hhmm(c.event)})`
            : `지금이 마감 시간이에요 (${hhmm(c.event)})`;
      return { id, at, title, body };
    }
    return null;
  }

  // 날짜만 있는 할 일 — 마감일(없으면 시작일) 아침 9시
  const at = dayAt(t.dueDate ?? t.startAt, DATE_ONLY_HOUR, 0);
  if (!at || at.getTime() <= now) return null;
  return { id, at, title, body: t.dueDate ? '오늘 마감이에요' : '오늘 예정된 할 일이에요' };
}

// ── reconcile ────────────────────────────────────────────────
let lastArgs: { todos: Todo[]; myEmail?: string } | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastRun = 0;
let running = false;
let rerunRequested = false;

/**
 * todos 쿼리 성공 시마다 호출 — 5초 디바운스로 reconcile (invalidate 연쇄 과호출 방지).
 * 첫 호출(앱 시작)은 즉시 실행된다.
 */
export function requestReconcile(todos: Todo[], myEmail?: string): void {
  lastArgs = { todos, myEmail };
  if (debounceTimer != null) return; // 대기 중 — 최신 args로 합쳐서 1회 실행
  const wait = Math.max(0, DEBOUNCE_MS - (Date.now() - lastRun));
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runReconcile();
  }, wait);
}

async function runReconcile(): Promise<void> {
  if (!lastArgs) return; // 설정 변경이 todos 로드보다 먼저 — 다음 쿼리 성공 때 반영
  if (running) {
    rerunRequested = true;
    return;
  }
  running = true;
  try {
    do {
      rerunRequested = false;
      lastRun = Date.now();
      await reconcileTodoReminders(lastArgs.todos, lastArgs.myEmail);
    } while (rerunRequested);
  } finally {
    running = false;
  }
}

/** 예약 상태를 원하는 상태로 수렴 — 추가/취소만 수행(불변 예약은 건드리지 않음). */
async function reconcileTodoReminders(todos: Todo[], myEmail?: string): Promise<void> {
  try {
    const { enabled, leadMinutes } = await hydrateReminderSettings();
    let granted = false;
    try {
      granted = (await Notifications.getPermissionsAsync()).status === 'granted';
    } catch {
      granted = false;
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const dueScheduled = scheduled.filter((n) => n.identifier.startsWith(DUE_PREFIX));
    const snoozeScheduled = scheduled.filter((n) => n.identifier.startsWith(SNOOZE_PREFIX));
    const legacy = scheduled.filter((n) => n.identifier.startsWith(LEGACY_PREFIX));

    const cancel = (ids: string[]) => Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

    // 꺼짐/권한 없음 — 전부 취소 (스누즈 포함)
    if (!enabled || !granted) {
      await cancel([...dueScheduled, ...snoozeScheduled, ...legacy].map((n) => n.identifier));
      return;
    }

    const now = Date.now();
    const mine = todos.filter((t) => isActive(t) && isMine(t, myEmail));
    const activeIds = new Set(mine.map((t) => t.id));
    const planned = mine
      .map((t) => planReminder(t, leadMinutes, now))
      .filter((p): p is Planned => p != null)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, MAX_SCHEDULED); // 가까운 순 상한
    // identifier에 발화 시각을 넣어 diff가 순수 문자열 비교가 되게 한다 (시점·lead 변경 = 새 identifier)
    const desired = new Map(planned.map((p) => [`${DUE_PREFIX}${p.id}-${p.at.getTime()}`, p]));

    await cancel([
      ...dueScheduled.filter((n) => !desired.has(n.identifier)).map((n) => n.identifier),
      // 스누즈는 사용자가 명시한 예약 — 할 일이 완료/삭제/보관된 경우에만 취소
      ...snoozeScheduled
        .filter((n) => !activeIds.has(Number(n.identifier.slice(SNOOZE_PREFIX.length))))
        .map((n) => n.identifier),
      ...legacy.map((n) => n.identifier),
    ]);

    const existing = new Map(dueScheduled.map((n) => [n.identifier, n]));
    for (const [identifier, p] of desired) {
      const ex = existing.get(identifier);
      if (ex && ex.content.title === p.title && ex.content.body === p.body) continue; // 제목 변경 시 재예약
      await Notifications.scheduleNotificationAsync({
        identifier, // 동일 identifier는 교체됨
        content: {
          title: p.title,
          body: p.body,
          categoryIdentifier: TODO_DUE_CATEGORY,
          data: { type: 'TODO', targetId: p.id, kind: 'todo-due', todoId: p.id },
          sound: 'default',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at },
      });
    }
  } catch {
    // 네이티브 모듈 없음/일시 오류 — 다음 todos 갱신 때 재시도
  }
}

// ── 알림 액션 처리 (PushBridge 전역 응답 리스너에서 호출) ─────────
const FAIL_PREFIX = 'todo-action-failed-'; // DUE_PREFIX와 겹치지 않게 — reconcile이 오인 취소한다

/** 알림 액션 실패를 사용자에게 되돌려주는 즉시 알림(앱이 백그라운드라 토스트는 보이지 않는다). */
async function notifyActionFailed(todoId: number, reason: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${FAIL_PREFIX}${todoId}`,
      content: { title: '완료하지 못했어요', body: reason, data: { type: 'TODO', targetId: todoId } },
      trigger: null, // 즉시
    });
  } catch {
    // 알림조차 못 띄우는 상황(권한·네이티브 없음) — 더 할 수 있는 게 없다
  }
}

/**
 * [완료] → 상태 DONE PATCH + 해당 할 일의 남은 예약 정리, [1시간 뒤 알림] → 동일 content로 +1시간 재예약.
 * @returns 'completed'면 호출부가 todos 캐시를 invalidate한다.
 */
export async function handleTodoDueAction(
  actionId: string,
  todoId: number,
  content: Notifications.NotificationContent,
): Promise<'completed' | 'snoozed' | null> {
  try {
    if (actionId === TODO_DUE_ACTION_COMPLETE) {
      try {
        await updateTodoStatus(todoId, resolveDoneKey());
      } catch (e) {
        // 액션을 누르는 순간 알림은 사라진다. 여기서 조용히 삼키면 완료된 것처럼 보인다.
        // (이제 샘플은 예약하지 않지만, 기기에 남아 있던 예전 예약이나 권한 변경·네트워크
        //  실패로 여전히 실패할 수 있다.) 이유를 즉시 알림으로 되돌려준다.
        await notifyActionFailed(todoId, getApiErrorMessage(e, '할 일을 완료하지 못했어요'));
        return null;
      }
      // reconcile을 기다리지 않고 이 할 일의 리마인더·스누즈를 즉시 정리
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((n) => n.identifier.startsWith(`${DUE_PREFIX}${todoId}-`) || n.identifier === `${SNOOZE_PREFIX}${todoId}`)
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
      return 'completed';
    }
    if (actionId === TODO_DUE_ACTION_SNOOZE) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${SNOOZE_PREFIX}${todoId}`, // 재스누즈 시 교체
        content: {
          title: content.title ?? '할 일',
          body: content.body ?? '',
          categoryIdentifier: TODO_DUE_CATEGORY,
          data: (content.data as Record<string, unknown>) ?? { type: 'TODO', targetId: todoId, kind: 'todo-due', todoId },
          sound: 'default',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + SNOOZE_MS) },
      });
      return 'snoozed';
    }
  } catch {
    // 네트워크/네이티브 실패 — 다음 앱 실행 시 서버 상태 기준으로 자연 정합
  }
  return null;
}
