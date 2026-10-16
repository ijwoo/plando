import { useEffect, useState } from 'react';
import { Switch } from 'react-native';

import { SettingsShell } from '@/features/settings/shared';
import { useAppLockStore } from '@/shared/store/appLockStore';
import { ListGroup, ListRow } from '@/shared/ui/List';
import { toast } from '@/shared/ui/toast';

// 네이티브 모듈 없는 빌드에서 import가 던지지 않게 지연 로드
type LocalAuthModule = typeof import('expo-local-authentication');
type LocalAuthError = import('expo-local-authentication').LocalAuthenticationError;

/**
 * 인증 실패 사유 → 사용자가 실제로 할 수 있는 안내.
 * 취소(user_cancel/app_cancel/system_cancel)는 본인 의도라 알리지 않는다 — 스위치가 원래 값으로 돌아가는 것으로 충분.
 */
const AUTH_FAIL_MESSAGE: Partial<Record<LocalAuthError, string>> = {
  not_enrolled: 'Face ID(또는 지문)가 기기에 등록돼 있지 않아요. 기기 설정에서 먼저 등록해주세요.',
  passcode_not_set: '기기 암호가 설정돼 있지 않아요. 기기 설정에서 암호를 먼저 등록해주세요.',
  not_available: '이 기기에서는 생체 인증을 쓸 수 없어요.',
  lockout: '인증 실패가 많아 잠시 잠겼어요. 기기 암호로 잠금을 푼 뒤 다시 시도해주세요.',
  authentication_failed: '인증에 실패했어요. 다시 시도해주세요.',
};
const SILENT_ERRORS: LocalAuthError[] = ['user_cancel', 'app_cancel', 'system_cancel'];

function loadLocalAuth(): LocalAuthModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LocalAuthModule;
  } catch {
    return null;
  }
}

/** 설정 > 보안 — Face ID 앱 잠금 */
export default function SecuritySettingsScreen() {
  // 앱 잠금 토글 — 켜기/끄기 모두 인증 통과 필요 (켜기 전 실제 해제 가능한지 검증)
  const appLockEnabled = useAppLockStore((st) => st.enabled);
  useEffect(() => {
    void useAppLockStore.getState().hydrate();
  }, []);
  const [lockBusy, setLockBusy] = useState(false);

  const onAppLockToggle = async (next: boolean) => {
    if (lockBusy) return;
    setLockBusy(true);
    try {
      const la = loadLocalAuth();
      if (!la) throw new Error('unavailable');
      const res = await la.authenticateAsync({
        promptMessage: next ? 'Plan Do! 앱 잠금 켜기' : 'Plan Do! 앱 잠금 끄기',
      });
      if (!res.success) {
        // 예전엔 조용히 return 했다 — 스위치만 제자리로 돌아가고 이유는 어디에도 안 나와서
        // (Face ID 미등록 등) 토글이 고장난 것처럼 보였다. 취소가 아니면 사유를 알린다.
        if (!SILENT_ERRORS.includes(res.error)) {
          toast.error(AUTH_FAIL_MESSAGE[res.error] ?? '인증하지 못해 앱 잠금을 바꾸지 못했어요');
        }
        return;
      }
      await useAppLockStore.getState().setEnabled(next);
      toast.success(next ? '앱 잠금을 켰어요' : '앱 잠금을 껐어요');
    } catch {
      toast.error('이 기기에서는 앱 잠금을 사용할 수 없어요');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <SettingsShell title="보안">
      <ListGroup>
        <ListRow
          label="앱 잠금"
          desc="앱을 열 때마다 Face ID로 잠금 해제"
          last
          right={<Switch value={appLockEnabled} disabled={lockBusy} onValueChange={(v) => void onAppLockToggle(v)} />}
        />
      </ListGroup>
    </SettingsShell>
  );
}
