import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Linking } from 'react-native';

import { useMe } from '@/features/auth/queries';
import { isTodoDone } from '@/features/status/queries';
import { useTodos } from '@/features/todo/queries';
import { toDateString } from '@/shared/utils/datetime';

import { syncRouteBriefing } from './routeBriefing';
import { estimateTravel, fmtMinutes } from './travel';

const ID_PREFIX = 'leave-';
const BUFFER_MIN = 10; // 준비/오차 버퍼

export const LEAVE_CATEGORY = 'leave-alert';
export const LEAVE_ACTION_ROUTE = 'leave-route';
export const LEAVE_ACTION_SNOOZE = 'leave-snooze';
const SNOOZE_MIN = 10;

/**
 * 출발 알림의 액션 등록 — 앱 시작 시 1회.
 *
 * [고치는 결함] 이 알림에만 카테고리가 없어서 **길게 눌러도 아무것도 뜨지 않았다.**
 * 체크인·마감 알림은 진작 액션이 붙어 있었는데 여기만 빠져 있었다. 출발 알림은
 * 잠금화면에서 보는 알림이라 앱을 열지 않고 할 수 있는 게 있어야 값어치가 있다.
 */
export async function registerLeaveCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(LEAVE_CATEGORY, [
      // 길찾기는 지도 앱을 띄워야 하므로 앱을 깨운다
      { identifier: LEAVE_ACTION_ROUTE, buttonTitle: '🗺 길찾기', options: { opensAppToForeground: true } },
      { identifier: LEAVE_ACTION_SNOOZE, buttonTitle: `${SNOOZE_MIN}분 뒤 다시`, options: { opensAppToForeground: false } },
    ]);
  } catch {
    // 네이티브 모듈 없음(리빌드 전) — 무시
  }
}

/** 알림 액션 처리. 길찾기는 지도 링크, 다시 알림은 재예약. */
export async function handleLeaveAction(
  action: string,
  data: { todoId?: number; lat?: number; lng?: number; place?: string },
  content?: { title?: string | null; body?: string | null },
): Promise<void> {
  if (action === LEAVE_ACTION_ROUTE) {
    if (data.lat == null || data.lng == null) return;
    /* 출발지를 우리가 넣지 않는다 — 카카오가 현재 위치를 알아서 잡는다.
       알림에 담아둔 좌표는 알림을 만든 시점의 것이라, 지금 위치와 다를 수 있다. */
    const name = encodeURIComponent(data.place || '목적지');
    await Linking.openURL(`https://map.kakao.com/link/to/${name},${data.lat},${data.lng}`).catch(() => {});
    return;
  }
  if (action === LEAVE_ACTION_SNOOZE && data.todoId != null) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${data.todoId}`,
        content: {
          title: content?.title ?? '지금 출발할 시간이에요',
          body: content?.body ?? '',
          data: { type: 'TODO', targetId: data.todoId, kind: 'leave', ...data },
          sound: 'default',
          categoryIdentifier: LEAVE_CATEGORY,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: SNOOZE_MIN * 60,
          repeats: false,
        },
      });
    } catch {
      // 예약 실패는 조용히 넘긴다 — 알림 하나 미루려다 앱이 죽으면 안 된다
    }
  }
}

/**
 * 출발 알림 — 오늘 시작 시간이 있는 위치 일정에 대해
 * "지금 출발하세요 — '제목' HH:mm · {장소}까지 약 N분" 로컬 알림을 예약한다.
 *
 * 서버는 사용자의 현재 위치를 모르므로 클라이언트에서 계산:
 * 앱이 포그라운드가 될 때마다 현재 위치 기준으로 재계산·재예약(기존 leave-* 전부 교체).
 * 위치 권한이 없으면 조용히 건너뜀(권한 요청은 지도 화면에서만).
 */
export function LeaveAlertBridge() {
  const { data: todos } = useTodos();
  const { data: me } = useMe();
  const scheduling = useRef(false);

  const reschedule = async () => {
    if (scheduling.current) return;
    scheduling.current = true;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;

      // 기존 출발 알림 전부 취소 후 다시 계산 (위치·일정 변동 반영)
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((n) => n.identifier.startsWith(ID_PREFIX))
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );

      const today = toDateString(new Date());
      const now = new Date();
      const myEmail = me?.email;
      const candidates = (todos ?? [])
        .filter(
          (t) =>
            !isTodoDone(t) &&
            t.locationLat != null &&
            t.locationLng != null &&
            t.startTime &&
            (t.startAt === today || t.dueDate === today) &&
            // 내 일정(작성자/담당자)만 — 팀원 일정에 출발 알림이 오면 안 됨
            (!myEmail || t.userEmail === myEmail || (t.assignees ?? []).some((a) => a.email === myEmail)),
        )
        .slice(0, 8);
      if (!candidates.length) return;

      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null));
      if (!pos) return;

      for (const t of candidates) {
        const [hh, mm] = String(t.startTime).split(':').map(Number);
        if (hh == null || Number.isNaN(hh)) continue;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm ?? 0);
        if (start <= now) continue;

        const est = estimateTravel(pos.coords.latitude, pos.coords.longitude, t.locationLat!, t.locationLng!);
        if (est.minutes < 5) continue; // 바로 옆 — 알림 무의미
        const leaveAt = new Date(start.getTime() - (est.minutes + BUFFER_MIN) * 60_000);
        if (leaveAt <= now) continue; // 이미 출발했어야 함 — 뒷북 알림 금지

        const place = t.locationName ?? '목적지';
        await Notifications.scheduleNotificationAsync({
          identifier: `${ID_PREFIX}${t.id}`,
          content: {
            title: `${est.mode === 'walk' ? '🚶' : '🚗'} 지금 출발할 시간이에요`,
            body: `'${t.title}' ${String(t.startTime).slice(0, 5)} · ${place}까지 ${fmtMinutes(est.minutes)}`,
            /* 좌표·장소를 함께 담는다 — 길찾기 액션이 네트워크 없이 바로 열려면 필요하다.
               잠금화면에서 누르는 것이라 그 자리에서 끝나야 한다. */
            data: {
              type: 'TODO',
              targetId: t.id,
              kind: 'leave',
              todoId: t.id,
              lat: t.locationLat,
              lng: t.locationLng,
              place,
            },
            sound: 'default',
            categoryIdentifier: LEAVE_CATEGORY,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: leaveAt },
        });
      }
    } catch {
      // 네이티브 모듈 없음/일시 오류 — 다음 포그라운드에 재시도
    } finally {
      scheduling.current = false;
    }
  };

  // 할 일 변경 시 + 포그라운드 복귀 시 재예약 (동선 브리핑은 위치 권한 불필요 — 별도 호출)
  useEffect(() => {
    if (todos == null) return;
    void reschedule();
    void syncRouteBriefing(todos, me?.email);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void reschedule();
        void syncRouteBriefing(todos, me?.email); // 자정 넘김 등 날짜 변경 반영
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reschedule은 todos 클로저만 사용
  }, [todos, me?.email]);

  return null;
}
