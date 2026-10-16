import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Dimensions, Keyboard, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset } from '@/constants/theme';
import { AiCaptureCard } from '@/features/chat/AiCaptureCard';
import { BriefingCard } from '@/features/dashboard/BriefingCard';
import { useRecentActivity } from '@/features/dashboard/queries';
import { useRooms } from '@/features/dm/queries';
import { useUnreadCount } from '@/features/notification/queries';
import { useProjects } from '@/features/project/queries';
import { projectIcon } from '@/features/project/projectIcons';
import { useTodos } from '@/features/todo/queries';
import { isTodoDone } from '@/features/status/queries';
import { useTheme } from '@/hooks/use-theme';
import { EmailVerifyBanner } from '@/features/auth/EmailVerifyBanner';
import { useMe } from '@/features/auth/queries';
import { useSettings } from '@/features/settings/queries';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { useMyWorkspaces } from '@/features/workspace/queries';
import { WorkspaceSwitcher } from '@/features/workspace/WorkspaceSwitcher';
import { BlurBackdrop } from '@/shared/ui/BlurBackdrop';
import { Avatar, colorFromName, secureUrl } from '@/shared/ui/Avatar';
import { readableOn } from '@/shared/ui/tone';
import { shadow } from '@/shared/ui/tokens';
import { Press } from '@/shared/ui/Press';
import { useTabRetap } from '@/shared/ui/tabRetap';
import { tickHaptic } from '@/shared/ui/haptics';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { toDateString } from '@/shared/utils/datetime';
import { homeCounts } from '@/features/todo/todoFilters';

/** ClickUp 라이트 홈 — 데이터 있는 부분 실연결, 나머지는 정리. */
const EXPANDED_H = 142;
const COLLAPSED_H = 50;
const COLLAPSE_AT = 110;
const SEARCH_H = 52;
const SCREEN_H = Dimensions.get('window').height;

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    // 홈에 보이는 데이터만 갱신 — 전체 캐시 무효화(모든 화면 refetch 폭주) 방지
    await Promise.all(
      [['todos'], ['projects'], ['dm'], ['dashboard'], ['notifications'], ['workspaces']].map((key) =>
        qc.invalidateQueries({ queryKey: key }),
      ),
    );
    setRefreshing(false);
  };

  const activeId = useWorkspaceStore((s) => s.activeId);
  const wsReady = useWorkspaceStore((s) => s.ready);
  const { data: workspaces } = useMyWorkspaces();
  // 내 이메일은 서버(useMe) 기준 — authStore.user는 로그인 세션에서만 채워지고
  // 앱 재시작 후엔 null이라 '할당됨' 카운트가 0으로 고정되는 버그가 있었다 (할일 탭과 동일 소스)
  const { data: me } = useMe();
  const { data: mySettings } = useSettings();
  const { data: todos } = useTodos();
  const { data: projects } = useProjects();
  const { data: rooms } = useRooms();
  const { data: activity } = useRecentActivity();
  const { data: unread } = useUnreadCount();

  const ws = workspaces?.find((w) => w.workspaceId === activeId) ?? workspaces?.[0];
  const wsName = ws?.workspaceName ?? '워크스페이스';
  const wsIconUrl = ws?.iconImageUrl;

  // 오늘/지연/할당 카운트 + 프로젝트별 할 일
  const { todayCount, doneTodayCount, doneAllCount, weekCount, overdueCount, assignedCount, byProject, inboxTodos, subByParent, nextEvent } = useMemo(() => {
    const nowD = new Date();
    const t = toDateString(nowD);
    const hhmm = `${String(nowD.getHours()).padStart(2, '0')}:${String(nowD.getMinutes()).padStart(2, '0')}`;
    // 할 일 탭과 같은 기준(구간 겹침·doneAt)으로 센다 — 단일 소스
    const c = homeCounts(todos ?? [], t);
    let assigned = 0;
    // '완료' 칩이 여는 화면은 /todo?tab=done = 완료 **전체**다. 오늘 완료분만 세면
    // 눌러 들어간 목록 개수와 칩 숫자가 안 맞는다 → 칩은 전체, 오늘분은 부제로.
    let doneAll = 0;
    let next: { title: string; time: string } | null = null;
    const proj: Record<number, typeof todos> = {};
    const inbox: NonNullable<typeof todos> = [];
    const openItems: NonNullable<typeof todos> = [];
    for (const x of todos ?? []) {
      const open = !isTodoDone(x);
      // 오늘·이번 주·지연·오늘 완료 카운트는 아래 homeCounts로 일원화했다 —
      // 여기서 따로 세면 할 일 탭과 숫자가 어긋난다(기간 있는 일 누락 등).
      if (open && x.assignees?.some((a) => a.email && a.email === me?.email)) assigned++;
      // 다음 일정 — 오늘 시작(startAt)이고 시작 시간이 아직 안 지난 것 중 가장 이른 것
      if (open && x.startAt === t && x.startTime && x.startTime >= hhmm && x.title) {
        if (!next || x.startTime < next.time) next = { title: x.title, time: x.startTime.slice(0, 5) };
      }
      if (!open) {
        doneAll++;
        continue; // 트리/인박스에는 진행 중인 항목만 (완료는 아카이브·완료 탭에서)
      }
      openItems.push(x);
    }
    // 서브태스크는 부모 아래 3단계로 — 부모가 트리에 없으면(완료 등) 최상위 폴백
    const openIds = new Set(openItems.map((x) => x.id));
    const subs: Record<number, typeof todos> = {};
    for (const x of openItems) {
      if (x.parentId != null && openIds.has(x.parentId)) {
        (subs[x.parentId] ??= [] as typeof todos)!.push(x);
        continue;
      }
      if (x.projectId != null) (proj[x.projectId] ??= [] as typeof todos)!.push(x);
      else inbox.push(x);
    }
    return { todayCount: c.today, doneTodayCount: c.doneToday, doneAllCount: doneAll, weekCount: c.week, overdueCount: c.overdue, assignedCount: assigned, byProject: proj, inboxTodos: inbox, subByParent: subs, nextEvent: next };
  }, [todos, me?.email]);

  // 최근 항목 — 같은 할 일의 상태 변경이 여러 번 기록돼 중복되므로 todoId 기준 첫(최신) 1건만
  const recents = useMemo(() => {
    const seen = new Set<number>();
    const out: NonNullable<typeof activity> = [];
    for (const a of activity ?? []) {
      if (a.todoId == null || seen.has(a.todoId)) continue;
      seen.add(a.todoId);
      out.push(a);
      if (out.length >= 6) break;
    }
    return out;
  }, [activity]);

  const [spacesOpen, setSpacesOpen] = useState(true);
  const [dmOpen, setDmOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [openProj, setOpenProj] = useState<Record<number, boolean>>({});
  const [openSubs, setOpenSubs] = useState<Record<number, boolean>>({}); // 홈 트리 서브태스크 펼침
  // 섹션/트리 접기·펼치기 — 햅틱 + 자연스러운 높이 전환
  // 섹션 토글 — 햅틱 후 상태 변경(즉시 펼침/접힘)
  const animToggle = (fn: () => void, _expanding?: boolean, _sectionId?: string) => {
    tickHaptic();
    fn();
  };
  const [wsSwitcher, setWsSwitcher] = useState(false);

  const scrollRef = useRef<Animated.ScrollView>(null);
  useTabRetap('index', () => scrollRef.current?.scrollTo({ y: 0, animated: true }));

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const filterBoxStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 38, COLLAPSE_AT], [EXPANDED_H, EXPANDED_H - SEARCH_H, COLLAPSED_H], Extrapolation.CLAMP),
  }));
  const searchStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 32], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 38], [0, -16], Extrapolation.CLAMP) }],
  }));
  const cardsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [44, 92], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 38, COLLAPSE_AT], [0, -SEARCH_H, -SEARCH_H - 18], Extrapolation.CLAMP) }],
  }));
  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [72, COLLAPSE_AT], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [72, COLLAPSE_AT], [8, 0], Extrapolation.CLAMP) }],
  }));
  // 접히면(칩 상태) AI 바 상단 여백을 좁힌다
  const aiBarStyle = useAnimatedStyle(() => ({
    paddingTop: interpolate(scrollY.value, [0, COLLAPSE_AT], [10, 4], Extrapolation.CLAMP),
  }));
  // 상단 오버레이(헤더+필터+AI바) 높이 — 콘텐츠가 그 아래에서 시작해 '뒤로' 스크롤되게 패딩
  const [overlayH, setOverlayH] = useState(0);
  // 스크롤하면 콘텐츠가 오버레이 뒤를 지나며 네이티브 블러가 비쳐 보인다 (토스 스타일)
  const blurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 44], [0, 1], Extrapolation.CLAMP),
  }));
  // 검색 버튼은 필터가 접힐 때 헤더에 등장 (글래스 유지 위해 opacity 대신 mount 토글)
  const [searchVisible, setSearchVisible] = useState(false);
  // 접히면 AI 입력이 상단에서 내려와 하단 네비 위에 도킹 — 같은 임계값 공유
  const docked = searchVisible;
  // 독을 옆으로 접기 — 접으면 우측 하단 ✨ 버튼만 남는다
  const [dockFolded, setDockFolded] = useState(false);
  // 하단 독 입력이 키보드에 가리지 않게 키보드 높이 추적
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useAnimatedReaction(
    () => scrollY.value > COLLAPSE_AT * 0.7,
    (now, prev) => {
      if (now !== prev) runOnJS(setSearchVisible)(now);
    },
  );

  // 홈 트리의 할 일 행 — 원형(완료 토글 오인) 대신 플레인 리스트. 서브태스크는 3단계 접이식.
  const renderTreeTodo = (c: NonNullable<typeof todos>[number], ci: number) => {
    const kids = c.id != null ? (subByParent[c.id] ?? []) : [];
    const opened = c.id != null && !!openSubs[c.id];
    return (
      <View key={c.id}>
        <Row
          label={c.title ?? '할 일'}
          suffix={kids.length ? `${kids.length}` : undefined}
          depth={2}
          expandable={kids.length > 0}
          open={opened}
          onToggle={() => {
            if (c.id == null) return;
            tickHaptic();
            setOpenSubs((mm) => ({ ...mm, [c.id as number]: !mm[c.id as number] }));
          }}
          onPress={() => c.id != null && router.push(`/todo/${c.id}`)}
          theme={theme}
        />
        {/* 3단계는 즉시 표출 — 중첩 높이 애니가 재측정과 겹쳐 버벅여서 애니 없이 (클릭업도 동일) */}
        {kids.length && opened ? (
          <View style={styles.treeChildren}>
            <View style={[styles.treeLine, styles.treeLine3, { backgroundColor: theme.divider }]} pointerEvents="none" />
            {kids.map((k) => (
              <Row
                key={k.id}
                label={k.title ?? '서브태스크'}
                depth={3}
                onPress={() => k.id != null && router.push(`/todo/${k.id}`)}
                theme={theme}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  // 라이트: 회색 캔버스 위에 흰 라운드 카드가 그림자로 떠서 '서비스 앱' 위계를 만든다.
  // 다크: bg≈surface(차콜)라 full-bleed가 정답 → 카드/그림자 없이 그대로.
  const sectionCard = theme.isDark
    ? { backgroundColor: theme.surface }
    : { backgroundColor: theme.surface, marginHorizontal: 12, borderRadius: 18, ...shadow.card };

  return (
    // 다른 탭과 동일한 연회색 캔버스 — 검색바·필터 카드가 흰 카드로 떠서 위계를 만든다
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 상단 오버레이 — 콘텐츠가 이 뒤로 스크롤되며 블러로 비친다 */}
      <View
        style={styles.topOverlay}
        pointerEvents="box-none"
        onLayout={(e) => {
          // 최초(펼침) 높이만 사용 — 스크롤 접힘으로 줄어든 높이가 패딩을 흔들지 않게
          const h = e.nativeEvent.layout.height;
          setOverlayH((prev) => (prev === 0 ? h : prev));
        }}>
      <Animated.View style={[styles.blurFill, blurStyle]} pointerEvents="none">
        <BlurBackdrop tint="systemUltraThinMaterial" intensity={55} />
      </Animated.View>
      {/* 헤더 — 워크스페이스 + 프로필 */}
      {/* TopNav와 동일 리듬(safe top + 11 / 하단 7) — 탭 전환 시 헤더 높이가 튀지 않게 */}
      <View style={[styles.header, { paddingTop: insets.top + 11 }]}>
        <Pressable style={styles.wsChip} hitSlop={6} onPress={() => setWsSwitcher(true)}>
          {wsIconUrl ? (
            <Image source={{ uri: secureUrl(wsIconUrl) }} style={styles.wsIcon} contentFit="cover" />
          ) : (
            <View style={[styles.wsIcon, { backgroundColor: colorFromName(wsName) }]}>
              <ThemedText style={styles.wsIconText}>{wsName.slice(0, 1)}</ThemedText>
            </View>
          )}
          <ThemedText type="title" style={styles.wsName} numberOfLines={1}>
            {wsName}
          </ThemedText>
          <Ionicons name="chevron-down" size={18} color={theme.text} />
        </Pressable>
        <View style={styles.headerActions}>
          {/* 검색 — 필터 접힐 때 등장 / 알림 — 항상 */}
          {searchVisible ? (
            <GlassIconButton icon="search" size={21} onPress={() => router.push('/search')} theme={theme} label="검색" />
          ) : null}
          <View>
            <GlassIconButton icon="notifications-outline" size={22} onPress={() => router.push('/notifications')} theme={theme} label="알림" />
            {unread && unread > 0 ? (
              <View pointerEvents="none" style={[styles.notiBadge, { backgroundColor: theme.danger, borderColor: theme.background }]}>
                <ThemedText type="small" style={styles.notiBadgeText}>
                  {unread > 99 ? '99+' : unread}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* 필터 영역 */}
      <Animated.View style={[styles.filterBox, filterBoxStyle]}>
        {/* 검색바·스탯카드·미니칩은 같은 filterBox 안에 겹쳐 놓여 있고 opacity 로만 교차한다.
            opacity:0 인 뷰도 터치는 그대로 먹으므로 pointerEvents 를 접힘 상태와 함께 뒤집어야 한다 —
            안 그러면 펼침 상태에서 검색바를 눌러도 그 위에 투명하게 얹힌 미니칩(오늘)이 먼저 먹어
            엉뚱하게 할 일 탭으로 튀었다. */}
        <Animated.View style={[styles.searchAnim, searchStyle]} pointerEvents={searchVisible ? 'none' : 'box-none'}>
          <View style={styles.searchRow}>
            <Pressable style={[styles.searchBar, { backgroundColor: theme.surfaceSelected }]} onPress={() => router.push('/search')}>
              <Ionicons name="search" size={18} color={theme.textSecondary} />
              <ThemedText type="default" style={{ color: theme.textSecondary }}>
                검색
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View style={[styles.cardsAnim, cardsStyle]} pointerEvents={searchVisible ? 'none' : 'box-none'}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterCards}>
            <FilterCard icon="calendar" tint={theme.primary} label="오늘" value={String(todayCount)} sub={overdueCount ? `지연 ${overdueCount}` : ''} subColor={theme.danger} active theme={theme} onPress={() => router.push('/todo?tab=today&my=0')} />
            <FilterCard icon="calendar-number" tint={theme.purple} label="이번 주" value={String(weekCount)} sub="7일 내" theme={theme} onPress={() => router.push('/todo?tab=week&my=0')} />
            <FilterCard icon="person" tint={theme.orange} label="할당됨" value={String(assignedCount)} sub="내 작업" theme={theme} onPress={() => router.push('/todo?tab=all&my=1')} />
            <FilterCard icon="checkmark-done" tint={theme.green} label="완료" value={String(doneAllCount)} sub={doneTodayCount ? `오늘 ${doneTodayCount}` : ''} theme={theme} onPress={() => router.push('/todo?tab=done&my=0')} />
            <FilterCard icon="notifications" tint={theme.danger} label="알림" value={String(unread ?? 0)} sub="" theme={theme} onPress={() => router.push('/notifications')} />
          </ScrollView>
        </Animated.View>

        <Animated.View style={[styles.miniBar, miniStyle]} pointerEvents={searchVisible ? 'box-none' : 'none'}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniBarScroll}>
            <MiniPill icon="calendar-outline" label="오늘" count={`${todayCount}${overdueCount ? ` · ${overdueCount}` : ''}`} active theme={theme} onPress={() => router.push('/todo?tab=today&my=0')} />
            <MiniPill icon="calendar-number-outline" label="이번 주" count={String(weekCount)} theme={theme} onPress={() => router.push('/todo?tab=week&my=0')} />
            <MiniPill icon="person-outline" label="할당됨" count={String(assignedCount)} theme={theme} onPress={() => router.push('/todo?tab=all&my=1')} />
            <MiniPill icon="checkmark-done-outline" label="완료" count={String(doneAllCount)} theme={theme} onPress={() => router.push('/todo?tab=done&my=0')} />
            <MiniPill icon="notifications-outline" label="알림" count={String(unread ?? 0)} theme={theme} onPress={() => router.push('/notifications')} />
          </ScrollView>
        </Animated.View>
      </Animated.View>

      {/* AI 빠른 추가 — 펼침 상태에선 상단, 접히면 하단 독으로 이동 */}
      {!docked ? (
        <Animated.View style={[styles.aiBar, aiBarStyle]} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
          <AiCaptureCard compact />
        </Animated.View>
      ) : null}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        // 콘텐츠가 짧아도 필터가 끝까지 접히도록 최소 높이 확보(접힘 거리 + 여유)
        contentContainerStyle={{ minHeight: SCREEN_H + COLLAPSE_AT, paddingTop: overlayH || insets.top + 58 + EXPANDED_H + 82, paddingBottom: BottomTabInset + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        {/* 이메일 미인증 안내 — 인증되면(소셜 로그인 포함) 아무것도 렌더하지 않음 */}
        <EmailVerifyBanner style={styles.verifyBanner} />
        {/* 브리핑 — 시간대 인사 + 오늘 요약 + 진행률 링 (1단계: 로컬 조합) */}
        {todos !== undefined && !(wsReady && activeId == null) ? (
          <BriefingCard
            name={mySettings?.displayName ?? undefined}
            todayOpen={todayCount}
            todayDone={doneTodayCount}
            overdue={overdueCount}
            next={nextEvent}
            onPressToday={() => router.push('/todo?tab=today&my=0')}
          />
        ) : null}
        {/* 첫 로드 — 빈 화면 대신 트리 스켈레톤 (워크스페이스 미확정 동안만) */}
        {todos === undefined && !(wsReady && activeId == null) ? <SkeletonList rows={9} avatar={24} lines={1} /> : null}
        {/* 워크스페이스가 하나도 없는 계정 — 스켈레톤 대신 생성 안내 */}
        {wsReady && activeId == null ? (
          <Press
            onPress={() => router.push('/workspaces')}
            style={[styles.emptyCta, { borderColor: theme.primary, marginTop: 24 }]}
            scale={1}
            pressedStyle={{ opacity: 0.6 }}>
            <Ionicons name="add" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
              워크스페이스를 만들어 시작하세요
            </ThemedText>
          </Press>
        ) : null}
        {/* 최근 항목 */}
        {recents.length ? (
          <View style={[styles.sectionFull, sectionCard]}>
            <SectionHeader label="최근 항목" theme={theme} open={recentsOpen} onToggle={() => animToggle(() => setRecentsOpen((v) => !v), !recentsOpen, 'recents')} />
            <Collapsible open={recentsOpen}>
              <View>
              {recents.map((a, i) => (
                  <Row
                    key={`${a.todoId}-${i}`}
                    // 최근 '활동' 목록 — 완료 토글로 오인되던 원형(빈 체크박스) 대신 시계 아이콘.
                    // 완료 항목은 초록 틴트로만 구분.
                    icon="time-outline"
                    iconColor={a.afterValue === 'DONE' ? theme.green : theme.textTertiary}
                    label={a.todoTitle ?? '항목'}
                    depth={1}
                    onPress={() => a.todoId != null && router.push(`/todo/${a.todoId}`)}
                    theme={theme}
                  />
              ))}
              </View>
            </Collapsible>
          </View>
        ) : null}

        {/* 프로젝트 트리 */}
        {todos !== undefined ? (
        <View style={[styles.sectionFull, sectionCard]}>
        <SectionHeader label="프로젝트" theme={theme} onAdd onAddPress={() => router.push('/projects')} open={spacesOpen} onToggle={() => animToggle(() => setSpacesOpen((v) => !v), !spacesOpen, 'spaces')} />
        <Collapsible open={spacesOpen}>
          <View>
            <Row icon="apps" iconColor={theme.textTertiary} label="전체 할 일" depth={1} onPress={() => router.push('/todo')} theme={theme} />
            <Row
              icon="file-tray-outline"
              iconColor={theme.textTertiary}
              label="인박스"
              suffix={inboxTodos.length ? `${inboxTodos.length}` : undefined}
              depth={1}
              expandable={inboxTodos.length > 0}
              open={inboxOpen}
              onToggle={() => animToggle(() => setInboxOpen((v) => !v), !inboxOpen, 'inbox')}
              onOpen={() => animToggle(() => setInboxOpen((v) => !v), !inboxOpen, 'inbox')}
              theme={theme}
            />
            <Collapsible open={inboxOpen && inboxTodos.length > 0}>
              <View style={styles.treeChildren}>
                <View style={[styles.treeLine, { backgroundColor: theme.divider }]} pointerEvents="none" />
                {inboxTodos.map((c, ci) => renderTreeTodo(c, ci))}
              </View>
            </Collapsible>
            {projects?.length ? (
              projects.map((p) => {
                const pid = p.id as number;
                const open = !!openProj[pid];
                const children = (byProject[pid] ?? []) as NonNullable<typeof todos>;
                return (
                  <View key={pid}>
                    <Row
                      badgeIcon={projectIcon(p.icon)}
                      badgeColor={p.color ?? theme.textTertiary}
                      label={p.name ?? '프로젝트'}
                      depth={1}
                      expandable={children.length > 0}
                      open={open}
                      onToggle={() => animToggle(() => setOpenProj((m) => ({ ...m, [pid]: !m[pid] })), !open, `proj-${pid}`)}
                      onOpen={() => router.push(`/project/${pid}`)}
                      theme={theme}
                    />
                    <Collapsible open={open && children.length > 0}>
                      <View style={styles.treeChildren}>
                        <View style={[styles.treeLine, { backgroundColor: theme.divider }]} pointerEvents="none" />
                        {children.map((c, ci) => renderTreeTodo(c, ci))}
                      </View>
                    </Collapsible>
                  </View>
                );
              })
            ) : (
              <Press
                onPress={() => router.push('/projects')}
                style={[styles.emptyCta, { borderColor: theme.divider }]}
                scale={1}
                pressedStyle={{ backgroundColor: theme.surfaceSelected }}>
                <Ionicons name="add" size={16} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                  프로젝트 만들기
                </ThemedText>
              </Press>
            )}
          </View>
        </Collapsible>
        </View>
        ) : null}

        {/* 다이렉트 메시지 */}
        {rooms?.length ? (
          <View style={[styles.sectionFull, sectionCard]}>
            <SectionHeader label="다이렉트 메시지" theme={theme} onAdd onAddPress={() => router.push('/dm/new')} open={dmOpen} onToggle={() => animToggle(() => setDmOpen((v) => !v), !dmOpen, 'dm')} />
            <Collapsible open={dmOpen}>
              <View>
              {rooms.slice(0, 8).map((r, ri) => {
                  const name = r.isGroup ? (r.groupName ?? '그룹') : (r.partnerName ?? '대화');
                  return (
                    <Row
                      key={r.id}
                      avatar={{ name, profileImageUrl: r.isGroup ? r.groupImageUrl : r.partnerProfileImageUrl }}
                      label={name}
                      depth={1}
                      badgeCount={r.unreadCount ?? 0}
                      onPress={() => router.push(`/dm/${r.id}?title=${encodeURIComponent(name)}`)}
                      theme={theme}
                    />
                  );
              })}
              </View>
            </Collapsible>
          </View>
        ) : null}
      </Animated.ScrollView>

      {/* AI 빠른 추가 — 접힘 상태: 하단 네비에 거의 붙는 플로팅 독. 옆으로 접으면 ✨ 버튼만 */}
      {docked && !dockFolded ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(160)}
          style={[styles.aiDock, { bottom: kb > 0 ? kb + 10 : insets.bottom + 12 }, !theme.isDark && shadow.float]}>
          <View style={styles.aiDockRow}>
            <View style={styles.flex1}>
              <AiCaptureCard compact />
            </View>
            <Pressable
              onPress={() => setDockFolded(true)}
              hitSlop={8}
              accessibilityLabel="AI 입력 접기"
              accessibilityRole="button"
              style={[styles.dockFoldBtn, { backgroundColor: theme.surface, borderColor: theme.inputBorder }]}>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {docked && dockFolded ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[styles.aiFab, { bottom: insets.bottom + 12 }, !theme.isDark && shadow.float]}>
          <Pressable
            onPress={() => setDockFolded(false)}
            accessibilityLabel="AI 입력 펼치기"
            accessibilityRole="button"
            style={[styles.aiFabInner, { backgroundColor: theme.surface, borderColor: theme.inputBorder }]}>
            <Ionicons name="sparkles" size={19} color={theme.primary} />
          </Pressable>
        </Animated.View>
      ) : null}

      <WorkspaceSwitcher open={wsSwitcher} onClose={() => setWsSwitcher(false)} />
    </View>
  );
}

/**
 * 트리 아코디언 — 열리면 즉시 표시, 닫히면 언마운트. 높이 애니메이션·측정을 쓰지 않아
 * 중첩 확장이 잘리거나 애니가 중복 재생되는 문제가 없다(dev/릴리즈/실기기 동일 동작).
 */
function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return open ? <>{children}</> : null;
}

function GlassIconButton({
  icon,
  size,
  onPress,
  theme,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  label?: string;
}) {
  if (isLiquidGlassAvailable()) {
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

function MiniPill({
  icon,
  label,
  count,
  active,
  onPress,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: string;
  active?: boolean;
  onPress?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  // 다크모드 primary는 밝은 파랑 — 흰 글자 대비가 무너져 readableOn으로 결정
  const fg = active ? readableOn(theme.primary) : theme.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniPill,
        { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? 'transparent' : theme.border },
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name={icon} size={13} color={fg} />
      <ThemedText type="small" style={{ color: fg, fontWeight: '700' }}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={{ color: active ? 'rgba(255,255,255,0.8)' : theme.textSecondary }}>
        {count}
      </ThemedText>
    </Pressable>
  );
}

function FilterCard({
  label,
  value,
  sub,
  subColor,
  icon,
  tint,
  active,
  onPress,
  theme,
}: {
  label: string;
  value: string;
  sub: string;
  subColor?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  active?: boolean;
  onPress?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  // ClickUp풍 스탯 타일 — 흰 카드가 회색 캔버스 위로 떠(그림자) + 컬러 아이콘 칩.
  // 다크에선 그림자 대신 surfaceAlt로 구분.
  return (
    <Press
      onPress={onPress}
      style={[
        styles.filterCard,
        theme.isDark
          ? { backgroundColor: active ? theme.primarySoft : theme.surfaceAlt }
          : { backgroundColor: active ? theme.primarySoft : theme.surface, ...shadow.card },
      ]}>
      <View style={styles.fcTop}>
        <View style={[styles.fcIcon, { backgroundColor: tint }]}>
          <Ionicons name={icon} size={15} color="#fff" />
        </View>
        <ThemedText type="default" style={[styles.fcValue, { color: active ? theme.primary : theme.text }]}>
          {value}
        </ThemedText>
      </View>
      <View style={styles.fcMeta}>
        <ThemedText type="small" style={[styles.fcLabel, { color: active ? theme.primary : theme.textSecondary }]}>
          {label}
        </ThemedText>
        {sub ? (
          <ThemedText type="small" style={{ color: subColor ?? theme.textTertiary }}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
    </Press>
  );
}

function SectionHeader({
  label,
  theme,
  onAdd,
  onAddPress,
  chevron,
  open,
  onToggle,
}: {
  label: string;
  theme: ReturnType<typeof useTheme>;
  onAdd?: boolean;
  onAddPress?: () => void;
  chevron?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <Pressable style={styles.sectionHeader} onPress={onToggle} disabled={!onToggle}>
      <ThemedText type="default" style={styles.sectionLabel}>
        {label}
      </ThemedText>
      <View style={styles.sectionActions}>
        {onAdd ? (
          <Pressable onPress={onAddPress} hitSlop={8} accessibilityLabel={`${label} 추가`} accessibilityRole="button">
            <Ionicons name="add" size={22} color={theme.textSecondary} />
          </Pressable>
        ) : null}
        {onToggle ? (
          <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.textSecondary} />
        ) : chevron ? (
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        ) : null}
      </View>
    </Pressable>
  );
}

function Row({
  icon,
  iconColor,
  badge,
  badgeIcon,
  badgeColor,
  avatar,
  label,
  suffix,
  depth,
  expandable,
  open,
  onToggle,
  onOpen,
  onPress,
  badgeCount,
  theme,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  badge?: string;
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  badgeColor?: string;
  avatar?: { name?: string; profileImageUrl?: string };
  label: string;
  suffix?: string;
  depth: number;
  expandable?: boolean;
  open?: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
  onPress?: () => void;
  badgeCount?: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const inner = (
    <Press
      style={[styles.row, { paddingLeft: 16 + (depth - 1) * 18 }]}
      pressedStyle={{ backgroundColor: theme.surfaceSelected }}
      scale={1}
      onPress={onOpen ?? onPress}>
      {avatar ? (
        <Avatar person={avatar} size={26} />
      ) : badgeIcon ? (
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Ionicons name={badgeIcon} size={13} color="#fff" />
        </View>
      ) : badge ? (
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <ThemedText style={styles.badgeText}>{badge}</ThemedText>
        </View>
      ) : icon ? (
        <Ionicons name={icon} size={18} color={iconColor} style={styles.rowIcon} />
      ) : null}
      <ThemedText type="default" numberOfLines={1} style={styles.rowLabel}>
        {label}
        {suffix ? <ThemedText type="small" style={{ color: theme.textSecondary }}>{`  ${suffix}`}</ThemedText> : null}
      </ThemedText>
      {badgeCount ? (
        <View style={[styles.unread, { backgroundColor: theme.primary }]}>
          <ThemedText style={[styles.unreadText, { color: readableOn(theme.primary) }]}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </ThemedText>
        </View>
      ) : null}
      {expandable ? (
        <Pressable onPress={onToggle} hitSlop={10} accessibilityLabel={open ? '접기' : '펼치기'}>
          <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={17} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </Press>
  );
  return inner;
}

const styles = StyleSheet.create({
  verifyBanner: { marginHorizontal: 12, marginBottom: 12 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  collapsible: { overflow: 'hidden' },
  aiDock: { position: 'absolute', left: 16, right: 16, zIndex: 20 },
  aiDockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex1: { flex: 1 },
  dockFoldBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  aiFab: { position: 'absolute', right: 16, zIndex: 20 },
  aiFabInner: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  blurFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  container: { flex: 1 },
  aiBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 7 },
  wsChip: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  wsIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  wsIconText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  wsName: { fontSize: 19, fontWeight: '800', flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notiBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  notiBadgeText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'visible' },
  iconBtnFill: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  filterBox: { overflow: 'hidden' },
  searchAnim: { position: 'absolute', top: 0, left: 0, right: 0 },
  cardsAnim: { position: 'absolute', top: SEARCH_H, left: 0, right: 0 },
  miniBar: { position: 'absolute', top: 9, left: 0, right: 0 },
  miniBarScroll: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  miniPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: 12, paddingHorizontal: 12 },
  filterCards: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  filterCard: { minWidth: 118, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, gap: 5, justifyContent: 'center' },
  fcTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fcIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fcMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  fcLabel: { fontWeight: '700' },
  fcValue: { fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  empty: { paddingHorizontal: 16, paddingVertical: 10 },
  sectionFull: { paddingTop: 4, paddingBottom: 12, marginBottom: 10 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginHorizontal: 12, marginVertical: 8, paddingVertical: 11, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionLabel: { fontWeight: '800', fontSize: 19, letterSpacing: -0.3 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  treeChildren: { position: 'relative' },
  treeLine: { position: 'absolute', left: 26, top: 0, bottom: 12, width: StyleSheet.hairlineWidth },
  treeLine3: { left: 44 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 16, paddingVertical: 10 },
  rowIcon: { width: 22, textAlign: 'center' },
  badge: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  rowLabel: { flex: 1 },
  unread: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontSize: 10, fontWeight: '700' },
});
