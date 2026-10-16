import { useEffect, useMemo, useRef, useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { font, tint } from '@expo/ui/swift-ui/modifiers';
import { type SFSymbol } from 'sf-symbols-typescript';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { CalendarHeader } from '@/features/calendar/CalendarHeader';
import {
  addDaysYmd,
  eventDays,
  parseYmd,
  shortDateLabel,
  ymd,
} from '@/features/calendar/calendarUtils';
import { useToday } from '@/features/calendar/useToday';
import { AgendaList, AGENDA_RANGE_DAYS } from '@/features/calendar/AgendaList';
import { EventCard } from '@/features/calendar/EventCard';
import { MonthList, type MonthListHandle } from '@/features/calendar/MonthList';
import { WeekTimeline } from '@/features/calendar/WeekTimeline';
import { ProjectScopeFilter } from '@/features/project/ProjectScopeFilter';
import { useProjects } from '@/features/project/queries';
import { useSettings } from '@/features/settings/queries';
import { useProjectFilter } from '@/shared/store/projectStore';
import { useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { updateTodoField, type Todo } from '@/features/todo/api';
import { todoKeys, useTodos } from '@/features/todo/queries';
import { toast } from '@/shared/ui/toast';
import { isRecurring } from '@/features/todo/todoFilters';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { Skeleton } from '@/shared/ui/Skeleton';
import { readableOn } from '@/shared/ui/tone';
import { shadow } from '@/shared/ui/tokens';
import { sheetBottomInset } from '@/shared/ui/sheetInset';
import { TopNav, useTopNavHeight } from '@/shared/ui/TopNav';

type CalView = 'month' | 'week' | 'day' | 'agenda';
const VIEW_OPTIONS: { value: CalView; label: string }[] = [
  { value: 'month', label: '월' },
  { value: 'week', label: '주' },
  { value: 'day', label: '일' },
  { value: 'agenda', label: '목록' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCREEN_H = Dimensions.get('window').height;

/** 드래그 가능한 바텀 시트 — 아래로 끌어내려 닫기 + 백드롭 페이드. (Modal/오버레이 내부에 렌더) */
function DaySheet({
  theme,
  insetBottom,
  onClose,
  children,
}: {
  theme: ReturnType<typeof useTheme>;
  insetBottom: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ty = useSharedValue(900);
  const [sheetH, setSheetH] = useState(900);

  /* eslint-disable react-hooks/immutability -- Reanimated shared value(.value)는 공식 API */
  useEffect(() => {
    ty.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [ty]);

  const dismiss = () => {
    ty.value = withTiming(sheetH, { duration: 220, easing: Easing.in(Easing.cubic) }, (f) => {
      if (f) runOnJS(onClose)();
    });
  };

  const pan = Gesture.Pan()
    .activeOffsetY(10) // 아래로 끌 때만 시트 제스처 (위로는 내부 스크롤로 통과)
    .failOffsetY(-10)
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        ty.value = withTiming(sheetH, { duration: 200 }, (f) => {
          if (f) runOnJS(onClose)();
        });
      } else {
        ty.value = withTiming(0, { duration: 160 });
      }
    });
  /* eslint-enable react-hooks/immutability */

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: sheetH > 0 ? 1 - ty.value / sheetH : 1 }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedPressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} onPress={dismiss} />
      <GestureDetector gesture={pan}>
        <Animated.View
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
          style={[styles.daySheet, { backgroundColor: theme.surface, paddingBottom: sheetBottomInset(insetBottom) }, sheetStyle, shadow.float]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** 좌우 스와이프로 이전/다음 이동 (화살표 버튼 대체 — 네이티브·기존 앱과 동일) */
function SwipeNav({
  onPrev,
  onNext,
  style,
  children,
}: {
  onPrev: () => void;
  onNext: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15]) // 가로 우세 제스처만 활성 — 세로 스크롤/탭은 통과
    .onEnd((e) => {
      if (e.translationX <= -60) {
        runOnJS(onNext)();
        runOnJS(tickHaptic)();
      } else if (e.translationX >= 60) {
        runOnJS(onPrev)();
        runOnJS(tickHaptic)();
      }
    });
  return (
    <GestureDetector gesture={pan}>
      <View style={style}>{children}</View>
    </GestureDetector>
  );
}

/** 월 그리드 로딩 스켈레톤 — 요일 헤더 + 6주 x 7일 펄스 셀 */
function MonthSkeleton() {
  return (
    <View style={styles.skelWrap}>
      <View style={styles.skelRow}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} style={styles.skelDow} />
        ))}
      </View>
      {Array.from({ length: 6 }, (_, r) => (
        <View key={r} style={styles.skelRow}>
          {Array.from({ length: 7 }, (_, c) => (
            <Skeleton key={c} style={styles.skelCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const VIEW_SYMBOL: Record<CalView, SFSymbol> = {
  month: 'calendar',
  week: 'calendar.day.timeline.left',
  day: 'calendar.circle',
  agenda: 'list.bullet',
};

/** 뷰 전환 — 네이티브 SwiftUI 메뉴(@expo/ui). 트리거는 아이콘만. 탭 → OS UIMenu로 월/주/일, 현재 항목엔 체크마크. */
function ViewMenu({ value, onChange }: { value: CalView; onChange: (v: CalView) => void }) {
  const theme = useTheme();
  return (
    <Host matchContents>
      <Menu label="" systemImage={VIEW_SYMBOL[value]} modifiers={[tint(theme.text), font({ size: 21 })]}>
        {VIEW_OPTIONS.map((o) => (
          <Button
            key={o.value}
            label={o.label}
            systemImage={o.value === value ? 'checkmark' : VIEW_SYMBOL[o.value]}
            onPress={() => onChange(o.value)}
          />
        ))}
      </Menu>
    </Host>
  );
}

export default function CalendarScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navH = useTopNavHeight();
  const { data: todos, isLoading, refetch, isError } = useTodos();
  const { data: settings } = useSettings();
  // 당김새로고침 — 다른 탭과 동일 (스피너는 사용자 제스처에만)
  const [pulling, setPulling] = useState(false);
  const onPullRefresh = async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  };

  // 자정을 넘기면 스스로 갱신되는 오늘 — 켜둔 채 날이 바뀌어도 '오늘' 강조가 어제에 남지 않는다
  const today = useToday();
  const [selected, setSelected] = useState(today);
  // 월 뷰에 표시 중인 달 — 항상 그 달 1일(페이저 month 배열과 키가 맞아야 함)
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const t = new Date();
    return ymd(new Date(t.getFullYear(), t.getMonth(), 1));
  });
  const [showOnlyRecurring, setShowOnlyRecurring] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsMounted, setFsMounted] = useState(false); // 이탈 애니메이션을 위해 모달을 잠시 유지
  const [daySheetOpen, setDaySheetOpen] = useState(false); // 날짜 탭 → 그날 일정 시트(일반)
  const [fsSheetOpen, setFsSheetOpen] = useState(false); // 풀스크린 중 날짜 탭 → 그날 일정 오버레이

  const monthListRef = useRef<MonthListHandle>(null);
  const fsMonthListRef = useRef<MonthListHandle>(null);
  // 인라인 캘린더 영역 rect — 풀스크린이 "그 자리에서 늘어나는" 모프의 시작 프레임
  const bodyRef = useRef<View>(null);
  const fsRectY = useSharedValue(0);
  const fsRectH = useSharedValue(SCREEN_H);

  // 풀스크린 진입/이탈 — 불투명+스케일 동기로 "그 자리에서 확대/축소"되듯 (slide·깜빡임 X)
  const fsAnim = useSharedValue(0);
  useEffect(() => {
    if (fullscreen) {
      fsAnim.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
      return;
    }
    fsAnim.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
    const id = setTimeout(() => setFsMounted(false), 210);
    return () => clearTimeout(id);
  }, [fullscreen, fsAnim]);
  // 인라인 영역(rect) → 전체화면 세로 모프. 폭은 이미 동일하므로 scaleY+translateY만으로
  // "작은 캘린더가 그대로 늘어나 전체화면이 되는" 연출 (닫을 땐 역방향으로 원위치에 수렴)
  const fsAnimStyle = useAnimatedStyle(() => {
    const p = fsAnim.value;
    const sy0 = Math.max(0.3, Math.min(1, fsRectH.value / SCREEN_H));
    const ty0 = fsRectY.value - (SCREEN_H - SCREEN_H * sy0) / 2; // top-origin 보정(RN 변환 원점=중앙)
    return {
      opacity: p === 0 ? 0 : 1, // 시작 전/종료 후 프레임만 숨김 — 전환 중엔 페이드 없이 순수 확장
      transform: [{ translateY: (1 - p) * ty0 }, { scaleY: sy0 + (1 - sy0) * p }],
    };
  });

  const openFullscreen = () => {
    const start = () => {
      setFsMounted(true);
      setFullscreen(true);
      // 풀스크린 리스트를 현재 보던 달로 동기화 (독립 인스턴스라 initialScrollIndex=오늘로 열림)
      setTimeout(() => fsMonthListRef.current?.scrollToMonth(monthAnchor), 60);
    };
    // 현재 인라인 캘린더 영역을 측정해 시작 프레임으로 사용 (실패 시 기본값으로 그냥 열기)
    if (bodyRef.current) {
      bodyRef.current.measureInWindow((_x, y, _w, h) => {
        if (h > 0) {
          fsRectY.value = y;
          fsRectH.value = h;
        }
        start();
      });
    } else {
      start();
    }
  };

  const [viewState, setView] = useState<CalView | null>(null);
  const view = viewState ?? ((settings?.calendarDefaultView as CalView) || 'month');
  const weekStartsOn: 0 | 1 = settings?.weekStartDay === 'mon' ? 1 : 0;

  // 프로젝트 스코프(전체/인박스/프로젝트) — 할 일 탭과 동일한 글로벌 필터 공유 (웹 ScopeFilterChip 대응)
  const activeProjectId = useProjectFilter((s) => s.activeProjectId);
  const setActiveProject = useProjectFilter((s) => s.setActive);
  const { data: projects } = useProjects();

  const byDate = useMemo(() => {
    const map: Record<string, Todo[]> = {};
    for (const t of todos ?? []) {
      // 반복 필터 — 원본(hasRecurrence)과 생성된 인스턴스(recurrenceSourceId) 모두 포함
      if (showOnlyRecurring && !isRecurring(t)) continue;
      if (activeProjectId != null && (activeProjectId === 'inbox' ? t.projectId != null : t.projectId !== activeProjectId)) continue;
      // 걸치는 날짜 전부에 넣는다 — 하루에만 넣으면 기간 있는 일이 마감일에만 보인다(웹과 동일 규칙)
      for (const day of eventDays(t.startAt, t.dueDate)) (map[day] ??= []).push(t);
    }
    // 하루 안의 순서 = 종일(시간 없음) 먼저 → 시작 시간순 (동시각은 id 오름차순으로 안정화).
    // 정렬하지 않으면 서버가 주는 순서(id 내림차순=생성 역순)가 그대로 노출돼, 날짜 시트와
    // 월 그리드 점이 "최근에 만든 일정 먼저"로 보였다. 목록 뷰(AgendaList)의 규칙과 통일한다.
    for (const list of Object.values(map)) {
      list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || (a.id ?? 0) - (b.id ?? 0));
    }
    return map;
  }, [todos, showOnlyRecurring, activeProjectId]);


  const dayTodos = byDate[selected] ?? [];
  const anchor = parseYmd(monthAnchor);
  const sel = parseYmd(selected);

  // ── 네비게이션 (뷰별) ──
  const firstOfTodayMonth = ymd(new Date(parseYmd(today).getFullYear(), parseYmd(today).getMonth(), 1));
  const monthIsToday = monthAnchor === firstOfTodayMonth && selected === today;

  // 페이저가 보고하는 현재 달로 헤더 라벨 갱신
  const setVisibleMonth = (newAnchor: string) => {
    if (newAnchor !== monthAnchor) setMonthAnchor(newAnchor);
  };
  const goTodayMonth = () => {
    setMonthAnchor(firstOfTodayMonth);
    setSelected(today);
    monthListRef.current?.scrollToMonth(firstOfTodayMonth);
    fsMonthListRef.current?.scrollToMonth(firstOfTodayMonth);
  };
  // 주/일/목록 뷰의 이전/다음 (스와이프) — 주는 ±7일, 일은 ±1일, 목록은 ±30일(웹 agenda 범위 단위)
  const viewStep = view === 'week' ? 7 : view === 'agenda' ? AGENDA_RANGE_DAYS : 1;
  const dayPrev = () => setSelected(addDaysYmd(selected, -viewStep));
  const dayNext = () => setSelected(addDaysYmd(selected, viewStep));

  const headerProps =
    view === 'month'
      ? { year: anchor.getFullYear(), month: anchor.getMonth(), isToday: monthIsToday, onToday: goTodayMonth }
      : { year: sel.getFullYear(), month: sel.getMonth(), isToday: selected === today, onToday: () => setSelected(today) };

  const viewMenu = <ViewMenu value={view} onChange={setView} />;
  const expandBtn = (
    <Pressable
      onPress={openFullscreen}
      hitSlop={6}
      accessibilityLabel="캘린더 전체화면"
      accessibilityRole="button"
      style={styles.iconBtn}>
      <Feather name="maximize-2" size={17} color={theme.textSecondary} />
    </Pressable>
  );
  const contractBtn = (
    <Pressable
      onPress={() => {
        setFullscreen(false);
        setFsSheetOpen(false);
        // 인라인 리스트를 풀스크린에서 보던 달로 동기화
        setTimeout(() => monthListRef.current?.scrollToMonth(monthAnchor), 60);
      }}
      hitSlop={6}
      accessibilityLabel="전체화면 닫기"
      accessibilityRole="button"
      style={styles.iconBtn}>
      <Feather name="minimize-2" size={17} color={theme.textSecondary} />
    </Pressable>
  );
  // 풀스크린 Modal이 떠 있는 채로 router.push하면 네이티브 Modal이 위에 남아 새 화면을 덮고,
  // 돌아왔을 때 달력(Modal)이 터치를 먹는다 → 화면 이동 직전에 풀스크린/시트를 즉시(애니메이션 없이) 닫는다.
  const closeFsForNav = () => {
    setDaySheetOpen(false);
    setFsSheetOpen(false);
    if (fsMounted) {
      setFullscreen(false);
      setFsMounted(false);
    }
  };

  const quickAdd = () => {
    closeFsForNav();
    router.push({ pathname: '/todo/new', params: { dueDate: selected } });
  };

  // iOS 캘린더식 상단 "+" (FAB 대체) — 선택한 날짜에 빠른 추가
  const addBtn = (
    <Pressable onPress={() => quickAdd()} hitSlop={6} style={styles.iconBtn} accessibilityLabel="할 일 추가" accessibilityRole="button">
      <Ionicons name="add" size={24} color={theme.text} />
    </Pressable>
  );
  // 월 뷰는 세로 리스트가 ±4년의 한가운데(오늘 달)에서 시작한다 → 스크롤 위치가 이미 2만 px이라
  // 상단의 RefreshControl(당겨서 새로고침)에 닿으려면 4년을 거슬러 올라가야 해 사실상 못 쓴다.
  // 그래서 월 뷰에서만 헤더에 명시적 새로고침 버튼을 둔다(주·일·목록 뷰는 당김이 정상 동작).
  const refreshBtn =
    view === 'month' ? (
      <Pressable
        onPress={() => void onPullRefresh()}
        disabled={pulling}
        hitSlop={6}
        style={styles.iconBtn}
        accessibilityLabel="일정 새로고침"
        accessibilityState={{ disabled: pulling, busy: pulling }}
        accessibilityRole="button">
        {pulling ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <Ionicons name="refresh" size={19} color={theme.textSecondary} />
        )}
      </Pressable>
    ) : null;

  const headerTrailing = (
    <View style={styles.headerActions}>
      {refreshBtn}
      {addBtn}
      {expandBtn}
    </View>
  );
  const fsHeaderTrailing = (
    <View style={styles.headerActions}>
      {refreshBtn}
      {addBtn}
      {contractBtn}
    </View>
  );

  // 주 뷰 롱프레스 드래그 → 그 시간 범위로 일정 생성 (제목 입력)
  const createSlot = (dayYmd: string, startTime: string, endTime: string) => {
    closeFsForNav();
    router.push({ pathname: '/todo/new', params: { dueDate: dayYmd, startTime, endTime } });
  };

  // 기존 이벤트 롱프레스 드래그 이동 — 웹 onEventDrop과 동일하게 4필드 패치 + 낙관 반영
  const qc = useQueryClient();
  const moveEvent = async (todoId: number, dayYmd: string, startTime: string, endTime: string) => {
    const patch = { startAt: dayYmd, dueDate: dayYmd, startTime, endTime };
    const prev = qc.getQueryData<Todo[]>(todoKeys.all);
    const prevDetail = qc.getQueryData<Todo>(todoKeys.detail(todoId));
    // 목록+상세 캐시 모두 즉시 패치 — 이동 직후 상세에 들어가도 새 시간이 바로 보이게
    qc.setQueryData<Todo[]>(todoKeys.all, (list) => list?.map((t) => (t.id === todoId ? { ...t, ...patch } : t)));
    if (prevDetail) qc.setQueryData<Todo>(todoKeys.detail(todoId), { ...prevDetail, ...patch });
    try {
      // **반드시 순차**로 보낸다 (웹 useCalendarData.onEventDrop과 동일).
      // PATCH /api/todos/{id}는 필드 1개만 받고(body {field,value}), 서버는 @Transactional
      // read-modify-commit인데 Todo 엔티티에 @DynamicUpdate·@Version이 없어 매번 전체 컬럼을
      // UPDATE한다. 병렬로 4개를 던지면 각 요청이 커밋 전 스냅샷에서 출발해 서로를 덮어써
      // 마지막 커밋의 필드 하나만 남는다(4개 다 200이라 실패로도 안 보인다).
      await updateTodoField(todoId, 'startAt', dayYmd);
      await updateTodoField(todoId, 'dueDate', dayYmd);
      await updateTodoField(todoId, 'startTime', startTime);
      await updateTodoField(todoId, 'endTime', endTime);
    } catch (e) {
      if (prev) qc.setQueryData(todoKeys.all, prev);
      if (prevDetail) qc.setQueryData(todoKeys.detail(todoId), prevDetail);
      toast.error(getApiErrorMessage(e));
    } finally {
      qc.invalidateQueries({ queryKey: todoKeys.all });
      // useUpdateTodoField onSettled 미러 — 대시보드·활동 로그·프로젝트 활동 피드도 갱신
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['todo', todoId, 'logs'] });
      qc.invalidateQueries({ queryKey: ['project-activity'] });
    }
  };

  // '반복만' 필터는 모든 뷰(byDate)에 걸리는데 토글은 월 뷰 날짜 시트 안에만 있었다.
  // 주·일·목록 뷰에서는 이유도 모른 채 빈 그리드만 보이고 끌 방법이 없었다 →
  // 켜져 있는 동안엔 어느 뷰에서든 헤더 아래에 해제 배너를 띄운다. (일반/풀스크린 공용)
  const recurringBanner = showOnlyRecurring ? (
    <Pressable
      onPress={() => setShowOnlyRecurring(false)}
      accessibilityRole="button"
      accessibilityLabel="반복만 필터 해제"
      style={[styles.filterBanner, { backgroundColor: theme.primary + '14' }]}>
      <Ionicons name="repeat" size={13} color={theme.primary} />
      <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
        반복 일정만 보는 중 — 탭해서 해제
      </ThemedText>
      <Ionicons name="close-circle" size={14} color={theme.primary} />
    </Pressable>
  ) : null;

  // 풀스크린(크게 보기)에는 상단 프로젝트 스코프 필터(ProjectScopeFilter)가 없다. 그런데 byDate에는
  // 스코프가 그대로 걸려 있어서, 프로젝트를 고른 채 크게 보기로 들어가면 "일정이 통째로 사라진 달"
  // 처럼 보였다(웹 MobileMonthView가 scopeChip을 넘기는 것도 같은 '조용한 필터링 방지' 목적).
  // 필터 시트를 모달 위에 또 띄우는 대신, 무엇이 걸려 있는지 알리고 탭하면 전체로 되돌린다.
  const activeProjectName =
    activeProjectId === 'inbox' ? '인박스' : (projects?.find((p) => p.id === activeProjectId)?.name ?? '프로젝트');
  const scopeBanner =
    activeProjectId != null ? (
      <Pressable
        onPress={() => setActiveProject(null)}
        accessibilityRole="button"
        accessibilityLabel="프로젝트 범위 해제 — 전체 일정 보기"
        style={[styles.filterBanner, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="funnel" size={12} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }} numberOfLines={1}>
          {activeProjectName} 일정만 보는 중 — 탭해서 전체 보기
        </ThemedText>
        <Ionicons name="close-circle" size={14} color={theme.textSecondary} />
      </Pressable>
    ) : null;

  // ── 선택일 일정 리스트 (바텀 패널 / 오버레이 공용) ──
  const eventList = (
    <>
      {dayTodos.length === 0 ? (
        <ThemedText type="default" style={[styles.empty, { color: theme.textSecondary }]}>
          {showOnlyRecurring ? '반복 일정이 없어요' : '이 날은 일정이 없어요'}
        </ThemedText>
      ) : (
        dayTodos.map((t) => (
          <EventCard
            key={t.id}
            todo={t}
            onPress={() => {
              if (t.id != null) {
                closeFsForNav();
                router.push(`/todo/${t.id}`);
              }
            }}
          />
        ))
      )}
    </>
  );

  // 선택일 일정 시트 내부 (일반 시트·풀스크린 오버레이 공용)
  const daySheetInner = (onClose: () => void) => (
    <>
      <View style={styles.grabberWrap}>
        <View style={[styles.grabber, { backgroundColor: theme.divider }]} />
      </View>
      <View style={styles.sheetHeader}>
        <View style={styles.sheetTitle}>
          <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="default" style={styles.sheetDate}>
            {shortDateLabel(selected)}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            일정 {dayTodos.length}개
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setShowOnlyRecurring((v) => !v)}
          style={[
            styles.recurChip,
            showOnlyRecurring
              ? { backgroundColor: theme.primary, borderColor: theme.primary }
              : { borderColor: theme.backgroundElement },
          ]}>
          <Ionicons name="repeat" size={13} color={showOnlyRecurring ? readableOn(theme.primary) : theme.textSecondary} />
          <ThemedText type="label" style={{ color: showOnlyRecurring ? readableOn(theme.primary) : theme.textSecondary }}>
            반복만
          </ThemedText>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
        {eventList}
        <Pressable style={[styles.fsAddBtn, { borderColor: theme.divider }]} onPress={() => { onClose(); quickAdd(); }}>
          <Ionicons name="add" size={16} color={theme.textSecondary} />
          <ThemedText type="label" style={{ color: theme.textSecondary }}>일정 추가</ThemedText>
        </Pressable>
      </ScrollView>
    </>
  );

  // 날짜 → 그날 전체 일정 시트 (월 그리드 셀 / 주·일 뷰 요일 헤더·종일 "+N" 공용).
  // 세로 캘린더는 각 달이 자기 날짜만 그리므로 탭은 항상 그 달 안 → 선택만 갱신(포커스 튐 없음)
  const openDaySheet = (fs: boolean) => (day: string) => {
    setSelected(day);
    if (fs) setFsSheetOpen(true);
    else setDaySheetOpen(true);
  };

  // ── 뷰 본문 (일반/풀스크린 공용) ──
  const renderBody = (fs: boolean) => {
    if (view === 'month') {
      // 첫 로드 — 빈 그리드 대신 가벼운 셀 스켈레톤으로 자리 잡기
      if (isLoading) return <MonthSkeleton />;
      return (
        <MonthList
          ref={fs ? fsMonthListRef : monthListRef}
          today={today}
          selected={selected}
          eventsByDate={byDate}
          weekStartsOn={weekStartsOn}
          onSelect={openDaySheet(fs)}
          onMonthChange={setVisibleMonth}
          bottomInset={fs ? insets.bottom : BottomTabInset + insets.bottom}
          refreshing={pulling}
          onRefresh={() => void onPullRefresh()}
        />
      );
    }
    const openTodo = (id: number) => {
      closeFsForNav();
      router.push(`/todo/${id}`);
    };
    // 목록(아젠다) — 선택일부터 30일 일정을 날짜 헤더로 묶은 플랫 리스트 (웹 '목록' 뷰 대응)
    if (view === 'agenda') {
      return (
        <SwipeNav onPrev={dayPrev} onNext={dayNext} style={styles.flex1}>
          <AgendaList
            start={selected}
            today={today}
            eventsByDate={byDate}
            onOpen={openTodo}
            bottomInset={fs ? insets.bottom : BottomTabInset + insets.bottom}
            refreshing={pulling}
            onRefresh={() => void onPullRefresh()}
            emptyText={showOnlyRecurring ? '반복 일정이 없어요' : '이 기간에 일정이 없어요'}
          />
        </SwipeNav>
      );
    }
    // 주(7일)·일(1일) 타임라인 — 세로선·현재시간선·롱프레스 드래그 생성
    return (
      <SwipeNav onPrev={dayPrev} onNext={dayNext} style={styles.flex1}>
        <WeekTimeline
          selected={selected}
          weekStartsOn={weekStartsOn}
          eventsByDate={byDate}
          today={today}
          onOpen={openTodo}
          onCreateSlot={createSlot}
          onMoveEvent={(id, d, st, en) => void moveEvent(id, d, st, en)}
          onOpenDay={openDaySheet(fs)}
          bottomInset={fs ? insets.bottom : BottomTabInset + insets.bottom}
          numDays={view === 'week' ? 7 : 1}
          refreshing={pulling}
          onRefresh={() => void onPullRefresh()}
        />
      </SwipeNav>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 캘린더는 월 라벨(CalendarHeader)이 네비 아래 고정되고 그 밑에서 그리드가 스크롤되는 구조라
          '피드가 네비 뒤로 스크롤'되지 않는다 → 떠 있는 글래스 크롬 + 솔리드 배경(페이드 없음). 콘텐츠는 navH만큼 내림. */}
      <View style={[styles.flex1, { paddingTop: navH }]}>
        {/* 로드 실패가 '일정 0개'로 위장되지 않게 — 배너로 알리고 탭하면 재시도 */}
        {isError ? (
          <Pressable
            onPress={() => refetch()}
            style={[styles.errBanner, { backgroundColor: theme.danger + '14' }]}
            accessibilityRole="button">
            <Ionicons name="cloud-offline-outline" size={14} color={theme.danger} />
            <ThemedText type="small" style={{ color: theme.danger, fontWeight: '600' }}>
              일정을 불러오지 못했어요 — 탭해서 다시 시도
            </ThemedText>
          </Pressable>
        ) : null}
        {/* 측정 대상은 풀스크린과 동일 구성(헤더+본문)만 — 필터는 풀스크린에 없어 모프 끝점이 어긋난다 */}
        <ProjectScopeFilter />
        <View ref={bodyRef} collapsable={false} style={styles.flex1}>
          <CalendarHeader {...headerProps} trailing={headerTrailing} />
          {recurringBanner}
          {renderBody(false)}
        </View>
      </View>
      <TopNav trailing={viewMenu} />

      {/* 풀스크린(크게 보기) — 전체화면 Modal로 상단 네비·탭바까지 덮어 몰입.
          Modal은 SafeAreaProvider 밖이라 inset이 0 → 노치 침범 방지로 paddingTop 수동 적용. */}
      <Modal visible={fsMounted} transparent animationType="none" onRequestClose={() => setFullscreen(false)}>
        {/* 하단 패딩 제거 — 달력이 화면 끝까지 차도록(하단도 달력 보임). 홈 인디케이터 여백은
            리스트 contentContainer 하단 패딩(bottomInset)으로 처리해 마지막 주가 인디케이터에 안 가리게. */}
        <Animated.View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }, fsAnimStyle]}>
          <CalendarHeader {...headerProps} trailing={fsHeaderTrailing} />
          {scopeBanner}
          {recurringBanner}
          {renderBody(true)}
          {/* 월 뿐 아니라 주·일 뷰에서도 (요일 헤더/종일 "+N" 탭으로) 날짜 시트를 연다 */}
          {fsSheetOpen ? (
            <DaySheet theme={theme} insetBottom={insets.bottom} onClose={() => setFsSheetOpen(false)}>
              {daySheetInner(() => setFsSheetOpen(false))}
            </DaySheet>
          ) : null}
        </Animated.View>
      </Modal>

      {/* 날짜 탭 시 올라오는 일정 시트 (일반 모드) — 드래그로 닫기 */}
      <Modal transparent visible={daySheetOpen} animationType="none" onRequestClose={() => setDaySheetOpen(false)}>
        <DaySheet theme={theme} insetBottom={insets.bottom} onClose={() => setDaySheetOpen(false)}>
          {daySheetInner(() => setDaySheetOpen(false))}
        </DaySheet>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  errBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginBottom: 6, paddingVertical: 7, borderRadius: 10 },
  filterBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginHorizontal: 16, marginBottom: 6, paddingVertical: 6, borderRadius: 10 },
  daySheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  grabberWrap: { paddingVertical: 10, alignItems: 'center' },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12 },
  sheetTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sheetDate: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  recurChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  sheetList: { paddingHorizontal: 14, paddingBottom: 24 },
  empty: { textAlign: 'center', paddingVertical: 40 },
  // overflow:visible — 롱프레스 시 리퀴드 글래스가 프레임 밖으로 늘어나도 잘리지 않게
  iconBtn: { width: 30, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fsAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 12, borderWidth: 1, borderRadius: 14, borderStyle: 'dashed' },
  // 월 그리드 스켈레톤
  skelWrap: { paddingHorizontal: 10, paddingTop: 8, gap: 8 },
  skelRow: { flexDirection: 'row', gap: 8 },
  skelDow: { flex: 1, height: 12, borderRadius: 4 },
  skelCell: { flex: 1, height: 64, borderRadius: 10 },
});
