import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerApnsToken, unregisterApnsToken } from './api';

/**
 * 푸시 알림 클라이언트.
 * - 원격: iOS APNs **네이티브 디바이스 토큰**을 백엔드(/notifications/push/ios/register)에 등록.
 *   (백엔드가 Pushy APNs로 발송 → Expo 토큰 아님)
 * - 로컬 마감 리마인더는 `@/features/todo/reminders`로 이전.
 * 모든 네이티브 호출은 try/catch로 감싼다 — 네이티브 모듈 없는 빌드(리빌드 전)에서 크래시 방지.
 */

let lastToken: string | null = null;

/** 포그라운드에서도 배너/사운드 표시 */
export function configureNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // 네이티브 모듈 없음(리빌드 전) — 무시
  }
}

/** 권한 요청 → APNs 디바이스 토큰 획득 → 백엔드 등록. 성공 시 토큰 반환. */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const token = await Notifications.getDevicePushTokenAsync(); // { type:'ios', data: <APNs hex> }
    const data = typeof token.data === 'string' ? token.data : String(token.data);
    if (!data) return null;
    lastToken = data;
    await registerApnsToken(data);
    return data;
  } catch {
    // 권한 거부/네이티브 모듈 없음/네트워크 — 조용히 무시(다음 진입 시 재시도)
    return null;
  }
}

/** 토큰 해제 (로그아웃·푸시 토글 끔). 이번 세션에 등록한 적 없어도 기기 토큰을 얻어 해제한다. */
/**
 * @returns 서버에서 토큰을 지웠으면 true. 실패하면 false —
 *   해제에 실패하면 **푸시가 계속 오므로** 호출부가 "껐어요"라고 단정하면 안 된다.
 *   (로그아웃 경로처럼 결과를 무시해도 되는 곳은 반환값을 안 쓰면 된다.)
 */
export async function unregisterPush(): Promise<boolean> {
  try {
    let token = lastToken;
    if (!token && Platform.OS === 'ios') {
      const t = await Notifications.getDevicePushTokenAsync();
      token = typeof t.data === 'string' ? t.data : String(t.data);
    }
    if (token) await unregisterApnsToken(token);
    return true;
  } catch {
    return false;
  } finally {
    lastToken = null;
  }
}

/** 앱 아이콘 배지 카운트 설정 */
export async function setBadge(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // 무시
  }
}
