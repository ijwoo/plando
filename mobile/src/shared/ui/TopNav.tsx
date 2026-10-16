import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useState } from 'react';

import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { BlurBackdrop } from '@/shared/ui/BlurBackdrop';
import { colorFromName, secureUrl } from '@/shared/ui/Avatar';
import { WorkspaceSwitcher } from '@/features/workspace/WorkspaceSwitcher';
import { useUnreadCount } from '@/features/notification/queries';
import { useMyWorkspaces } from '@/features/workspace/queries';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';

/** 네비 바(안전영역 제외) 높이 — 화면 콘텐츠 상단 패딩 계산에 사용 */
export const TOPNAV_BAR_H = 58;
const FADE_DISTANCE = 44; // 이만큼 스크롤하면 배경이 완전히 사라짐

/** 떠 있는 TopNav가 가리는 높이(안전영역 + 바). 스크롤 콘텐츠 paddingTop에 사용. */
export function useTopNavHeight() {
  const insets = useSafeAreaInsets();
  return insets.top + TOPNAV_BAR_H;
}

/**
 * 떠 있는 TopNav를 쓰는 화면용 헬퍼 — 콘텐츠 상단 패딩(navH)과 배경 페이드를 구동할
 * 스크롤 핸들러를 한 번에 제공한다. `Animated.ScrollView`/`Animated.FlatList`의 onScroll에 연결.
 */
export function useTopNavScroll() {
  const navH = useTopNavHeight();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return { navH, scrollY, onScroll };
}

/** 독립 원형 글래스 아이콘 버튼 (글래스 불가 시 톤 배경 폴백) */
function IconBtn({
  icon,
  size,
  onPress,
  glass,
  theme,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  onPress: () => void;
  glass: boolean;
  theme: ReturnType<typeof useTheme>;
  label?: string;
}) {
  if (glass) {
    return (
      <GlassView style={styles.iconBtn} glassEffectStyle="regular" isInteractive>
        <Pressable onPress={onPress} style={styles.iconBtnFill} accessibilityLabel={label} accessibilityRole="button">
          <Ionicons name={icon} size={size} color={theme.text} />
        </Pressable>
      </GlassView>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [styles.iconBtn, styles.iconBtnFill, { backgroundColor: theme.surfaceSelected }, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={size} color={theme.text} />
    </Pressable>
  );
}

/**
 * 글로벌 상단 네비 — 워크스페이스 셀렉터 · 검색 · 알림(벨+뱃지).
 * 기존 앱(Navbar 모바일)의 상단 3요소를 미러. iOS Liquid Glass surface(슬랙풍),
 * 글래스 불가 환경에선 surfaceSelected로 폴백.
 *
 * **떠 있는(floating) 오버레이**다. 콘텐츠는 그 뒤로 풀블리드로 스크롤하고,
 * `scrollY`를 받으면 슬랙처럼 맨 위에선 배경이 깔려 있다가 스크롤하면 배경이 사라지고
 * 글래스 버튼만 떠 있게 된다. 화면은 콘텐츠 상단에 `useTopNavHeight()`만큼 패딩을 준다.
 */
export function TopNav({ trailing, scrollY }: { trailing?: React.ReactNode; scrollY?: SharedValue<number> }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeId = useWorkspaceStore((s) => s.activeId);
  const { data: workspaces } = useMyWorkspaces();
  const { data: unread } = useUnreadCount();
  const glass = isLiquidGlassAvailable();
  const [wsSwitcher, setWsSwitcher] = useState(false);

  const current = workspaces?.find((w) => w.workspaceId === activeId) ?? workspaces?.[0];
  const name = current?.workspaceName ?? '워크스페이스';
  const iconUrl = secureUrl(current?.iconImageUrl);
  const badge = unread ?? 0;

  const fallbackY = useSharedValue(0);
  const sv = scrollY ?? fallbackY;
  // 채팅 헤더와 동일: 최상단은 완전 투명, 콘텐츠가 네비 뒤로 지나가면 네이티브 블러가 페이드인.
  // scrollY 미전달 화면은 sv.value=0 고정 → 항상 투명.
  const blurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sv.value, [0, FADE_DISTANCE], [0, 1], Extrapolation.CLAMP),
  }));

  // 검색·알림·(trailing 뷰메뉴)을 각각 독립 버튼으로 분리
  const rightCluster = (
    <>
      {trailing ? <View style={styles.trailingSlot}>{trailing}</View> : null}
      <IconBtn icon="search" size={21} onPress={() => router.push('/search')} glass={glass} theme={theme} label="검색" />
      <View>
        <IconBtn icon="notifications-outline" size={22} onPress={() => router.push('/notifications')} glass={glass} theme={theme} label="알림" />
        {badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: '#FF3B30', borderColor: theme.background }]} pointerEvents="none">
            <ThemedText type="label" style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} pointerEvents="box-none">
      {/* 채팅 헤더와 동일한 네이티브 시스템 블러(무채색) — 최상단 투명, 스크롤 시 콘텐츠가
          네비 뒤로 지나가면 블러 페이드인. 색은 없고 블러만. */}
      <Animated.View style={[styles.bg, blurStyle]} pointerEvents="none">
        <BlurBackdrop tint="systemUltraThinMaterial" intensity={100} />
      </Animated.View>
      <View style={styles.row}>
        <Pressable style={styles.wsChip} hitSlop={6} onPress={() => setWsSwitcher(true)}>
          {iconUrl ? (
            <Image source={{ uri: iconUrl }} style={styles.wsIcon} contentFit="cover" />
          ) : (
            <View style={[styles.wsIcon, { backgroundColor: colorFromName(name) }]}>
              <ThemedText style={styles.wsIconText}>{name.slice(0, 1)}</ThemedText>
            </View>
          )}
          <ThemedText type="title" style={styles.wsName} numberOfLines={1}>
            {name}
          </ThemedText>
          <Ionicons name="chevron-down" size={18} color={theme.text} />
        </Pressable>

        {/* 검색·알림·뷰메뉴 각각 독립 글래스 버튼(묶지 않음) */}
        <View style={styles.right}>{rightCluster}</View>
      </View>

      <WorkspaceSwitcher open={wsSwitcher} onClose={() => setWsSwitcher(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 11, paddingBottom: 7, gap: 8 },
  // overflow:visible — 롱프레스 시 글래스가 프레임 밖으로 늘어나도 잘리지 않게
  wsChip: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, maxWidth: '64%' },
  wsIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  wsIconText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  wsName: { fontSize: 19, fontWeight: '800', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'visible' },
  iconBtnFill: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  trailingSlot: { height: 40, alignItems: 'center', justifyContent: 'center' },
  // iOS 표준 알림 배지 — 시스템 레드 캡슐 + 배경색 컷아웃 링, 벨 우상단 코너에 부양
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 13, textAlign: 'center' },
});
