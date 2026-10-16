import * as Notifications from 'expo-notifications';

import { getStatuses } from '@/features/status/api';
import { isTodoDone } from '@/features/status/queries';
import { getTodo, updateTodoField } from '@/features/todo/api';
import { todoKeys } from '@/features/todo/queries';
import { queryClient } from '@/shared/query/queryClient';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import type { WorkflowStatusLite } from '@/api/typesExt';

/**
 * 도착/이탈 자동 체크인 — 지오펜스 이벤트를 인터랙티브 로컬 알림으로 바꾼다.
 *  - 도착: "'제목' 장소에 도착했어요 — 시작할까요?"  [▶ 시작 / 나중에]
 *  - 이탈: "'제목' 자리를 떠났어요 — 완료했나요?"    [✓ 완료 / 아직이에요]
 * 액션 응답 처리는 PushBridge(handleCheckinAction)에서.
 */

type StatusCategory = WorkflowStatusLite['category'];

/** 시드 상태(TODO/IN_PROGRESS/DONE)는 key==category — 상태 캐시가 아직 비었을 때의 폴백 */
const SEED_CATEGORY: Record<string, StatusCategory> = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
};

/**
 * 워크스페이스 워크플로 상태 목록.
 *
 * 훅 밖(지오펜스 백그라운드 태스크·알림 액션 핸들러)이라 쿼리 캐시에서 직접 읽는다.
 * 그런데 이 경로는 **앱이 죽어 있다 깨어난 상태**로도 실행돼서 캐시가 비어 있는 게 흔하다.
 * 캐시만 믿으면 커스텀 상태 워크스페이스에서 카테고리 판정이 통째로 틀어지므로,
 * 비어 있으면 한 번 받아온다(fetchQuery라 이후 화면들과 캐시를 공유한다).
 */
async function loadStatuses(): Promise<WorkflowStatusLite[]> {
  try {
    for (const [, data] of queryClient.getQueriesData<WorkflowStatusLite[]>({ queryKey: ['statuses'] })) {
      if (data?.length) return data;
    }
    return await queryClient.fetchQuery({
      queryKey: ['statuses', useWorkspaceStore.getState().activeId],
      queryFn: getStatuses,
      staleTime: 60_000,
    });
  } catch {
    // 오프라인 등 — 시드 폴백으로 진행
    return [];
  }
}

/**
 * 상태 key가 속한 카테고리.
 * 커스텀 상태 key는 `st_`+UUID라 key 문자열 비교('TODO' 등)로는 절대 맞지 않는다.
 */
function categoryOf(list: WorkflowStatusLite[], statusKey?: string | null): StatusCategory {
  if (!statusKey) return 'TODO';
  const hit = list.find((s) => s.statusKey === statusKey);
  return hit?.category ?? SEED_CATEGORY[statusKey] ?? 'TODO';
}

/**
 * 카테고리의 대표 상태 key (기본 지정 > 첫 항목).
 * 목록을 못 받았으면 시드 key로 폴백하고, **받았는데 그 카테고리가 없으면 null**을 돌려준다.
 * DONE/TODO는 서버가 최소 1개를 보장하지만 IN_PROGRESS는 통째로 삭제할 수 있기 때문에
 * (WorkflowStatusService.delete의 최소 개수 가드는 TODO·DONE만 보호) null이 실제로 나온다.
 */
function resolveCategoryKey(list: WorkflowStatusLite[], cat: StatusCategory): string | null {
  if (!list.length) return cat; // 미로드 — 시드 key로 시도
  const inCat = list.filter((s) => s.category === cat);
  return (inCat.find((s) => s.isDefault) ?? inCat[0])?.statusKey ?? null;
}

export const CHECKIN_ARRIVE_CATEGORY = 'plando.checkin.arrive';
/** '진행 중' 카테고리가 없는 워크스페이스용 — 눌러도 못 바꾸는 [▶ 지금 시작]을 아예 빼고 띄운다 */
export const CHECKIN_ARRIVE_INFO_CATEGORY = 'plando.checkin.arrive.info';
export const CHECKIN_DEPART_CATEGORY = 'plando.checkin.depart';
export const CHECKIN_ACTION_START = 'checkin-start';
export const CHECKIN_ACTION_DONE = 'checkin-done';

/** 알림 액션 카테고리 등록 — 앱 시작 시 1회 (PushBridge에서 호출) */
export async function registerCheckinCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(CHECKIN_ARRIVE_CATEGORY, [
      { identifier: CHECKIN_ACTION_START, buttonTitle: '▶ 지금 시작', options: { opensAppToForeground: false } },
      { identifier: 'checkin-later', buttonTitle: '나중에', options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync(CHECKIN_ARRIVE_INFO_CATEGORY, [
      { identifier: 'checkin-later', buttonTitle: '확인', options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync(CHECKIN_DEPART_CATEGORY, [
      { identifier: CHECKIN_ACTION_DONE, buttonTitle: '✓ 완료로 표시', options: { opensAppToForeground: false } },
      { identifier: 'checkin-not-yet', buttonTitle: '아직이에요', options: { opensAppToForeground: false } },
    ]);
  } catch {
    // 네이티브 모듈 없음(리빌드 전) — 무시
  }
}

/**
 * 지오펜스 이벤트 → 상태 기반 체크인 알림.
 * 상태 자체가 중복 방지 장치다: 도착 알림은 '미시작(TODO)' 카테고리일 때만,
 * 이탈 알림은 '진행 중(IN_PROGRESS)' 카테고리일 때만.
 *
 * **카테고리로 판정한다** — 예전엔 `todo.status !== 'TODO'` 처럼 key를 직접 비교해서,
 * 커스텀 상태(key = `st_`+UUID)를 쓰는 워크스페이스에서는 도착/이탈 알림이 아예 안 떴다.
 * @returns 알림을 띄웠으면 true (호출 측이 서버 enter 푸시를 건너뛰는 판단에 사용)
 */
export async function notifyCheckin(todoId: number, kind: 'arrive' | 'depart'): Promise<boolean> {
  try {
    const todo = await getTodo(todoId);
    if (!todo?.title || isTodoDone(todo)) return false;
    const statuses = await loadStatuses();
    const cat = categoryOf(statuses, todo.status);
    if (kind === 'arrive' && cat !== 'TODO') return false;
    if (kind === 'depart' && cat !== 'IN_PROGRESS') return false;

    const place = todo.locationName ? ` (${todo.locationName})` : '';
    // '진행 중' 카테고리를 통째로 지운 워크스페이스에선 [▶ 지금 시작]이 눌러도 실패할 뿐이다.
    // 조용한 무반응 대신 버튼을 빼고 이유를 알린다.
    const startKey = kind === 'arrive' ? resolveCategoryKey(statuses, 'IN_PROGRESS') : null;
    await Notifications.scheduleNotificationAsync({
      identifier: `checkin-${kind}-${todoId}`,
      content:
        kind === 'arrive'
          ? {
              title: `📍 도착했어요${place}`,
              body: startKey
                ? `'${todo.title}' — 지금 시작할까요?`
                : `'${todo.title}' — '진행 중' 상태가 없어 시작 처리는 못 해요`,
              categoryIdentifier: startKey ? CHECKIN_ARRIVE_CATEGORY : CHECKIN_ARRIVE_INFO_CATEGORY,
              data: { kind: 'checkin', todoId },
              sound: 'default',
            }
          : {
              title: `👋 자리를 떠났네요${place}`,
              body: `'${todo.title}' — 완료로 표시할까요?`,
              categoryIdentifier: CHECKIN_DEPART_CATEGORY,
              data: { kind: 'checkin', todoId },
              sound: 'default',
            },
      trigger: null, // 즉시
    });
    return true;
  } catch {
    return false;
  }
}

/** 상태 변경이 실패했을 때 — 백그라운드라 토스트를 못 띄우므로 로컬 알림으로 알린다. */
async function notifyCheckinFailed(todoId: number, what: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `checkin-failed-${todoId}`,
      content: {
        title: '상태를 바꾸지 못했어요',
        body: `${what} 처리에 실패했어요 — 앱에서 다시 시도해주세요`,
        data: { kind: 'checkin', todoId },
      },
      trigger: null,
    });
  } catch {
    // 알림조차 못 띄우면 더 할 수 있는 게 없다
  }
}

/** 알림 액션 응답 처리 — 시작/완료 원탭 (PushBridge 응답 리스너에서 호출) */
export async function handleCheckinAction(actionId: string, todoId: number): Promise<void> {
  const isStart = actionId === CHECKIN_ACTION_START;
  const isDone = actionId === CHECKIN_ACTION_DONE;
  if (!isStart && !isDone) return;
  // 시작 key는 알림을 띄운 시점에 존재했지만 그 사이 삭제됐을 수 있다 — 없으면 400 대신 안내.
  // ('완료'는 서버가 DONE 카테고리 최소 1개를 보장하므로 시드 폴백으로 충분하다)
  const statuses = await loadStatuses();
  const key = isStart
    ? resolveCategoryKey(statuses, 'IN_PROGRESS')
    : (resolveCategoryKey(statuses, 'DONE') ?? 'DONE');
  if (!key) {
    await notifyCheckinFailed(todoId, '시작');
    return;
  }
  try {
    await updateTodoField(todoId, 'status', key);
    // 앱이 떠 있으면 목록·상세가 바로 새 상태로 보이게 (백그라운드면 다음 포커스 때 반영)
    queryClient.invalidateQueries({ queryKey: todoKeys.all });
  } catch {
    // 예전엔 빈 catch라 실패가 완전히 무음이었다 — 사용자는 눌렀는데 아무 일도 안 일어난 걸로 본다
    await notifyCheckinFailed(todoId, isStart ? '시작' : '완료');
  }
}
