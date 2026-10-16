import * as Notifications from 'expo-notifications';

import { isTodoDone } from '@/features/status/queries';
import type { Todo } from '@/features/todo/api';
import { toDateString } from '@/shared/utils/datetime';

const ID_PREFIX = 'route-briefing-';
const BRIEFING_HOUR = 8; // 아침 8시

/**
 * 아침 동선 브리핑 — 위치 일정이 있는 날 08:00에 로컬 알림을 예약한다.
 * "이동 일정 N곳 · 첫 일정 HH:MM 제목" → 탭하면 지도 화면의 오늘 동선 모드로 진입.
 *
 * 오늘(아직 8시 전이면)과 내일 두 날짜만 예약하고, 할 일 변경 시마다
 * 기존 route-briefing-* 예약을 전부 취소 후 재계산한다(syncDueReminders 패턴).
 * 알림 내용은 예약 시점 기준 — 이후 완료/삭제되면 다음 동기화에서 갱신된다.
 */
export async function syncRouteBriefing(todos: Todo[], myEmail?: string): Promise<void> {
  try {
    // 기존 브리핑 예약 전부 취소(중복 방지)
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => typeof n.identifier === 'string' && n.identifier.startsWith(ID_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const now = new Date();
    for (const offset of [0, 1]) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, BRIEFING_HOUR, 0, 0, 0);
      if (at.getTime() <= now.getTime()) continue; // 오늘 8시가 지났으면 오늘 브리핑 생략
      const day = toDateString(at);

      // 그날의 내 위치 일정 — LeaveAlertBridge와 같은 '내 것'(작성자/담당자) 규칙
      const stops = todos.filter(
        (t) =>
          !isTodoDone(t) &&
          t.locationLat != null &&
          t.locationLng != null &&
          (t.dueDate === day || t.startAt === day) && // 지도 todayStops와 동일 기준
          (!myEmail || t.userEmail === myEmail || (t.assignees ?? []).some((a) => a.email === myEmail)),
      );
      if (!stops.length) continue;

      const first = stops
        .filter((t) => t.startTime)
        .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))[0];
      const body = first
        ? `이동 일정 ${stops.length}곳 · 첫 일정 ${String(first.startTime).slice(0, 5)} ${first.title ?? '할 일'}`
        : `이동 일정 ${stops.length}곳 — 동선을 확인해보세요`;

      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${day}`,
        content: { title: '오늘의 동선', body, data: { type: 'ROUTE_BRIEFING' }, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  } catch {
    // 네이티브 모듈 없음(리빌드 전)/권한 — 무시
  }
}
