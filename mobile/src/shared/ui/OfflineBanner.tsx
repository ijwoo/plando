import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onlineManager, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { createTodo } from '@/features/todo/api';
import { drain } from '@/features/todo/offlineQueue';
import { todoKeys } from '@/features/todo/queries';
import { toast } from '@/shared/ui/toast';

/**
 * 오프라인 감지 배너 (루트 1회 마운트).
 * - NetInfo → TanStack onlineManager 연결: 오프라인 동안 쿼리 재시도를 멈추고 복구 시 자동 refetch.
 * - 오프라인이면 상단에 배너 — 화면이 "조용히 비는" 대신 이유를 보여준다.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const qc = useQueryClient();
  const draining = useRef(false);

  /* 연결이 돌아오면 오프라인에서 적어둔 것을 올린다.
     여기 붙이는 이유: 이 컴포넌트가 이미 연결 상태를 아는 유일한 곳이다.
     따로 감지기를 만들면 같은 것을 두 곳에서 보게 된다.

     한 번에 하나만 돈다(draining) — 연결이 깜빡이면 이벤트가 연달아 오는데,
     겹쳐 돌면 같은 항목을 동시에 두 번 보낸다. 서버가 열쇠로 막아주지만
     불필요한 요청을 두 배로 낼 이유가 없다. */
  const flush = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    try {
      const sent = await drain((item) => createTodo({ ...item.payload, clientKey: item.clientKey }));
      if (sent > 0) {
        qc.invalidateQueries({ queryKey: todoKeys.all });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        toast.success(`저장해뒀던 할 일 ${sent}개를 올렸어요`);
      }
    } finally {
      draining.current = false;
    }
  }, [qc]);

  useEffect(() => {
    // 네이티브 모듈이 없는 빌드(리빌드 전)에서 크래시하지 않게 런타임 로드 + 가드
    let unsub: (() => void) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- 조건부 네이티브 모듈 로드
      const NetInfo = require('@react-native-community/netinfo').default;
      unsub = NetInfo.addEventListener((state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
        const online = !!state.isConnected && state.isInternetReachable !== false;
        onlineManager.setOnline(online);
        setOffline(!online);
        // 연결이 돌아오면 오프라인에서 적어둔 것을 올린다
        if (online) void flush();
      });
    } catch {
      // 모듈 없음 — 배너 비활성 (리빌드 후 자동 활성화)
    }
    return () => unsub?.();
  }, [flush]);

  if (!offline) return null;
  return (
    <View style={[styles.banner, { top: insets.top }]} pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <ThemedText type="small" style={styles.text}>
        오프라인 상태예요 — 연결되면 자동으로 새로고침돼요
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: { color: '#fff', fontWeight: '600' },
});
