import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { KAKAO_JS_KEY, KAKAO_MAP_REFERRER } from '@/shared/config/env';
import { tickHaptic } from '@/shared/ui/haptics';
import { useTheme } from '@/hooks/use-theme';

import type { RecruitmentListItem } from './api';
import { getCategory } from './config';
import { buildRecruitMapHtml } from './recruitMapHtml';

const MINI_W = 0.75; // 웹 peek 미니카드 75% 폭
const SNAP_PCT = { peek: 22, half: 50, full: 90 } as const; // 웹 MapBottomSheet SNAP_H 동일
type Snap = keyof typeof SNAP_PCT;

const SPRING = { damping: 24, stiffness: 260, mass: 0.7 };

/** 팀 모집 지도 모드 — 카테고리 핀 + 드래그 스냅(22/50/90%) 바텀시트. 웹 MapBottomSheet 미러. */
export function RecruitMap({
  items,
  myLoc,
  radiusKm,
  onDetail,
  onCreate,
}: {
  items: RecruitmentListItem[];
  myLoc: { lat: number; lng: number } | null;
  radiusKm: number | null;
  onDetail: (id: number) => void;
  onCreate: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [snap, setSnap] = useState<Snap>('peek');
  // 현재 지도 화면 영역 — 목록을 "이 지역"으로 좁힌다 (웹 클라이언트 bbox 필터 미러)
  const [bounds, setBounds] = useState<{ sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null>(null);
  const [containerH, setContainerH] = useState(0);
  const carouselRef = useRef<FlatList<RecruitmentListItem>>(null);
  const html = useState(() => buildRecruitMapHtml(KAKAO_JS_KEY))[0];
  /* 지도 로드 실패를 회색 빈 화면으로 끝내지 않는다.
     - keyMissing: EAS env에 EXPO_PUBLIC_KAKAO_JS_KEY가 없으면 env.ts가 빈 문자열로 폴백해
       SDK가 무조건 거절당한다. 재시도해도 소용없으므로 재시도 버튼을 내지 않는다.
     - failed: SDK/네트워크 실패(WebView onError·HTML의 error 메시지·ready 타임아웃) */
  const keyMissing = !KAKAO_JS_KEY;
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // ready가 영영 안 오는 경우(스크립트 무응답)도 로딩 상태에 갇히지 않게 상한을 둔다
  useEffect(() => {
    if (ready || failed || keyMissing) return;
    const t = setTimeout(() => setFailed(true), 8000);
    return () => clearTimeout(t);
  }, [ready, failed, keyMissing, reloadKey]);

  const retryMap = () => {
    setFailed(false);
    setReady(false);
    setReloadKey((k) => k + 1); // WebView key 교체 = 완전 재마운트
  };

  // 시트 높이 — 드래그 중엔 손가락 추적, 놓으면 가까운 스냅으로 스프링
  const sheetH = useSharedValue(0);
  const dragStartH = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({ height: sheetH.value }));

  /* eslint-disable react-hooks/immutability -- Reanimated shared value(.value)는 공식 API */
  // effect 없이 이벤트 시점에만 시트 높이 구동 (shared value ↔ compiler 충돌 회피)
  const applySnap = (s: Snap, h = containerH) => {
    setSnap((prev) => {
      if (prev !== s) tickHaptic();
      return s;
    });
    if (h > 0) sheetH.value = withSpring((h * SNAP_PCT[s]) / 100, SPRING);
  };

  const onContainerLayout = (h: number) => {
    setContainerH(h);
    // 첫 레이아웃/회전 시 현재 스냅 높이로 정렬
    sheetH.value = withSpring((h * SNAP_PCT[snap]) / 100, SPRING);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      dragStartH.value = sheetH.value;
    })
    .onUpdate((e) => {
      'worklet';
      const min = (containerH * SNAP_PCT.peek) / 100;
      const max = (containerH * SNAP_PCT.full) / 100;
      sheetH.value = Math.min(max, Math.max(min, dragStartH.value - e.translationY));
    })
    .onEnd((e) => {
      'worklet';
      const h = sheetH.value - e.velocityY * 0.08; // 플릭 관성 반영
      const dPeek = Math.abs((containerH * SNAP_PCT.peek) / 100 - h);
      const dHalf = Math.abs((containerH * SNAP_PCT.half) / 100 - h);
      const dFull = Math.abs((containerH * SNAP_PCT.full) / 100 - h);
      const best: Snap = dPeek <= dHalf && dPeek <= dFull ? 'peek' : dHalf <= dFull ? 'half' : 'full';
      sheetH.value = withSpring((containerH * SNAP_PCT[best]) / 100, SPRING);
      runOnJS(setSnap)(best);
    });
  /* eslint-enable react-hooks/immutability */

  // 마커는 위치 있는 전부(웹과 동일 — 화면 밖은 지도가 잘라 보임)
  const mapItems = items.filter((i) => i.locationLat != null && i.locationLng != null);
  // 목록/카운트는 현재 화면 영역 안의 것만. 첫 idle 전(bounds null)엔 전체(빈 화면 깜빡임 방지)
  const visibleItems = bounds
    ? mapItems.filter(
        (i) =>
          i.locationLat! >= bounds.sw.lat &&
          i.locationLat! <= bounds.ne.lat &&
          i.locationLng! >= bounds.sw.lng &&
          i.locationLng! <= bounds.ne.lng,
      )
    : mapItems;

  useEffect(() => {
    if (!ready) return;
    const payload = mapItems.map((i) => ({
      id: i.id,
      lat: i.locationLat,
      lng: i.locationLng,
      color: getCategory(i.typeLabel).color,
      emoji: getCategory(i.typeLabel).icon,
    }));
    webRef.current?.injectJavaScript(
      `window.__setItems(${JSON.stringify(payload)}, ${JSON.stringify(myLoc)}, ${JSON.stringify(radiusKm)});true;`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapItems는 items 파생
  }, [ready, items, myLoc, radiusKm]);

  const select = (id: number | null, scroll = true) => {
    setSelected(id);
    webRef.current?.injectJavaScript(`window.__select(${JSON.stringify(id)});true;`);
    // 마커 선택 시 peek → half 자동 확장 (웹과 동일)
    if (id != null && snap === 'peek' && !scroll) return;
    if (id != null && scroll) {
      const idx = visibleItems.findIndex((i) => i.id === id);
      if (idx >= 0 && snap === 'peek') carouselRef.current?.scrollToIndex({ index: idx, animated: true });
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') {
        setReady(true);
        setFailed(false);
      } else if (msg.type === 'error') setFailed(true);
      else if (msg.type === 'bounds') setBounds({ sw: msg.sw, ne: msg.ne });
      else if (msg.type === 'markerTap') {
        tickHaptic();
        const next = msg.id === selected ? null : msg.id;
        select(next);
        if (next != null && snap === 'peek') applySnap('half');
      } else if (msg.type === 'mapTap') {
        select(null);
      }
    } catch {
      /* ignore */
    }
  };

  const peekPx = (containerH * SNAP_PCT.peek) / 100;

  return (
    <View style={styles.flex1} onLayout={(e) => onContainerLayout(e.nativeEvent.layout.height)}>
      {keyMissing ? null : (
        <WebView
          key={reloadKey}
          ref={webRef}
          source={{ html, baseUrl: KAKAO_MAP_REFERRER }}
          originWhitelist={['*']}
          onMessage={onMessage}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          style={styles.flex1}
          scrollEnabled={false}
          bounces={false}
        />
      )}

      {/* 지도 실패 안내 — 빈 회색 화면으로 위장되지 않게. 목록 보기는 그대로 쓸 수 있다 */}
      {keyMissing || failed ? (
        <View style={[styles.mapError, { backgroundColor: theme.background }]}>
          <Ionicons name="map-outline" size={30} color={theme.textTertiary} />
          <ThemedText type="default" style={styles.mapErrorTitle}>
            지도를 불러오지 못했어요
          </ThemedText>
          <ThemedText type="small" style={[styles.mapErrorSub, { color: theme.textSecondary }]}>
            {keyMissing
              ? '지도 키 설정이 없어 지도를 표시할 수 없어요. 목록 보기로 확인해 주세요.'
              : '네트워크 상태를 확인한 뒤 다시 시도해 주세요. 목록 보기는 그대로 쓸 수 있어요.'}
          </ThemedText>
          {keyMissing ? null : (
            <Pressable onPress={retryMap} accessibilityRole="button" style={[styles.mapRetry, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
                다시 시도
              </ThemedText>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* 지도 위 작성 FAB — 시트 peek 위에 떠 있고, full에선 숨김 (웹 CreateFab 미러) */}
      {snap !== 'full' ? (
        <Pressable
          onPress={() => {
            tickHaptic();
            onCreate();
          }}
          accessibilityLabel="모집 만들기"
          accessibilityRole="button"
          style={[styles.mapFab, { backgroundColor: theme.primary, bottom: (snap === 'peek' ? peekPx : (containerH * SNAP_PCT.half) / 100) + 16 }]}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      ) : null}

      {/* 드래그 스냅 바텀시트 */}
      <Animated.View style={[styles.sheet, { backgroundColor: theme.surface }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.handleZone}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <ThemedText type="small" style={styles.sheetTitle}>
              이 지역 {visibleItems.length}개 모집
            </ThemedText>
          </View>
        </GestureDetector>

        {visibleItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ThemedText type="default">📍</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              이 지역에 모집이 없어요
            </ThemedText>
          </View>
        ) : snap === 'peek' ? (
          <FlatList
            ref={carouselRef}
            horizontal
            data={visibleItems}
            keyExtractor={(i) => String(i.id)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={width * MINI_W + 10}
            decelerationRate="fast"
            contentContainerStyle={styles.carousel}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item: i }) => {
              const cat = getCategory(i.typeLabel);
              const sel = selected === i.id;
              return (
                <Pressable
                  onPress={() => {
                    tickHaptic();
                    // 웹: 선택된 카드 다시 탭 → 상세, 아니면 선택+half 확장
                    if (sel && i.id != null) onDetail(i.id);
                    else {
                      select(i.id!, false);
                      applySnap('half');
                    }
                  }}
                  style={[
                    styles.miniCard,
                    { width: width * MINI_W, backgroundColor: theme.surfaceAlt, borderColor: sel ? theme.primary : 'transparent' },
                  ]}>
                  <View style={styles.rowHead}>
                    <ThemedText type="small">{cat.icon}</ThemedText>
                    <ThemedText type="small" style={{ color: cat.color, fontWeight: '700' }}>
                      {i.typeLabel}
                    </ThemedText>
                  </View>
                  <ThemedText type="default" style={styles.rowTitle} numberOfLines={1}>
                    {i.title}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                    {i.author ?? ''}{i.members ? ` · ${i.members}` : ''}
                  </ThemedText>
                </Pressable>
              );
            }}
          />
        ) : (
          <ScrollView style={styles.flex1} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listPad}>
            {visibleItems.map((i) => {
              const cat = getCategory(i.typeLabel);
              const sel = selected === i.id;
              return (
                <Pressable
                  key={i.id}
                  onPress={() => {
                    tickHaptic();
                    select(i.id!, false);
                  }}
                  style={[
                    styles.rowCard,
                    { backgroundColor: theme.surfaceAlt, borderColor: sel ? theme.primary : 'transparent' },
                  ]}>
                  <View style={styles.rowHead}>
                    <ThemedText type="small">{cat.icon}</ThemedText>
                    <ThemedText type="small" style={{ color: cat.color, fontWeight: '700' }}>
                      {i.typeLabel}
                    </ThemedText>
                    {i.dueText ? (
                      <ThemedText type="small" style={{ color: theme.textTertiary }}>
                        {i.dueText}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText type="default" style={styles.rowTitle} numberOfLines={1}>
                    {i.title}
                  </ThemedText>
                  <View style={styles.rowFoot}>
                    <ThemedText type="small" style={[styles.flex1, { color: theme.textSecondary }]} numberOfLines={1}>
                      {i.author ?? ''}{i.members ? ` · ${i.members}` : ''}
                    </ThemedText>
                    {sel ? (
                      <Pressable onPress={() => i.id != null && onDetail(i.id)} hitSlop={6}>
                        <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
                          자세히 보기 →
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
    overflow: 'hidden',
  },
  mapError: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 36 },
  mapErrorTitle: { fontWeight: '800' },
  mapErrorSub: { textAlign: 'center', lineHeight: 19 },
  mapRetry: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  handleZone: { alignItems: 'center', paddingTop: 8, paddingBottom: 8, gap: 6 },
  handle: { width: 38, height: 4.5, borderRadius: 3 },
  sheetTitle: { fontWeight: '800' },
  emptyWrap: { alignItems: 'center', gap: 4, paddingTop: 20 },
  carousel: { paddingHorizontal: 14, gap: 10 },
  miniCard: { borderRadius: 14, borderWidth: 1.5, padding: 12, gap: 5 },
  listPad: { paddingHorizontal: 14, paddingBottom: 16, gap: 8 },
  rowCard: { borderRadius: 14, borderWidth: 1.5, padding: 12, gap: 5 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowTitle: { fontWeight: '800' },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapFab: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
