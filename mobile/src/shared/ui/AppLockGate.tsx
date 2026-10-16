import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppState, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAppLockStore } from '@/shared/store/appLockStore';
import { Button } from '@/shared/ui/Button';

// 네이티브 모듈 없는 빌드에서 import가 던지지 않게 지연 로드
type LocalAuthModule = typeof import('expo-local-authentication');
function loadLocalAuth(): LocalAuthModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LocalAuthModule;
  } catch {
    return null;
  }
}

/**
 * Face ID 앱 잠금 게이트 — 루트에 한 번 렌더(ToastHost 형제, 최상단 오버레이).
 * 잠금이 켜져 있으면 콜드 스타트와 '실제 백그라운드'('background'→'active') 복귀 시
 * 전체 화면을 덮고, 인증(생체 없으면 기기 암호 폴백)을 통과해야 걷힌다.
 * 알림 센터·앱 전환 스와이프 같은 잠깐의 'inactive'에는 잠그지 않는다.
 * 꺼져 있으면 아무것도 렌더하지 않는다.
 */
export function AppLockGate() {
  const theme = useTheme();
  const enabled = useAppLockStore((s) => s.enabled);
  const hydrated = useAppLockStore((s) => s.hydrated);
  // 콜드 스타트는 잠금으로 시작 — hydrate 결과 잠금이 꺼져 있으면 즉시 해제
  const [locked, setLocked] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const authInFlight = useRef(false);
  const lockedRef = useRef(true);
  const coldStart = useRef(true);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    void useAppLockStore.getState().hydrate();
  }, []);

  const tryUnlock = useCallback(async () => {
    if (authInFlight.current) return;
    authInFlight.current = true;
    setAuthBusy(true);
    try {
      const la = loadLocalAuth();
      if (!la) {
        // 네이티브 모듈 없는 빌드 — 잠근 채 두면 영영 못 들어가므로 게이트 해제
        setLocked(false);
        return;
      }
      const res = await la.authenticateAsync({ promptMessage: 'Plan Do! 잠금 해제' });
      if (res.success) setLocked(false);
      // 실패/취소 — 잠금 유지, 수동 재시도 버튼으로 다시 시도
    } catch {
      // 네이티브 모듈 없는 빌드(Expo Go 등) — 잠근 채 두면 영영 못 들어가므로 게이트 해제
      setLocked(false);
    } finally {
      authInFlight.current = false;
      setAuthBusy(false);
    }
  }, []);

  // 콜드 스타트: hydrate 완료 시 잠금이 켜져 있으면 자동 인증, 꺼져 있으면 게이트 해제.
  // (해제해 둬야 이후 설정에서 잠금을 켜도 실행 중인 앱이 갑자기 잠기지 않는다)
  useEffect(() => {
    if (!hydrated || !coldStart.current) return;
    coldStart.current = false;
    // 다음 틱으로 미룸 — 효과 본문 내 동기 setState 금지(react-hooks) + 첫 렌더 직후 인증 시트 표시
    setTimeout(() => {
      if (enabled) void tryUnlock();
      else setLocked(false);
    }, 0);
  }, [hydrated, enabled, tryUnlock]);

  // 백그라운드 진입 시 잠금(복귀 전에 콘텐츠를 덮음), 활성 복귀 시 자동 인증.
  // 'inactive'는 무시 — 실제 'background'를 거쳐야만 잠근다.
  useEffect(() => {
    if (!hydrated || !enabled) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        lockedRef.current = true;
        setLocked(true);
      } else if (next === 'active' && lockedRef.current) {
        void tryUnlock();
      }
    });
    return () => sub.remove();
  }, [hydrated, enabled, tryUnlock]);

  if (!hydrated || !enabled || !locked) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <View style={[styles.iconBadge, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="lock-closed" size={34} color={theme.primary} />
        </View>
        <ThemedText type="title2" style={styles.title}>
          Plan Do!
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          앱이 잠겨 있어요
        </ThemedText>
      </View>
      <Button
        title="잠금 해제"
        leftIcon="lock-open-outline"
        loading={authBusy}
        onPress={() => void tryUnlock()}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 10000, elevation: 10000, alignItems: 'center', justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', gap: 6 },
  iconBadge: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { marginTop: 2 },
  button: { position: 'absolute', bottom: 64, left: 24, right: 24 },
});
