import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActionSheetIOS, ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';
import GorhomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import * as Location from 'expo-location';

import { NativeSymbol } from '@/shared/ui/NativeSymbol';
import { ensureBackgroundLocationPermission } from '@/features/map/geofence';
import { LocationSheet } from '@/features/map/LocationSheet';
import { buildMapHtml } from '@/features/map/mapHtml';
import { estimateTravel, fmtKm, fmtMinutes, type TravelEstimate } from '@/features/map/travel';
import { RouteDetailSheet } from '@/features/map/RouteDetailSheet';
import { getSegmentRoute, segmentKey, type SegmentRoute } from '@/features/map/routeProvider';
import {
  useLocationTodos,
  useSaveTriggers,
  useTriggers,
  useUpdateTodoLocation,
} from '@/features/map/queries';
import { useMapSearchStore, type Place } from '@/features/map/searchStore';
import { isTodoDone, useStatusMap } from '@/features/status/queries';
import { BottomSheet } from '@/features/todo/todoPickers';
import { useMe } from '@/features/auth/queries';
import { useDeleteTodo, useTodos } from '@/features/todo/queries';
import type { Todo } from '@/features/todo/api';
import { KAKAO_JS_KEY, KAKAO_MAP_REFERRER } from '@/shared/config/env';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/shared/ui/Button';
import { tickHaptic } from '@/shared/ui/haptics';
import { toast } from '@/shared/ui/toast';
import { Segmented } from '@/shared/ui/Segmented';
import { toDateString } from '@/shared/utils/datetime';
import { readableOn, statusColor } from '@/shared/ui/tone';

// 지도 롱프레스 기능은 화면 어디에도 힌트가 없어 발견이 어렵다 — 세션당 1회만 안내
const placeHint = { shown: false };
function showPlaceHintOnce() {
  if (placeHint.shown) return;
  placeHint.shown = true;
  toast.info('지도를 길게 누르면 그 자리에 할 일을 만들 수 있어요');
}

const SCREEN_H = Dimensions.get('window').height;

const RADIUS_OPTIONS = [
  { value: '200', label: '200m' },
  { value: '500', label: '500m' },
  { value: '1000', label: '1km' },
];

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(KAKAO_JS_KEY), []);
  // 바텀시트 상단 Y(gorhom animatedPosition) — FAB이 시트 위에 붙어 함께 움직이도록
  const sheetTop = useSharedValue(SCREEN_H);
  const fabStyle = useAnimatedStyle(() => {
    // 시트가 중간 스냅(46%)보다 위로 올라가면 FAB을 오른쪽으로 밀어내며 페이드 아웃.
    // 페이드 구간(0.44H~0.52H)은 스냅 지점 사이라, 어느 스냅에 멈춰도 '반쯤 겹친' 상태가 없다.
    const hide = interpolate(sheetTop.value, [SCREEN_H * 0.44, SCREEN_H * 0.52], [1, 0], Extrapolation.CLAMP);
    return {
      top: Math.max(sheetTop.value - 168, SCREEN_H * 0.36),
      opacity: 1 - hide,
      transform: [{ translateX: hide * 80 }],
    };
  });

  const { data: locationTodos, refetch: refetchLocationTodos, isError: locError } = useLocationTodos();
  const { data: me } = useMe();
  const { data: allTodos } = useTodos();
  const { data: triggers } = useTriggers();
  // 마커 색·카드 상태 라벨 — 커스텀 상태(st_<uuid>)가 원시 키/빨강으로 나오던 걸 상태 맵으로 해결
  const sm = useStatusMap();
  const updateLocation = useUpdateTodoLocation();
  const deleteTodo = useDeleteTodo();
  const saveTriggers = useSaveTriggers();

  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingPlace, setPendingPlace] = useState<Place | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  // /map?route=1 — 동선 브리핑 알림 탭 등 딥링크로 진입 시 동선 모드로 시작
  const { route: routeParam } = useLocalSearchParams<{ route?: string }>();
  // 오늘 동선 모드 — 오늘 위치 일정을 시간순으로 잇는다
  const [routeMode, setRouteMode] = useState(routeParam === '1');
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  // 구간 상세 시트 대상 (멀티모달 경로 비교)
  const [segTarget, setSegTarget] = useState<{
    lat: number;
    lng: number;
    title?: string | null;
    place?: string | null;
    /** 구간 출발점 — null이면 현재 위치(첫 구간) */
    from?: { lat: number; lng: number; name?: string | null } | null;
  } | null>(null);
  // 동선 정제 — 제외한 스탑 id, 시간 없는 심부름의 최적화 순서(id 배열)
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [optOrder, setOptOrder] = useState<number[] | null>(null);

  // 완료 숨기기 토글 반영 — 마커/목록 공통
  const visibleTodos = useMemo(
    () => (locationTodos ?? []).filter((t) => !hideDone || !isTodoDone(t)),
    [locationTodos, hideDone],
  );

  // 오늘 동선 스탑 — '내 일정'(작성자이거나 담당자)만. 오늘 시작/마감 + 좌표 보유(완료 포함 = 발자취), 시작시간순
  const todayStops = useMemo(() => {
    const today = toDateString(new Date());
    const myEmail = me?.email;
    return (locationTodos ?? [])
      .filter(
        (t) =>
          t.locationLat != null &&
          t.locationLng != null &&
          (t.startAt === today || t.dueDate === today) &&
          (!myEmail || t.userEmail === myEmail || (t.assignees ?? []).some((a) => a.email === myEmail)),
      )
      .sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'));
  }, [locationTodos, me?.email]);

  // 실제 동선에 쓰는 순서 — 제외 반영 + 시간 있는 일정(고정) 먼저, 시간 없는 심부름은 최적화 순서 적용
  const orderedStops = useMemo(() => {
    const included = todayStops.filter((t) => t.id == null || !excluded.has(t.id));
    const timed = included.filter((t) => t.startTime);
    const untimed = included.filter((t) => !t.startTime);
    const orderedUntimed =
      optOrder != null
        ? optOrder.map((id) => untimed.find((t) => t.id === id)).filter((t): t is (typeof untimed)[number] => t != null)
        : untimed;
    // optOrder에 없던 새 항목은 뒤에 append
    for (const u of untimed) if (!orderedUntimed.includes(u)) orderedUntimed.push(u);
    return [...timed, ...orderedUntimed];
  }, [todayStops, excluded, optOrder]);

  const excludedStops = useMemo(
    () => todayStops.filter((t) => t.id != null && excluded.has(t.id)),
    [todayStops, excluded],
  );
  const untimedCount = useMemo(() => orderedStops.filter((t) => !t.startTime).length, [orderedStops]);

  // 구간 실경로(카카오 도보/내비) — 성공분만 누적, 실패 구간은 추정·직선 유지
  const [segRoutes, setSegRoutes] = useState<Record<string, SegmentRoute>>({});
  useEffect(() => {
    if (!routeMode) return;
    let alive = true;
    const pts = [
      ...(origin ? [origin] : []),
      ...orderedStops.filter((t) => t.locationLat != null && t.locationLng != null).map((t) => ({ lat: t.locationLat!, lng: t.locationLng! })),
    ];
    (async () => {
      const updates: Record<string, SegmentRoute> = {};
      await Promise.all(
        Array.from({ length: Math.max(0, pts.length - 1) }, (_, i) => i).map(async (i) => {
          const r = await getSegmentRoute(pts[i], pts[i + 1]).catch(() => null);
          if (r) updates[segmentKey(pts[i], pts[i + 1])] = r;
        }),
      );
      if (alive && Object.keys(updates).length) setSegRoutes((s) => ({ ...s, ...updates }));
    })();
    return () => {
      alive = false;
    };
  }, [routeMode, orderedStops, origin]);

    // 구간·출발권장·충돌 파생값 — origin(현위치) → 1 → 2 …
  const routeInfo = useMemo(() => {
    const toMin = (t?: string | null) => {
      if (!t) return null;
      const [h, m] = String(t).split(':').map(Number);
      return Number.isNaN(h) ? null : h * 60 + (m || 0);
    };
    const fmtHM = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
    const segs: {
      seg: TravelEstimate | null;
      departBy: string | null; // "9:38 출발 권장"용 HH:MM
      conflict: boolean; // 앞 일정 끝나고 이동하면 늦음
    }[] = [];
    let prevPt = origin;
    let prevEndMin: number | null = null;
    for (const t of orderedStops) {
      const est = prevPt ? estimateTravel(prevPt.lat, prevPt.lng, t.locationLat!, t.locationLng!) : null;
      // 실경로 소요시간이 있으면 추정 대신 사용 (출발권장·충돌 판정까지 실시간 기준)
      const real = prevPt ? segRoutes[segmentKey(prevPt, { lat: t.locationLat!, lng: t.locationLng! })] : undefined;
      const seg = est && real ? { ...est, minutes: real.minutes } : est;
      const startMin = toMin(t.startTime);
      const departMin = seg && startMin != null ? startMin - seg.minutes - 10 : null;
      const conflict = seg != null && startMin != null && prevEndMin != null && prevEndMin + seg.minutes > startMin;
      segs.push({ seg, departBy: departMin != null && departMin > 0 ? fmtHM(departMin) : null, conflict });
      prevPt = { lat: t.locationLat!, lng: t.locationLng! };
      prevEndMin = toMin(t.endTime) ?? startMin ?? prevEndMin;
    }
    const totalMin = segs.reduce((n, x) => n + (x.seg?.minutes ?? 0), 0);
    const totalKm = segs.reduce((n, x) => n + (x.seg?.distKm ?? 0), 0);
    // 시간 인지 — 종료(없으면 시작+30분)가 지난 미완료는 '지남', 다음 목적지는 아직 유효한 첫 미완료
    const nowD = new Date();
    const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
    const missed = orderedStops.map((t) => {
      if (isTodoDone(t)) return false;
      const startMin = toMin(t.startTime);
      if (startMin == null) return false;
      const endMin = toMin(t.endTime) ?? startMin + 30;
      return endMin < nowMin;
    });
    let nextIdx = orderedStops.findIndex((t, i) => !isTodoDone(t) && !missed[i]);
    if (nextIdx === -1) nextIdx = orderedStops.findIndex((t) => !isTodoDone(t));
    const allDone = orderedStops.length > 0 && orderedStops.every((t) => isTodoDone(t));
    // 출발 시각이 이미 지난 다음 목적지 — '지금 출발' 경고용
    const departNow = segs.map((x, i) => {
      if (i !== nextIdx || !x.seg) return false;
      const startMin = toMin(orderedStops[i].startTime);
      return startMin != null && nowMin + x.seg.minutes + 5 > startMin && startMin > nowMin - 5;
    });
    return { segs, totalMin, totalKm, nextIdx, allDone, missed, departNow, nowMin };
  }, [orderedStops, origin, segRoutes]);

  const selectedTodo = useMemo(
    () => locationTodos?.find((t) => t.id === selectedId) ?? null,
    [locationTodos, selectedId],
  );

  // 시간 없는 심부름 순서 최적화 — 최근접 이웃(마지막 시간 일정/현위치에서 출발)
  const optimizeRoute = () => {
    tickHaptic();
    const included = todayStops.filter((t) => t.id == null || !excluded.has(t.id));
    const untimed = included.filter((t) => !t.startTime && t.locationLat != null);
    if (untimed.length < 2) return;
    const timed = included.filter((t) => t.startTime && t.locationLat != null);
    const startPt = timed.length
      ? { lat: timed[timed.length - 1].locationLat!, lng: timed[timed.length - 1].locationLng! }
      : origin ?? { lat: untimed[0].locationLat!, lng: untimed[0].locationLng! };
    const totalOf = (seq: typeof untimed) => {
      let sum = 0;
      let prev = startPt;
      for (const t of seq) {
        sum += estimateTravel(prev.lat, prev.lng, t.locationLat!, t.locationLng!).minutes;
        prev = { lat: t.locationLat!, lng: t.locationLng! };
      }
      return sum;
    };
    const before = totalOf(untimed);
    // 최근접 이웃
    const remaining = [...untimed];
    const order: typeof untimed = [];
    let cur = startPt;
    while (remaining.length) {
      let bi = 0;
      let bd = Infinity;
      remaining.forEach((t, i) => {
        const d = estimateTravel(cur.lat, cur.lng, t.locationLat!, t.locationLng!).distKm;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const picked = remaining.splice(bi, 1)[0];
      order.push(picked);
      cur = { lat: picked.locationLat!, lng: picked.locationLng! };
    }
    const after = totalOf(order);
    const saved = before - after;
    setOptOrder(order.map((t) => t.id!).filter((id) => id != null));
    toast.success(saved > 1 ? `순서를 바꿔 약 ${saved}분 절약했어요` : '이미 효율적인 순서예요');
  };

  const inject = useCallback((js: string) => {
    webRef.current?.injectJavaScript(js + ';true;');
  }, []);

  /** 구간 상세 시트의 실경로 폴리라인을 지도에 반영 (안정 참조 — 리렌더마다 재주입 방지) */
  const onSegPolyline = useCallback(
    (pts: { lat: number; lng: number }[] | null) => inject(`window.__setSegRoute(${JSON.stringify(pts)})`),
    [inject],
  );

  // 지도 준비/데이터 변경 시 마커 갱신
  useEffect(() => {
    if (!ready) return;
    const arr = visibleTodos
      .filter((t) => t.locationLat != null && t.locationLng != null)
      .map((t) => {
        const trig = t.id != null ? triggers?.[String(t.id)] : undefined;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          color: sm.color(t.status) ?? statusColor(theme, t.status, sm.category(t.status)),
          lat: t.locationLat,
          lng: t.locationLng,
          // 도착 알림 켜진 할 일은 반경 원 표시
          radius: trig?.enabled ? (trig.radius ?? 500) : null,
        };
      });
    // 동선 모드에선 기본 핀을 숨긴다 — 번호 스톱 마커와 겹쳐 어지러움
    inject(`window.__setTodos(${JSON.stringify(routeMode ? [] : arr)})`);
    // sm: 상태 목록이 로드/변경되면 마커 색도 다시 칠해야 한다 (useMemo라 참조는 안정적)
  }, [ready, visibleTodos, triggers, inject, theme, routeMode, sm]);

  // 오늘 동선 레이어 — 모드 on: 번호 오버레이+폴리라인, off: 제거
  useEffect(() => {
    if (!ready) return;
    if (!routeMode) {
      inject('window.__setRoute(null)');
      return;
    }
    let prevPt = origin;
    const stops = orderedStops.map((t, i) => {
      const pt = { lat: t.locationLat!, lng: t.locationLng! };
      const real = prevPt ? segRoutes[segmentKey(prevPt, pt)] : undefined;
      prevPt = pt;
      return {
        i: i + 1,
        lat: t.locationLat,
        lng: t.locationLng,
        state: isTodoDone(t) ? 'done' : i === routeInfo.nextIdx ? 'next' : 'todo', // 지남(missed)은 리스트에서만 — 마커 색 남발 방지
        segLabel: routeInfo.segs[i]?.seg ? fmtMinutes(routeInfo.segs[i]!.seg!.minutes).replace('약 ', '') : null,
        segPath: real?.path ?? null, // 실경로 좌표열 — 없으면 직선
      };
    });
    inject(`window.__setRoute(${JSON.stringify({ stops, origin })})`);
  }, [ready, routeMode, orderedStops, origin, routeInfo, segRoutes, inject]);

  // 모드 진입 시 현위치 1회 확보 (권한 있을 때만 — 요청은 위치 추적 effect가 담당)
  useEffect(() => {
    if (!routeMode) return;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null));
      if (pos) setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, [routeMode]);

  // 내 위치 마커 — 포그라운드 위치 추적해 WebView에 표시
  useEffect(() => {
    if (!ready) return;
    let sub: Location.LocationSubscription | undefined;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
        (pos) => inject(`window.__myLocation(${pos.coords.latitude},${pos.coords.longitude})`),
      );
    })();
    return () => sub?.remove();
  }, [ready, inject]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      setReady(true);
      showPlaceHintOnce();
    } else if (msg.type === 'markerTap') {
      const id = Number(msg.id);
      setSelectedId(id);
      inject(`window.__select(${id})`);
    } else if (msg.type === 'mapTap') {
      const name = (msg.name as string) || '';
      const address = (msg.address as string) || '';
      const p: Place = {
        name: name || address || '선택한 위치',
        address,
        lat: msg.lat as number,
        lng: msg.lng as number,
      };
      inject(`window.__setTemp(${p.lat},${p.lng})`);
      openPlaceActions(p);
    }
  };

  /** 장소 액션 — 네이티브 ActionSheet (딤 모달 대신). 닫힘 애니메이션 충돌·setTimeout 핵 불필요 */
  const openPlaceActions = (p: Place) => {
      setPendingPlace(p);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: p.name,
          message: p.address && p.address !== p.name ? p.address : undefined,
          options: ['여기에 할 일 추가', '기존 할 일에 위치 지정', '취소'],
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) {
            router.push({
              pathname: '/todo/new',
              params: {
                locationLat: String(p.lat),
                locationLng: String(p.lng),
                locationName: p.name,
                locationAddress: p.address,
              },
            });
            setPendingPlace(null);
            inject('window.__setTemp(null)');
          } else if (idx === 1) {
            setAssignOpen(true); // pendingPlace 유지 — 선택 시 doAssign에서 사용
          } else {
            setPendingPlace(null);
            inject('window.__setTemp(null)');
          }
        },
      );
  };

  // 장소 검색 라우트에서 고른 장소 수신 — 모달이 닫혀 지도로 돌아올 때 store에서 읽는다.
  // 검색 모달 dismiss 애니메이션과 액션 시트(Modal)가 겹치면 터치가 멈춰서, 닫힌 뒤 처리한다.
  useFocusEffect(
    useCallback(() => {
      // 상세/할일에서 상태(완료 등)가 바뀌었을 수 있어 최신 위치 할 일을 다시 받아온다
      refetchLocationTodos();
      const picked = useMapSearchStore.getState().picked;
      if (!picked) return;
      useMapSearchStore.getState().clear();
      // 검색 모달 dismiss 애니메이션과 겹치지 않게 살짝 늦춰 장소 액션 실행
      const t = setTimeout(() => {
        inject(`window.__setTemp(${picked.lat},${picked.lng})`);
        openPlaceActions(picked);
      }, 400);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- openPlaceActions는 컴파일러가 안정화
    }, [inject, refetchLocationTodos]),
  );

  const clearTemp = () => inject('window.__setTemp(null)');

  const doAssign = async (todo: Todo) => {
    if (!pendingPlace || todo.id == null) return;
    const place = pendingPlace;
    try {
      await updateLocation.mutateAsync({
        id: todo.id,
        location: { locationLat: place.lat, locationLng: place.lng, locationName: place.name, locationAddress: place.address },
      });
      setAssignOpen(false);
      setPendingPlace(null);
      clearTemp();
    } catch {
      // 실패 메시지는 전역 toast(mutationCache onError)가 표시
    }
  };

  // 확인은 호출부의 네이티브 액션시트(destructive)가 담당 — 이중 확인 없음
  const deleteSelectedTodo = () => {
    if (selectedId == null) return;
    const tid = selectedId;
    setSelectedId(null);
    deleteTodo.mutate(tid, { onSuccess: () => refetchLocationTodos() });
  };

  const trigger = selectedId != null ? triggers?.[String(selectedId)] : undefined;
  const setTrigger = (next: { enabled?: boolean; radius?: number }) => {
    if (selectedId == null) return;
    const cur = triggers?.[String(selectedId)] ?? { enabled: false, radius: 500 };
    if (next.enabled) void ensureBackgroundLocationPermission(); // 켤 때 백그라운드 위치 권한 요청
    saveTriggers.mutate({ ...(triggers ?? {}), [String(selectedId)]: { ...cur, ...next } });
  };

  // 지오펜싱 동기화는 루트의 GeofenceBridge가 전역으로 담당 (지도 밖 변경도 반영)

  return (
    <View style={styles.container}>
      {/* 지도 타일은 항상 밝아서 다크모드에서도 상태바(시간·배터리)를 어둡게 고정 */}
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* 지도는 노치까지 풀스크린 — 헤더 없이 네이티브 글래스 칩 버튼 오버레이 */}
      <View style={[styles.topBar, { top: topInset + 4 }]} pointerEvents="box-none">
        <GlassChip onPress={() => router.back()}>
          <NativeSymbol name="chevron.backward" fallback="chevron-back" size={22} color="#1A1A1A" />
        </GlassChip>
        {/* 오늘 동선 토글 — 스탑 수 뱃지 포함 필 */}
        <Pressable
          onPress={() => {
            tickHaptic();
            setRouteMode((v) => !v);
            setSelectedId(null);
            setSegTarget(null); // 동선 토글 시 구간 카드 정리 (플로팅 카드는 스스로 안 닫힘)
          }}
          accessibilityLabel="오늘 동선"
          accessibilityRole="button"
          style={[styles.routePill, { backgroundColor: routeMode ? theme.primary : 'rgba(255,255,255,0.94)' }]}>
          <Ionicons name="navigate" size={14} color={routeMode ? readableOn(theme.primary) : '#1A1A1A'} />
          <ThemedText type="small" style={[styles.routePillText, { color: routeMode ? readableOn(theme.primary) : '#1A1A1A' }]}>
            오늘 동선{todayStops.length ? ` ${todayStops.length}` : ''}
          </ThemedText>
        </Pressable>
        <GlassChip onPress={() => router.push('/map-search')}>
          <NativeSymbol name="magnifyingglass" fallback="search" size={21} color="#1A1A1A" />
        </GlassChip>
      </View>
      <WebView
        ref={webRef}
        style={styles.map}
        originWhitelist={['*']}
        source={{ html, baseUrl: KAKAO_MAP_REFERRER }}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        onMessage={onMessage}
      />

      {!ready ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator />
        </View>
      ) : null}

      {/* 위치 할 일 로드 실패 — 빈 지도로 위장되지 않게 배너 + 탭 재시도 (지도 위라 항상 밝은 톤) */}
      {locError ? (
        <Pressable
          onPress={() => refetchLocationTodos()}
          style={[styles.errBanner, { top: topInset + 56 }]}
          accessibilityRole="button">
          <Ionicons name="cloud-offline-outline" size={14} color="#C62828" />
          <ThemedText type="small" style={styles.errBannerText}>
            위치 할 일을 불러오지 못했어요 — 탭해서 다시 시도
          </ThemedText>
        </Pressable>
      ) : null}

      {/* 오늘 동선 시트 — 스탑 리스트 + 구간 이동시간. 구간/할일 카드가 열려 있으면 숨김(겹침 방지, 닫으면 복귀) */}
      {routeMode && !segTarget && selectedTodo == null ? (
        <GorhomSheet
          snapPoints={[118, '46%', '85%']}
          index={1}
          enableDynamicSizing={false}
          animatedPosition={sheetTop}
          backgroundStyle={[styles.gorhomBg, { backgroundColor: theme.surface }]}
          handleIndicatorStyle={{ backgroundColor: theme.textTertiary, opacity: 0.5, width: 38 }}>
          <View style={styles.routeHead}>
            <Ionicons name="navigate" size={15} color={theme.primary} />
            <ThemedText type="default" style={styles.routeTitle}>
              오늘 동선
            </ThemedText>
            {orderedStops.length ? (
              <ThemedText type="small" style={[styles.routeTotal, { color: routeInfo.allDone ? theme.green : theme.textSecondary }]}>
                {routeInfo.allDone
                  ? '오늘 동선 완주 🎉'
                  : `${orderedStops.length}곳 · 이동 ${fmtMinutes(routeInfo.totalMin)} · ${fmtKm(routeInfo.totalKm)}`}
              </ThemedText>
            ) : null}
            <Pressable
              onPress={() => {
                setRouteMode(false);
                setSegTarget(null);
              }}
              hitSlop={8}
              accessibilityLabel="동선 닫기"
              accessibilityRole="button">
              <Ionicons name="close" size={18} color={theme.textTertiary} />
            </Pressable>
          </View>

          {/* 시간 없는 심부름이 2곳 이상이면 순서 최적화 버튼 */}
          {untimedCount >= 2 ? (
            <Pressable
              onPress={optimizeRoute}
              accessibilityLabel="동선 순서 최적화"
              accessibilityRole="button"
              style={({ pressed }) => [styles.optBtn, { backgroundColor: theme.primary + '12' }, pressed && { opacity: 0.6 }]}>
              <Ionicons name="git-compare-outline" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                시간 미정 {untimedCount}곳 순서 최적화
              </ThemedText>
            </Pressable>
          ) : null}
          {orderedStops.length === 0 && excludedStops.length === 0 ? (
            <View style={styles.routeEmpty}>
              <Ionicons name="map-outline" size={22} color={theme.textTertiary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
                오늘 날짜의 위치 일정이 없어요.{'\n'}할 일에 장소와 날짜를 지정하면 동선이 그려져요.
              </ThemedText>
            </View>
          ) : (
            <BottomSheetFlatList
              data={orderedStops}
              keyExtractor={(t: Todo) => String(t.id)}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                /* 위치 확보 전에도 자리를 예약 — 늦게 나타나면 행들이 밀리며 오탭을 유발한다 */
                <View style={styles.routeStop}>
                  <View style={[styles.routeNum, { backgroundColor: origin ? theme.primary : theme.textTertiary }]}>
                    <Ionicons name="person" size={12} color="#fff" />
                  </View>
                  <View style={styles.routeStopBody}>
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                      {origin ? '현재 위치' : '위치 확인 중…'}
                    </ThemedText>
                  </View>
                </View>
              }
              renderItem={({ item, index }) => {
                const info = routeInfo.segs[index];
                const seg = info?.seg;
                const done = isTodoDone(item);
                const isNext = index === routeInfo.nextIdx;
                return (
                  <View>
                    {seg ? (
                      <Pressable
                        onPress={() => {
                          tickHaptic();
                          // 1→2→3에서 3의 구간은 2→3 — 출발점은 이전 스톱(첫 구간만 현재 위치)
                          const prev = index > 0 ? orderedStops[index - 1] : null;
                          setSegTarget({
                            lat: item.locationLat!,
                            lng: item.locationLng!,
                            title: item.title,
                            place: item.locationName,
                            from: prev
                              ? { lat: prev.locationLat!, lng: prev.locationLng!, name: prev.locationName ?? prev.title }
                              : null,
                          });
                        }}
                        accessibilityLabel="경로 상세"
                        style={({ pressed }) => [styles.routeSeg, pressed && { opacity: 0.6 }]}>
                        <View style={[styles.routeSegLine, { backgroundColor: theme.divider }]} />
                        <Ionicons name={seg.mode === 'walk' ? 'walk-outline' : 'car-outline'} size={13} color={theme.textTertiary} />
                        <ThemedText type="small" style={{ color: theme.textTertiary }}>
                          {fmtMinutes(seg.minutes)} · {fmtKm(seg.distKm)}
                        </ThemedText>
                        <View style={[styles.routeNaviChip, { backgroundColor: theme.primary + '14' }]}>
                          <ThemedText type="small" style={[styles.routeNavi, { color: theme.primary }]}>
                            경로
                          </ThemedText>
                          <Ionicons name="chevron-forward" size={10} color={theme.primary} />
                        </View>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        tickHaptic();
                        if (item.id != null) {
                          setSelectedId(item.id);
                          inject(`window.__select(${item.id})`);
                        }
                      }}
                      accessibilityLabel={`${index + 1}번 ${item.title ?? ''}`}
                      style={({ pressed }) => [styles.routeStop, isNext && { backgroundColor: theme.primary + '0D' }, pressed && { backgroundColor: theme.surfaceSelected }]}>
                      <View style={[styles.routeNum, { backgroundColor: done ? theme.textTertiary : routeInfo.missed[index] ? theme.orange : theme.primary }]}>
                        {done ? (
                          <Ionicons name="checkmark" size={13} color="#fff" />
                        ) : (
                          <ThemedText type="small" style={[styles.routeNumText, { color: readableOn(theme.primary) }]}>
                            {index + 1}
                          </ThemedText>
                        )}
                      </View>
                      <View style={styles.routeStopBody}>
                        <View style={styles.routeTitleRow}>
                          <ThemedText
                            type="default"
                            style={[styles.routeStopTitle, done && { color: theme.textTertiary, textDecorationLine: 'line-through' }]}
                            numberOfLines={1}>
                            {item.title}
                          </ThemedText>
                          {isNext ? (
                            <View style={[styles.nextChip, { backgroundColor: theme.primary }]}>
                              <ThemedText type="small" style={[styles.nextChipText, { color: readableOn(theme.primary) }]}>
                                다음
                              </ThemedText>
                            </View>
                          ) : null}
                        </View>
                        <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                          {item.startTime ? `${String(item.startTime).slice(0, 5)}${!done && routeInfo.missed[index] ? ' 지남' : ''} · ` : ''}
                          {item.locationName ?? ''}
                        </ThemedText>
                        {!done && routeInfo.departNow[index] ? (
                          <View style={styles.warnRow}>
                            <Ionicons name="alert-circle" size={11} color={theme.danger} />
                            <ThemedText type="small" style={{ color: theme.danger, fontWeight: '700' }}>
                              지금 출발해야 늦지 않아요
                            </ThemedText>
                          </View>
                        ) : !done && info?.conflict ? (
                          <View style={styles.warnRow}>
                            <Ionicons name="warning" size={11} color={theme.danger} />
                            <ThemedText type="small" style={{ color: theme.danger, fontWeight: '700' }}>
                              이동시간 부족 — 앞 일정과 겹쳐요
                            </ThemedText>
                          </View>
                        ) : !done && info?.departBy ? (
                          <ThemedText type="small" style={{ color: theme.primary, fontWeight: '600' }}>
                            ⏰ {info.departBy} 출발 권장
                          </ThemedText>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => {
                          if (item.id == null) return;
                          tickHaptic();
                          setExcluded((prev) => {
                            const n = new Set(prev);
                            n.add(item.id!);
                            return n;
                          });
                        }}
                        hitSlop={8}
                        accessibilityLabel="동선에서 제외"
                        accessibilityRole="button"
                        style={[styles.excludeBtn, { backgroundColor: theme.surfaceAlt }]}>
                        <ThemedText type="small" style={{ color: theme.textTertiary, fontWeight: '700', fontSize: 11 }}>
                          제외
                        </ThemedText>
                      </Pressable>
                    </Pressable>
                  </View>
                );
              }}
              ListFooterComponent={
                excludedStops.length ? (
                  <View style={styles.excludedWrap}>
                    <ThemedText type="small" style={{ color: theme.textTertiary, fontWeight: '700', marginBottom: 6 }}>
                      제외됨 {excludedStops.length}
                    </ThemedText>
                    <View style={styles.excludedChips}>
                      {excludedStops.map((t) => (
                        <Pressable
                          key={t.id}
                          onPress={() => {
                            tickHaptic();
                            setExcluded((prev) => {
                              const n = new Set(prev);
                              n.delete(t.id!);
                              return n;
                            });
                          }}
                          accessibilityLabel={`${t.title ?? ''} 동선에 다시 추가`}
                          style={[styles.excludedChip, { backgroundColor: theme.surfaceAlt }]}>
                          <ThemedText type="small" numberOfLines={1} style={{ maxWidth: 120 }}>
                            {t.title}
                          </ThemedText>
                          <Ionicons name="add-circle" size={14} color={theme.primary} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null
              }
            />
          )}
        </GorhomSheet>
      ) : null}

      {/* 우측 하단 플로팅 컨트롤 — 바텀시트 위에 붙어 함께 움직임. 카드가 떠 있으면 숨김 */}
      {selectedTodo == null && segTarget == null ? (
        <Animated.View style={[styles.fabCol, fabStyle]}>
          <FabBtn
            icon={hideDone ? 'eye-off' : 'eye'}
            onPress={() => setHideDone((v) => !v)}
            theme={theme}
            active={hideDone}
          />
          <FabBtn icon="scan-outline" onPress={() => inject('window.__fitAll()')} theme={theme} />
          <FabBtn icon="locate" onPress={() => inject('window.__locate()')} theme={theme} />
        </Animated.View>
      ) : null}

      {/* 상시 확장형 바텀시트 — 위치 할 일 목록 (동선 모드·할일 카드 표시 중엔 숨김) */}
      {!routeMode && selectedTodo == null ? (
        <LocationSheet
          todos={visibleTodos}
          animatedPosition={sheetTop}
          onSelect={(tid) => {
            setSelectedId(tid);
            inject(`window.__select(${tid})`);
          }}
        />
      ) : null}

      {/* 구간 상세 — 멀티모달 경로 비교 */}
      <RouteDetailSheet
        target={segTarget}
        origin={origin}
        onClose={() => setSegTarget(null)}
        onPolyline={onSegPolyline}
      />

      {/* 선택한 할 일 카드 — 지도 위 플로팅(비모달): 뒤 지도 팬/줌 유지, X로 닫기 */}
      {selectedTodo ? (
        <View style={[styles.floatCard, { backgroundColor: theme.surface, bottom: insets.bottom + 10 }]}>
          <View style={styles.cardBody}>
            <View style={styles.cardHead}>
              <ThemedText type="subtitle" numberOfLines={2} style={styles.flex}>
                {selectedTodo.title}
              </ThemedText>
              {selectedTodo.status ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {sm.label(selectedTodo.status)}
                </ThemedText>
              ) : null}
              <Pressable onPress={() => setSelectedId(null)} hitSlop={10} accessibilityLabel="닫기" accessibilityRole="button">
                <Ionicons name="close" size={20} color={theme.textTertiary} />
              </Pressable>
            </View>
            {selectedTodo.locationName ? (
              <View style={styles.addrRow}>
                <Ionicons name="location" size={15} color={theme.primary} />
                <View style={styles.flex}>
                  <ThemedText type="default">{selectedTodo.locationName}</ThemedText>
                  {selectedTodo.locationAddress ? (
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {selectedTodo.locationAddress}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* 도착 알림 트리거 */}
            <View style={[styles.triggerBox, { borderColor: theme.border }]}>
              <View style={styles.triggerHead}>
                <ThemedText type="default">도착 알림</ThemedText>
                <Switch value={!!trigger?.enabled} onValueChange={(v) => setTrigger({ enabled: v })} />
              </View>
              {trigger?.enabled ? (
                <Segmented
                  options={RADIUS_OPTIONS}
                  value={String(trigger?.radius ?? 500)}
                  onChange={(v) => setTrigger({ radius: Number(v) })}
                />
              ) : null}
            </View>

            <View style={styles.cardActions}>
              <Button
                title="상세 보기"
                onPress={() => {
                  const tid = selectedTodo.id;
                  setSelectedId(null);
                  router.push(`/todo/${tid}`); // 모달이 아니라 즉시 push 가능(딜레이 핵 불필요)
                }}
                style={styles.flex}
              />
              {/* 삭제는 1급 버튼 대신 네이티브 액션시트로 강등 */}
              <Pressable
                onPress={() =>
                  ActionSheetIOS.showActionSheetWithOptions(
                    { options: ['할 일 삭제', '취소'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
                    (idx) => idx === 0 && deleteSelectedTodo(),
                  )
                }
                hitSlop={8}
                accessibilityLabel="더보기"
                accessibilityRole="button"
                style={[styles.moreBtn, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* 기존 할 일에 위치 지정 */}
      <BottomSheet open={assignOpen} onClose={() => setAssignOpen(false)}>
        <ThemedText type="label" style={styles.sheetTitle}>
          위치 지정할 할 일 선택
        </ThemedText>
        <FlatList
          data={allTodos ?? []}
          keyExtractor={(t) => String(t.id)}
          style={styles.results}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<ThemedText type="small" style={styles.empty}>할 일이 없어요.</ThemedText>}
          renderItem={({ item }) => (
            <Pressable onPress={() => doAssign(item)} style={[styles.resultRow, { borderBottomColor: theme.divider }]}>
              <Ionicons name="checkbox-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="default" numberOfLines={1} style={styles.flex}>
                {item.title}
              </ThemedText>
              {item.locationLat != null ? <Ionicons name="location" size={14} color={theme.primary} /> : null}
            </Pressable>
          )}
        />
      </BottomSheet>
    </View>
  );
}

function FabBtn({
  icon,
  onPress,
  theme,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: active ? theme.primary : theme.background },
        pressed && { opacity: 0.6 },
      ]}>
      <Ionicons name={icon} size={20} color={active ? '#fff' : theme.text} />
    </Pressable>
  );
}

/** 지도 상단 네이티브 글래스 칩 버튼 (글래스 불가 시 밝은 솔리드 폴백). */
function GlassChip({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView style={styles.chip} glassEffectStyle="regular" isInteractive>
        <Pressable onPress={onPress} style={styles.chipFill}>
          {children}
        </Pressable>
      </GlassView>
    );
  }
  // 폴백: 칩 아이콘이 고정 어두운 색(항상 밝은 지도 위)이라 배경도 밝게 고정(다크모드에서 아이콘 사라짐 방지)
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.chipFill, styles.chipFallback, pressed && { opacity: 0.6 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  errBanner: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,235,238,0.95)' },
  errBannerText: { color: '#C62828', fontWeight: '600' },
  flex: { flex: 1 },
  topBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  routePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, height: 38, borderRadius: 19, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8 },
  routePillText: { fontWeight: '800' },
  floatCard: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 20,
    borderRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  moreBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gorhomBg: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  routeSheet: { position: 'absolute', left: 12, right: 12, zIndex: 9, borderRadius: 18, paddingTop: 14, paddingBottom: 8, maxHeight: 320, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20 },
  routeHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, marginBottom: 6 },
  routeTitle: { fontWeight: '800', fontSize: 16, flex: 1 },
  routeTotal: { fontWeight: '700' },
  routeStop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  routeNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routeNumText: { fontWeight: '800', fontSize: 12 },
  routeStopBody: { flex: 1, gap: 1 },
  routeStopTitle: { fontWeight: '700' },
  routeSeg: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 27, paddingVertical: 1 },
  routeSegLine: { width: 2, height: 14, borderRadius: 1, marginRight: 8 },
  routeEmpty: { paddingHorizontal: 16, paddingVertical: 18, alignItems: 'center', gap: 6 },
  optBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginHorizontal: 16, marginBottom: 4, paddingVertical: 8, borderRadius: 10 },
  excludeBtn: { padding: 2, marginLeft: 2 },
  excludedWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  excludedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  excludedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  routeNaviChip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 6 },
  routeNavi: { fontWeight: '700', fontSize: 11 },
  routeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextChip: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 },
  nextChipText: { fontSize: 10, fontWeight: '800' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { width: 42, height: 42, borderRadius: 21, overflow: 'visible' },
  chipFill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  chipFallback: { backgroundColor: 'rgba(255,255,255,0.92)' },
  fabCol: { position: 'absolute', right: 12, gap: 10 },
  fab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardBody: { gap: 10, paddingTop: 16, paddingBottom: 10, paddingHorizontal: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  triggerBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 10 },
  triggerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle: { marginBottom: 10, paddingHorizontal: 20 },
  results: { maxHeight: 360, marginTop: 4, paddingHorizontal: 20 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { textAlign: 'center', opacity: 0.5, paddingVertical: 24 },
  actionBtn: { marginTop: 6 },
});

