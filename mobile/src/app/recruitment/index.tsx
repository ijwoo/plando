import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import type { RecruitmentListItem, RecruitmentTab } from '@/features/recruitment/api';
import {
  APPLICATION_STATUS_FILTERS,
  NEARBY_KM_OPTIONS,
  RECRUITMENT_FILTERS,
  RECRUITMENT_TABS,
  getCategory,
  type AppStatusFilter,
  type LocFilter,
} from '@/features/recruitment/config';
import { useRecruitments, useToggleBookmark } from '@/features/recruitment/queries';
import { RecruitMap } from '@/features/recruitment/RecruitMap';
import { distanceKm } from '@/features/map/travel';
import { getRecruitmentUnreadCount } from '@/features/notification/api';
import { getMyAccountMeta } from '@/features/settings/api';
import { useAuthStore } from '@/shared/store/authStore';
import { useTheme } from '@/hooks/use-theme';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { tickHaptic } from '@/shared/ui/haptics';
import { Press } from '@/shared/ui/Press';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { shadow } from '@/shared/ui/tokens';

const FEATURED_W = 0.88; // 웹 추천 카드 88% 폭

/** 팀 모집 목록 — 탭·검색·위치 필터·추천 캐러셀·지도 모드. 알림 딥링크 ?detail=<id>&tab=qa 호환. */
export default function RecruitmentListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { detail, tab: deepTab } = useLocalSearchParams<{ detail?: string; tab?: string }>();

  // 알림 딥링크 — 상세로 즉시 이동 (기존 WebView 시절 파라미터 계약 유지)
  useEffect(() => {
    if (detail) {
      router.push({ pathname: '/recruitment/[id]', params: { id: String(detail), ...(deepTab ? { tab: deepTab } : {}) } });
      router.setParams({ detail: undefined, tab: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 딥링크 1회 소비
  }, [detail]);

  const [tab, setTab] = useState<RecruitmentTab>('browse');
  const [query, setQuery] = useState('');
  const search = useDebounce(query, 300);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [locFilter, setLocFilter] = useState<LocFilter>('all');
  const [nearbyKm, setNearbyKm] = useState<number>(3);
  const [appStatus, setAppStatus] = useState<AppStatusFilter>('all');
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // 위치 실패 사유 — '내 근처'가 조용히 무력화되던 걸 화면에 드러내기 위한 상태
  const [locError, setLocError] = useState<'denied' | 'failed' | null>(null);

  const searchable = tab === 'browse';
  const { data, isLoading, isError, error, refetch, isRefetching } = useRecruitments(tab, searchable ? search : '');
  const bookmark = useToggleBookmark();

  // 게스트 차단 — 웹 GuestBlockModal 미러
  const { data: meta } = useQuery({ queryKey: ['users', 'me', 'meta'], queryFn: getMyAccountMeta });
  const signOut = useAuthStore((s) => s.signOut);
  const guestBlock = () => {
    Alert.alert(
      '회원 전용 기능이에요',
      '회원가입하고 팀을 찾아보세요.\n지원 신청, 북마크, 모집글 작성은\n회원만 이용할 수 있어요.',
      [
        { text: '닫기', style: 'cancel' },
        { text: '회원가입', onPress: () => void signOut() },
      ],
    );
  };

  // 팀모집 알림 벨 — 미읽음 배지
  const { data: notifUnread } = useQuery({
    queryKey: ['notifications', 'recruitment', 'unread'],
    queryFn: getRecruitmentUnreadCount,
    staleTime: 30_000,
  });

  /* 위치 권한 거부/실패를 삼키면 '내 근처'가 아무 일도 안 하는 필터가 되고, 화면은 "Nkm 이내"라고
     거짓 표기한다. 사유를 상태로 남겨 안내 줄을 띄우고, 반경 표기는 myLoc이 있을 때만 한다. */
  const requestLocation = async () => {
    if (myLoc || locating) return;
    setLocating(true);
    setLocError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setLocError('failed');
    } finally {
      setLocating(false);
    }
  };

  // 안내 줄 탭 — 권한 거부는 앱 설정으로, 그 외(일시적 실패)는 재시도
  const onLocNoticePress = () => {
    if (locError === 'denied') {
      void Linking.openSettings();
      return;
    }
    void requestLocation();
  };

  const onTabChange = (t: RecruitmentTab) => {
    setTab(t);
    if (t !== 'browse') setMode('list');
    setLocFilter('all');
    setAppStatus('all');
  };

  // 클라이언트 필터 — 웹 useRecruitmentFilter 미러
  const filtered = useMemo(() => {
    let list = data ?? [];
    if (tab === 'applied') {
      // 서버는 취소된 지원을 appliedStatus 맵에서 아예 제외하므로 값이 **null**로 내려온다.
      // 'CANCELLED' 문자열만 걸러내면 취소한 지원이 '내 신청'에 계속 남는다(웹은 truthy부터 확인).
      list = list.filter((i) => !!i.appliedStatus && i.appliedStatus !== 'CANCELLED');
      if (appStatus !== 'all') list = list.filter((i) => i.appliedStatus?.toLowerCase() === appStatus);
    }
    if ((tab === 'browse' || tab === 'bookmarked') && locFilter !== 'all') {
      if (locFilter === 'online') list = list.filter((i) => !i.hasLocation);
      else if (locFilter === 'offline') list = list.filter((i) => !!i.hasLocation);
      else if (locFilter === 'nearby') {
        // 내 위치가 없으면 거리 계산이 불가능하다 → 오프라인 모집만 남기고, 반경 표기는 하지 않는다
        list = list.filter((i) => i.hasLocation && i.locationLat != null && i.locationLng != null);
        if (myLoc) list = list.filter((i) => distanceKm(myLoc.lat, myLoc.lng, i.locationLat!, i.locationLng!) <= nearbyKm);
      }
    }
    return list;
  }, [data, tab, appStatus, locFilter, myLoc, nearbyKm]);

  // 추천 = 필터 결과 상위 2 (웹과 동일, 포지셔널)
  const featured = tab === 'browse' && mode === 'list' ? filtered.slice(0, Math.min(2, filtered.length)) : [];
  const feed = tab === 'browse' && mode === 'list' ? filtered.slice(featured.length) : filtered;

  const openDetail = (id: number) => router.push(`/recruitment/${id}`);
  const [scrolled, setScrolled] = useState(false);
  // 게스트 가드는 이 함수 하나로만 통과시킨다 — 빈 상태 버튼이 router.push를 직접 부르며 우회했었다
  const onCreate = () => {
    if (meta?.guest) return guestBlock();
    router.push('/recruitment/new');
  };
  const onBookmark = (item: RecruitmentListItem) => {
    if (item.id == null) return;
    if (meta?.guest) return guestBlock();
    tickHaptic();
    bookmark.mutate(item.id);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '팀 모집',
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/notifications')}
              hitSlop={8}
              accessibilityLabel="팀 모집 알림"
              accessibilityRole="button">
              <View>
                <Ionicons name="notifications-outline" size={21} color={theme.text} />
                {notifUnread ? (
                  <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                    <ThemedText type="small" style={styles.badgeText}>
                      {notifUnread > 99 ? '99+' : notifUnread}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ),
        }}
      />

      {/* 탭 — 언더라인 스타일 (웹 모바일 탭 미러) */}
      <View style={[styles.tabRow, { borderBottomColor: theme.divider }]}>
        {RECRUITMENT_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Press
              key={t.id}
              onPress={() => onTabChange(t.id)}
              scale={1}
              pressedStyle={{ opacity: 0.6 }}
              style={styles.tabItem}>
              <ThemedText
                type="default"
                style={[styles.tabLabel, { color: active ? theme.primary : theme.textTertiary, fontWeight: active ? '800' : '600' }]}>
                {t.label}
              </ThemedText>
              <View style={[styles.tabUnderline, { backgroundColor: active ? theme.primary : 'transparent' }]} />
            </Press>
          );
        })}
      </View>

      {/* 검색 + 보기 토글 — 둘러보기에서만 */}
      {tab === 'browse' ? (
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, styles.flex1, { backgroundColor: theme.surfaceSelected }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="프로젝트, 스택, 역할 검색..."
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="검색어 지우기" accessibilityRole="button">
                <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.viewToggle, { backgroundColor: theme.surfaceSelected }]}>
            {(['list', 'map'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  tickHaptic();
                  setMode(m);
                  if (m === 'map') {
                    void requestLocation();
                    // 온라인 모집은 위치가 없어 지도에 뜨지 않음 — 지도 모드에선 무의미하므로 해제
                    if (locFilter === 'online') setLocFilter('all');
                  }
                }}
                accessibilityLabel={m === 'list' ? '목록 보기' : '지도 보기'}
                style={[styles.viewBtn, mode === m && { backgroundColor: theme.surface }]}>
                <Ionicons name={m === 'list' ? 'list' : 'map-outline'} size={16} color={mode === m ? theme.primary : theme.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* 위치 필터 (둘러보기·북마크) */}
      {tab === 'browse' || tab === 'bookmarked' ? (
        <View style={styles.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {RECRUITMENT_FILTERS.filter((f) => !(mode === 'map' && f.id === 'online')).map((f) => {
              const active = locFilter === f.id;
              const label = f.id === 'nearby' && locating ? '위치 확인 중...' : f.label;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    tickHaptic();
                    setLocFilter(f.id);
                    if (f.id === 'nearby') void requestLocation();
                  }}
                  style={[styles.filterChip, active && { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="small" style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: active ? '800' : '600' }}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
            {locFilter === 'nearby' ? (
              // 내 위치가 없으면 반경 선택이 아무 효과도 없다 → 흐리게 + 비활성 (무반응 버튼 금지)
              <View style={[styles.kmSegment, { backgroundColor: theme.surfaceSelected, opacity: myLoc ? 1 : 0.4 }]}>
                {NEARBY_KM_OPTIONS.map((km) => {
                  const active = nearbyKm === km;
                  return (
                    <Pressable
                      key={km}
                      disabled={!myLoc}
                      onPress={() => {
                        tickHaptic();
                        setNearbyKm(km);
                      }}
                      style={[styles.kmItem, active && { backgroundColor: theme.surface }]}>
                      <ThemedText type="small" style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: '700', fontSize: 12 }}>
                        {km}km
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          {/* 위치를 못 얻어 거리 필터가 빠진 상태를 명시 — 예전엔 조용히 무시하고 "3km 이내"라고 적었다 */}
          {locFilter === 'nearby' && !myLoc && !locating ? (
            <Pressable
              onPress={onLocNoticePress}
              accessibilityRole="button"
              accessibilityLabel="위치 권한 다시 시도"
              style={[styles.locNotice, { backgroundColor: theme.orange + '14' }]}>
              <Ionicons name="location-outline" size={13} color={theme.orange} />
              <ThemedText type="small" style={[styles.flex1, { color: theme.orange }]}>
                {locError === 'denied'
                  ? '위치 권한이 꺼져 있어 거리순으로 좁히지 못했어요 — 탭해서 설정 열기'
                  : '현재 위치를 가져오지 못해 오프라인 모집 전체를 보여주고 있어요 — 탭해서 다시 시도'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* 내 신청 상태 필터 */}
      {tab === 'applied' ? (
        <View style={styles.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {APPLICATION_STATUS_FILTERS.map((f) => {
              const active = appStatus === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    tickHaptic();
                    setAppStatus(f.id);
                  }}
                  style={[styles.filterChip, active && { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="small" style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: active ? '800' : '600' }}>
                    {f.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {isLoading ? (
        <SkeletonList rows={6} lines={2} />
      ) : isError ? (
        <View style={styles.center}>
          <ThemedText type="default" style={{ color: theme.danger }}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : tab === 'browse' && mode === 'map' ? (
        <RecruitMap
          items={filtered}
          myLoc={myLoc}
          radiusKm={locFilter === 'nearby' && myLoc ? nearbyKm : null}
          onDetail={openDetail}
          onCreate={onCreate}
        />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 24)}
          scrollEventThrottle={32}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListHeaderComponent={
            featured.length ? (
              <View style={styles.featuredWrap}>
                <View style={styles.featuredHead}>
                  <View style={[styles.accentBar, { backgroundColor: theme.primary }]} />
                  <ThemedText type="small" style={[styles.featuredLabel, { color: theme.textSecondary }]}>
                    추천 모집
                  </ThemedText>
                </View>
                <FlatList
                  horizontal
                  data={featured}
                  keyExtractor={(r) => `f-${r.id}`}
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={width * FEATURED_W + 10}
                  decelerationRate="fast"
                  contentContainerStyle={styles.featuredList}
                  renderItem={({ item }) => (
                    <View style={{ width: width * FEATURED_W }}>
                      <RecruitmentCard
                        item={item}
                        mineTab={false}
                        featured
                        theme={theme}
                        onPress={() => item.id != null && openDetail(item.id)}
                        onBookmark={() => onBookmark(item)}
                      />
                    </View>
                  )}
                />
                {feed.length === 0 ? (
                  <ThemedText type="small" style={[styles.featuredNote, { color: theme.textTertiary }]}>
                    추천 모집에 전체 결과가 표시되었어요.
                  </ThemedText>
                ) : null}
                <View style={styles.countLine}>
                  <ThemedText type="small" style={{ color: theme.textTertiary }}>
                    {/* 반경 표기는 실제로 거리 필터가 걸렸을 때(myLoc 있음)만 — 아니면 거짓말이 된다 */}
                    전체 {filtered.length}개{locFilter === 'nearby' && myLoc ? ` · ${nearbyKm}km 이내` : ''}
                  </ThemedText>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={featured.length ? null : <EmptyState tab={tab} search={search} filtered={(data?.length ?? 0) > 0} theme={theme} onBrowse={() => onTabChange('browse')} onCreate={onCreate} />}
          renderItem={({ item }) => (
            <RecruitmentCard
              item={item}
              mineTab={tab === 'mine'}
              theme={theme}
              onPress={() => item.id != null && openDetail(item.id)}
              onBookmark={() => onBookmark(item)}
            />
          )}
        />
      )}

      {/* 작성 FAB — 목록 모드 전용 (지도 모드는 시트 위 자체 FAB). 스크롤 시 아이콘만 (웹 CreateFab 미러) */}
      {mode === 'list' || tab !== 'browse' ? (
        <Pressable
          onPress={() => {
            tickHaptic();
            onCreate();
          }}
          accessibilityLabel="모집 만들기"
          accessibilityRole="button"
          style={[styles.fab, { backgroundColor: theme.primary, bottom: 24 }, scrolled && styles.fabCollapsed]}>
          <Ionicons name="add" size={20} color="#fff" />
          {!scrolled ? (
            <ThemedText type="small" style={styles.fabLabel}>
              모집 만들기
            </ThemedText>
          ) : null}
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function EmptyState({
  tab,
  search,
  filtered,
  theme,
  onBrowse,
  onCreate,
}: {
  tab: RecruitmentTab;
  search: string;
  filtered: boolean;
  theme: ReturnType<typeof useTheme>;
  onBrowse: () => void;
  onCreate: () => void;
}) {
  // 웹 빈 상태 문구 미러 (filtered = 원본은 있는데 필터로 비었는지)
  const cfg =
    tab === 'browse'
      ? { icon: '🔍', title: search || filtered ? '검색 결과가 없어요' : '아직 모집 글이 없어요', sub: '다른 키워드나 필터로 다시 찾아보세요.' }
      : tab === 'applied'
        ? filtered
          ? { icon: '🔍', title: '해당 상태의 신청이 없어요', sub: '다른 필터를 선택해보세요.' }
          : { icon: '📬', title: '신청한 모집이 없어요', sub: '관심 있는 팀에 지원해보세요!', action: { label: '팀 둘러보기', onPress: onBrowse } }
        : tab === 'mine'
          ? { icon: '📝', title: '만든 모집글이 없어요', sub: '팀원을 찾고 있다면 모집글을 올려보세요!', action: { label: '+ 모집글 올리기', onPress: onCreate } }
          : filtered
            ? { icon: '🔍', title: '검색 결과가 없어요', sub: '다른 필터를 선택해보세요.' }
            : { icon: '🔖', title: '북마크한 모집이 없어요', sub: '관심 있는 모집글에 북마크를 눌러 저장해 보세요.', action: { label: '팀 둘러보기', onPress: onBrowse } };
  return (
    <View style={styles.empty}>
      <ThemedText type="title">{cfg.icon}</ThemedText>
      <ThemedText type="default" style={styles.emptyTitle}>
        {cfg.title}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textTertiary }}>
        {cfg.sub}
      </ThemedText>
      {cfg.action ? (
        <Pressable onPress={cfg.action.onPress} style={[styles.emptyBtn, { backgroundColor: theme.primarySoft }]}>
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
            {cfg.action.label}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function RecruitmentCard({
  item,
  mineTab,
  featured,
  theme,
  onPress,
  onBookmark,
}: {
  item: RecruitmentListItem;
  mineTab: boolean;
  featured?: boolean;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
  onBookmark: () => void;
}) {
  const closed = item.statusLabel && item.statusLabel !== '모집중';
  const cat = getCategory(item.typeLabel);
  return (
    <Press
      onPress={onPress}
      scale={0.985}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: featured ? cat.color + '66' : theme.border },
        !theme.isDark && shadow.card,
      ]}>
      <View style={styles.cardHead}>
        {item.typeLabel ? (
          <View style={[styles.chip, { backgroundColor: cat.color + '1A' }]}>
            <ThemedText type="small" style={[styles.chipText, { color: cat.color }]}>
              {cat.icon} {item.typeLabel}
            </ThemedText>
          </View>
        ) : null}
        {item.statusLabel ? (
          <View style={[styles.chip, { backgroundColor: closed ? theme.surfaceSelected : theme.green + '1A' }]}>
            <ThemedText type="small" style={[styles.chipText, { color: closed ? theme.textSecondary : theme.green }]}>
              {item.statusLabel}
            </ThemedText>
          </View>
        ) : null}
        {item.appliedStatus === 'PENDING' || item.appliedStatus === 'ACCEPTED' || item.appliedStatus === 'REJECTED' ? (
          <View
            style={[
              styles.chip,
              {
                backgroundColor:
                  (item.appliedStatus === 'ACCEPTED' ? theme.green : item.appliedStatus === 'REJECTED' ? theme.danger : theme.orange) + '1A',
              },
            ]}>
            <ThemedText
              type="small"
              style={[
                styles.chipText,
                { color: item.appliedStatus === 'ACCEPTED' ? theme.green : item.appliedStatus === 'REJECTED' ? theme.danger : theme.orange },
              ]}>
              {item.appliedStatus === 'ACCEPTED' ? '수락됨' : item.appliedStatus === 'REJECTED' ? '거절됨' : '대기 중'}
            </ThemedText>
          </View>
        ) : null}
        {mineTab && (item.unansweredCount ?? 0) > 0 ? (
          <View style={[styles.chip, { backgroundColor: theme.danger + '1A' }]}>
            <ThemedText type="small" style={[styles.chipText, { color: theme.danger }]}>
              답변 대기 {item.unansweredCount}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.flex1} />
        <Pressable onPress={onBookmark} hitSlop={10} accessibilityLabel={item.bookmarked ? '북마크 해제' : '북마크'} accessibilityRole="button">
          <Ionicons name={item.bookmarked ? 'bookmark' : 'bookmark-outline'} size={19} color={item.bookmarked ? theme.primary : theme.textTertiary} />
        </Pressable>
      </View>

      <ThemedText type="default" style={styles.cardTitle} numberOfLines={1}>
        {item.title}
      </ThemedText>
      {item.summary ? (
        <ThemedText type="small" style={[styles.cardSummary, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.summary}
        </ThemedText>
      ) : null}

      {item.roles?.length ? (
        <View style={styles.roleRow}>
          {item.roles.slice(0, 3).map((r, i) => (
            <View key={`${r}-${i}`} style={[styles.roleChip, { backgroundColor: theme.surfaceAlt }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>
                {r}
              </ThemedText>
            </View>
          ))}
          {item.roles.length > 3 ? (
            <ThemedText type="small" style={{ color: theme.textTertiary }}>
              +{item.roles.length - 3}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metaRow}>
        {item.dueText ? (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={theme.textTertiary} />
            <ThemedText type="small" style={{ color: theme.textTertiary }}>
              {item.dueText}
            </ThemedText>
          </View>
        ) : null}
        {item.members ? (
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={theme.textTertiary} />
            <ThemedText type="small" style={{ color: theme.textTertiary }}>
              {item.members}
            </ThemedText>
          </View>
        ) : null}
        {item.locationText ? (
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color={theme.textTertiary} />
            <ThemedText type="small" style={{ color: theme.textTertiary }} numberOfLines={1}>
              {item.locationText}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  flex1: { flex: 1 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  tabItem: { paddingHorizontal: 12, paddingTop: 10, alignItems: 'center', gap: 7 },
  tabLabel: { fontSize: 15, letterSpacing: -0.2 },
  tabUnderline: { alignSelf: 'stretch', height: 2.5, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  viewToggle: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 2 },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  filterWrap: { marginTop: 10 },
  filterRow: { paddingHorizontal: 16, gap: 7, alignItems: 'center' },
  filterChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  kmSegment: { flexDirection: 'row', borderRadius: 9, padding: 2.5, gap: 2 },
  kmItem: { paddingHorizontal: 10, paddingVertical: 4.5, borderRadius: 7 },
  locNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 12 },
  list: { padding: 16, gap: 10, paddingBottom: 90 },
  featuredWrap: { gap: 8, marginBottom: 4 },
  featuredHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accentBar: { width: 3, height: 12, borderRadius: 2 },
  featuredLabel: { fontWeight: '800', letterSpacing: 0.4 },
  featuredList: { gap: 10, paddingRight: 16 },
  featuredNote: { textAlign: 'center', paddingVertical: 4 },
  countLine: { paddingTop: 2 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 70 },
  emptyTitle: { fontWeight: '800' },
  emptyBtn: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 7 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontWeight: '700', fontSize: 11 },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  cardSummary: { lineHeight: 19 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  roleChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabLabel: { color: '#fff', fontWeight: '800' },
  fabCollapsed: { width: 48, paddingHorizontal: 0, justifyContent: 'center' },
});
