import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/** 펄스 블록 — 첫 로드에 콘텐츠 자리를 잡아준다 (스피너 단독/빈 화면 방지) */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.block, { backgroundColor: theme.surfaceSelected }, anim, style]} />;
}

/** 아바타 + 두 줄 텍스트 형태의 행 스켈레톤 (목록 공용) */
export function SkeletonRow({ avatar = 40, lines = 2 }: { avatar?: number; lines?: 1 | 2 }) {
  return (
    <View style={styles.row}>
      <Skeleton style={{ width: avatar, height: avatar, borderRadius: avatar / 2 }} />
      <View style={styles.body}>
        <Skeleton style={styles.line1} />
        {lines > 1 ? <Skeleton style={styles.line2} /> : null}
      </View>
    </View>
  );
}

/** 행 N개 목록 스켈레톤 */
export function SkeletonList({ rows = 6, avatar = 40, lines = 2 as 1 | 2 }: { rows?: number; avatar?: number; lines?: 1 | 2 }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} avatar={avatar} lines={lines} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 6 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  body: { flex: 1, gap: 7 },
  line1: { height: 13, width: '62%' },
  line2: { height: 11, width: '38%' },
});
