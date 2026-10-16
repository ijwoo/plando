import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { api } from '@/api/client';
import { IOS_MAX_REGIONS } from '@/native-modules/geofence';
import { notifyCheckin } from './checkin';

/**
 * 장소 도착(지오펜스) 모니터링 — 활성 트리거가 있는 위치 할 일의 반경에 진입하면
 * 백엔드 `/api/triggers/enter/{todoId}`를 호출해 서버가 푸시 알림을 보낸다.
 *
 * 백그라운드 태스크는 모듈 최상위에서 정의되어야 하며, 이 모듈을 앱 시작 시 import해야 한다.
 * iOS는 동시 지오펜스 20개 제한.
 */
const TASK = 'plando-geofence';

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  console.log('[geofence] event', eventType, region?.identifier);
  const todoId = Number(region?.identifier);
  if (Number.isNaN(todoId)) return;

  if (eventType === Location.GeofencingEventType.Enter) {
    // 도착 체크인 — 인터랙티브 로컬 알림("지금 시작할까요?")이 성공하면
    // 서버 enter 푸시는 중복이라 건너뛴다. 실패(오프라인 등) 시에만 서버 폴백.
    const shown = await notifyCheckin(todoId, 'arrive');
    if (!shown) {
      try {
        await api.post(`/api/triggers/enter/${todoId}`);
        console.log('[geofence] enter posted (fallback)', todoId);
      } catch (e) {
        console.log('[geofence] enter failed', todoId, e);
      }
    }
  } else if (eventType === Location.GeofencingEventType.Exit) {
    // 이탈 체크인 — 진행 중이던 일이면 "완료로 표시할까요?"
    await notifyCheckin(todoId, 'depart');
  }
});

export type GeofenceRegion = { todoId: number; lat: number; lng: number; radius: number };

/** 포그라운드+백그라운드 위치 권한 요청. 둘 다 허용돼야 백그라운드 지오펜싱 가능. */
export async function ensureBackgroundLocationPermission(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

/** 활성 트리거 영역으로 지오펜싱을 갱신(없으면 중지). 권한 없으면 아무것도 안 함. */
/** 동기화 결과 — 조용히 실패하지 않도록 호출부가 사용자에게 알릴 수 있게 돌려준다. */
export type GeofenceSyncResult =
  | { ok: true; registered: number; dropped: number }
  | { ok: false; reason: 'no-permission' | 'start-failed' };

export async function syncGeofences(regions: GeofenceRegion[]): Promise<GeofenceSyncResult> {
  const registered = await TaskManager.isTaskRegisteredAsync(TASK).catch(() => false);

  if (regions.length === 0) {
    if (registered) await Location.stopGeofencingAsync(TASK).catch(() => {});
    return { ok: true, registered: 0, dropped: 0 };
  }

  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    // 예전엔 콘솔에만 찍고 끝냈다. 사용자는 도착 알림을 켜 뒀는데 영영 울리지 않는 걸
    // 이유도 모른 채 겪는다. 결과를 돌려주고 호출부가 안내하게 한다.
    console.log('[geofence] no background permission — skip');
    return { ok: false, reason: 'no-permission' };
  }

  // iOS 하드 제한 20개. 넘치면 잘려나가는데, 예전엔 호출 순서(=객체 키 순서)대로 잘라서
  // **어느 알림이 죽는지 예측할 수 없었다.** 호출부가 우선순위대로 정렬해 넘기는 것을 전제로
  // 앞에서부터 채우고, 잘린 개수를 돌려준다.
  const dropped = Math.max(0, regions.length - IOS_MAX_REGIONS);
  const locRegions: Location.LocationRegion[] = regions.slice(0, IOS_MAX_REGIONS).map((r) => ({
    identifier: String(r.todoId),
    latitude: r.lat,
    longitude: r.lng,
    radius: r.radius,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));
  console.log('[geofence] start', locRegions.length, 'regions', JSON.stringify(locRegions));
  try {
    await Location.startGeofencingAsync(TASK, locRegions);
  } catch (e) {
    console.log('[geofence] start failed', e);
    return { ok: false, reason: 'start-failed' };
  }
  return { ok: true, registered: locRegions.length, dropped };
}
