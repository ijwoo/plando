import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useToastStore, type ToastSeverity } from '@/shared/ui/toast';

const COLORS: Record<ToastSeverity, string> = {
  error: '#E5484D',
  success: '#22A06B',
  info: '#3D7BFF',
};
const ICON: Record<ToastSeverity, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
};
const DURATION = 3200;

let HOST_SEQ = 0;

/**
 * 전역 toast 호스트 — 루트에 한 번 렌더. 화면 상단에서 내려오고 자동으로 사라진다.
 * RN Modal(이미지 미리보기 등)은 별도 네이티브 레이어라 z-index/Modal로도 위에 못 띄운다.
 * 그래서 풀스크린 Modal 내부에도 이 컴포넌트를 한 번 더 렌더한다(같은 store 구독 → 동기 표시).
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const current = useToastStore((s) => s.current);
  const hide = useToastStore((s) => s.hide);
  const registerHost = useToastStore((s) => s.registerHost);
  const unregisterHost = useToastStore((s) => s.unregisterHost);
  const topHostId = useToastStore((s) => s.hosts[s.hosts.length - 1]);

  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = ++HOST_SEQ;
  // 여러 ToastHost가 겹쳐 마운트되면 최상단(가장 최근)만 렌더 → 중복 토스트 방지
  const isTop = topHostId === idRef.current;

  useEffect(() => {
    const id = idRef.current;
    registerHost(id);
    return () => unregisterHost(id);
  }, [registerHost, unregisterHost]);

  const op = useSharedValue(0);
  const ty = useSharedValue(-20);

  useEffect(() => {
    if (!current || !isTop) return;
    op.value = withTiming(1, { duration: 200 });
    ty.value = withTiming(0, { duration: 200 });
    const t = setTimeout(() => {
      op.value = withTiming(0, { duration: 200 });
      ty.value = withTiming(-20, { duration: 200 });
      setTimeout(hide, 200);
    }, DURATION);
    return () => clearTimeout(t);
  }, [current, isTop, op, ty, hide]);

  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: ty.value }] }));

  if (!current || !isTop) return null;

  // Modal 내부에서 렌더될 땐 SafeAreaProvider 밖이라 insets.top이 0일 수 있어 최소값 보정.
  const top = (insets.top || 48) + 8;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top }, style]}>
      <Pressable onPress={hide} style={[styles.toast, { backgroundColor: COLORS[current.severity] }]}>
        <Ionicons name={ICON[current.severity]} size={18} color="#fff" />
        <ThemedText type="default" style={styles.text} numberOfLines={3}>
          {current.message}
        </ThemedText>
        {current.action ? (
          <Pressable
            onPress={() => {
              current.action?.onPress();
              hide();
            }}
            hitSlop={8}
            style={styles.action}>
            <ThemedText type="default" style={styles.actionText}>
              {current.action.label}
            </ThemedText>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 9999, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 460,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: '#fff', fontWeight: '600', flexShrink: 1 },
  action: { marginLeft: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.22)' },
  actionText: { color: '#fff', fontWeight: '800' },
});
