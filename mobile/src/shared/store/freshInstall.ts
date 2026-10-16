import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

/**
 * 재설치 감지 후 키체인 정리.
 *
 * iOS 키체인(= expo-secure-store)은 **앱을 삭제해도 남는다.** 그래서 앱을 지우고 다시 깔아도
 *  - 인증 토큰이 살아 있어 자동 로그인되고
 *  - plando_onboarded='1'이 남아 온보딩이 뜨지 않는다.
 * TestFlight에서 삭제 후 재설치했는데 온보딩이 안 뜬 원인이 이것이다.
 *
 * 앱 샌드박스의 파일은 삭제 시 함께 지워지므로, 문서 디렉터리에 표식 파일을 하나 두고
 * 그게 없으면 "이번이 새 설치"로 판단해 키체인에 남은 값을 지운다.
 *
 * 실패해도 앱 실행을 막지 않는다 — 최악의 경우 예전 동작(자동 로그인)으로 돌아갈 뿐이다.
 */

/**
 * 재설치 시 지우는 키체인 키 전부. **새 SecureStore 키를 추가하면 여기에도 넣을 것.**
 * 앱을 지웠다 다시 깔면 '새 앱'이어야 한다는 게 사용자 기대라, 세션뿐 아니라 환경설정도 함께 지운다.
 * (per-todo 알림 예약 키 todo-due-, todo-snooze- 접두사는 예약된 로컬 알림 자체가 삭제 시 사라지므로 제외)
 */
const KEYCHAIN_KEYS = [
  // 세션·신원
  'plando.accessToken',
  'plando_onboarded',
  'plando.lastWorkspaceId',
  // 환경설정
  'plando_app_lock_enabled',
  'plando_custom_theme',
  'plando_push_enabled',
  'plando_live_activity_enabled',
  'plando_auto_rollover',
  'plando_auto_rollover_lastrun',
  'plando_todo_reminder_enabled',
  'plando_todo_reminder_lead',
  'plando_completion_sound',
  'plando_recent_searches',
  'plando_smart_views',
];

export async function clearKeychainIfFreshInstall(): Promise<void> {
  try {
    // SDK 56의 파일 API — Paths.document는 앱 삭제 시 함께 사라지는 샌드박스 디렉터리
    const marker = new File(Paths.document, '.plando-install');
    if (marker.exists) return; // 같은 설치 — 아무것도 하지 않는다

    // 표식이 없다 = 새 설치. 키체인에 남은 이전 설치의 흔적을 지운다.
    await Promise.all(
      KEYCHAIN_KEYS.map((k) => SecureStore.deleteItemAsync(k).catch(() => undefined)),
    );
    marker.create();
    marker.write(String(Date.now()));
  } catch {
    // 파일 접근 실패 등 — 정리를 건너뛴다(앱 실행을 막지 않는 게 우선)
  }
}
