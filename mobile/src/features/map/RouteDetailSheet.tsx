import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, LayoutAnimation, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { shadow } from '@/shared/ui/tokens';
import { tickHaptic } from '@/shared/ui/haptics';

import { estimateTravel } from './travel';
import { ROUTE_MODES, routeProvider, type RouteMode } from './routeProvider';
import { RouteSummary, SegmentedControl, SheetCta, TransitTimeline } from './RouteSheetUi';

/**
 * 구간 상세 카드 — 오늘 동선의 한 구간(A→B)을 멀티모달로 비교 (Toss 스타일).
 * 모달이 아니라 지도 위에 떠 있는 플로팅 카드: 배경 딤 없음, 뒤 지도는 자유롭게 조작 가능.
 * 도보/자전거/대중교통/차량 모두 카카오 실경로, API 실패 시 직선 추정 폴백(routeProvider).
 */
export function RouteDetailSheet({
  target,
  origin,
  onClose,
  onPolyline,
}: {
  /** null이면 닫힘. from이 있으면 그 지점(이전 스톱)이 출발점, 없으면 현재 위치 */
  target: {
    lat: number;
    lng: number;
    title?: string | null;
    place?: string | null;
    from?: { lat: number; lng: number; name?: string | null } | null;
  } | null;
  origin: { lat: number; lng: number } | null;
  onClose: () => void;
  /** 실경로 폴리라인 수신 — 지도에 그리기(null=제거). 지도 화면이 WebView에 주입한다. */
  onPolyline?: (points: { lat: number; lng: number }[] | null) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  /** 이 구간의 실제 출발점 — 이전 스톱 또는 현재 위치 */
  const from = target?.from ?? origin;

  // 구간별 스마트 기본 모드 — 걷기 거리면 도보, 시외면 차량, 그 외 대중교통.
  // "props에서 상태 유도" 패턴: 구간(key)이 바뀌면 렌더 중에 기본값을 다시 계산한다.
  const segKey = target ? `${target.lat},${target.lng}|${from?.lat},${from?.lng}` : '';
  const [modeSel, setModeSel] = useState<{ key: string; mode: RouteMode }>({ key: '', mode: 'walk' });
  if (target && from && modeSel.key !== segKey) {
    const est = estimateTravel(from.lat, from.lng, target.lat, target.lng);
    setModeSel({ key: segKey, mode: est.mode === 'walk' ? 'walk' : est.distKm > 40 ? 'drive' : 'transit' });
  }
  const mode = modeSel.mode;
  const setMode = (m: RouteMode) => setModeSel({ key: segKey, mode: m });

  const { data: result, isFetching: loading } = useQuery({
    queryKey: ['route', target?.lat, target?.lng, from?.lat, from?.lng, mode],
    queryFn: () => routeProvider.getRoute({ fromLat: from!.lat, fromLng: from!.lng, toLat: target!.lat, toLng: target!.lng }, mode),
    enabled: target != null && from != null,
    staleTime: 60_000,
  });

  // 실경로가 오면 지도에 그리고, 카드 닫힘/모드 전환으로 사라지면 제거
  useEffect(() => {
    onPolyline?.(target && result?.polyline?.length ? result.polyline : null);
  }, [target, result, onPolyline]);

  /** 직선거리(km) — 시외 판정용 */
  const farKm = target && from ? estimateTravel(from.lat, from.lng, target.lat, target.lng).distKm : 0;

  const changeMode = (m: RouteMode) => {
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setMode(m);
  };

  const openKakao = async () => {
    if (!target) return;
    tickHaptic();
    const by = mode === 'walk' ? 'FOOT' : mode === 'bike' ? 'BICYCLE' : mode === 'transit' ? 'PUBLICTRANSIT' : 'CAR';
    const app = from
      ? `kakaomap://route?sp=${from.lat},${from.lng}&ep=${target.lat},${target.lng}&by=${by}`
      : `kakaomap://look?p=${target.lat},${target.lng}`;
    try {
      await Linking.openURL(app);
    } catch {
      await Linking.openURL(
        `https://map.kakao.com/link/to/${encodeURIComponent(target.place ?? target.title ?? '목적지')},${target.lat},${target.lng}`,
      ).catch(() => {});
    }
  };

  if (!target) return null;

  const transitLegs = mode === 'transit' && result?.available && result.legs?.length ? result.legs : null;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : SlideInDown.duration(220)}
      style={[
        styles.card,
        shadow.float,
        { backgroundColor: theme.surface, bottom: insets.bottom + 10 },
      ]}>
      {/* 헤더 — 타이틀 + 닫기 (배경 딤이 없으므로 명시적 X) */}
      <View style={styles.head}>
        <Ionicons name="navigate" size={14} color={theme.primary} />
        <ThemedText style={styles.title} numberOfLines={1}>
          {target.title ?? '경로'}
        </ThemedText>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="닫기" accessibilityRole="button">
          <Ionicons name="close" size={20} color={theme.textTertiary} />
        </Pressable>
      </View>
      <ThemedText style={[styles.subline, { color: theme.textTertiary }]} numberOfLines={1}>
        {target.from?.name ?? '현재 위치'}{' '}
        <ThemedText style={[styles.sublineTo, { color: theme.textSecondary }]}>
          → {target.place ?? target.title ?? '목적지'}
        </ThemedText>
      </ThemedText>

      <SegmentedControl modes={ROUTE_MODES} value={mode} onChange={changeMode} />

      <View style={styles.result}>
        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : !from ? (
          <ThemedText type="small" style={[styles.notice, { color: theme.textTertiary }]}>
            현재 위치를 확인할 수 없어요. 위치 권한을 켜면 경로가 표시돼요.
          </ThemedText>
        ) : result && !result.available ? (
          <View style={styles.unavailable}>
            <ThemedText type="default" style={styles.unavailableTitle}>
              {farKm > 40 ? '시외 구간은 시내 대중교통으로 못 가요' : '대중교통 경로를 찾지 못했어요'}
            </ThemedText>
            <ThemedText type="small" style={[styles.notice, { color: theme.textTertiary }]}>
              {farKm > 40 ? '카카오맵으로 열면 기차·고속버스 경로가 보여요.' : '구간이 짧거나 네트워크 문제일 수 있어요.'}
            </ThemedText>
          </View>
        ) : result ? (
          <>
            {/* 단일 모드는 요약이 전부 — 중복되는 한 줄 카드는 두지 않는다 */}
            <RouteSummary result={result} />
            {transitLegs ? <TransitTimeline legs={transitLegs} /> : null}
          </>
        ) : null}
      </View>

      <SheetCta label="카카오맵으로 열기" icon="map" onPress={openKakao} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 20, // 동선 시트(zIndex 9) 위에 떠야 한다
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '800', flex: 1 },
  subline: { fontSize: 13, lineHeight: 17 },
  sublineTo: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  result: { minHeight: 84, justifyContent: 'center' },
  loading: { paddingVertical: 22 },
  notice: { textAlign: 'center' },
  unavailable: { alignItems: 'center', gap: 4, paddingVertical: 12 },
  unavailableTitle: { fontWeight: '700' },
});
