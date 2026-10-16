import { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Host } from '@expo/ui/swift-ui';
import { font, tint } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { markRead, type DmRoom } from '@/features/dm/api';
import { dmKeys, usePendingSuggestionCounts, useRooms } from '@/features/dm/queries';
import { RoomRow } from '@/features/dm/RoomRow';
import { toast } from '@/shared/ui/toast';
import { useSearch } from '@/features/search/queries';
import { BottomTabInset } from '@/constants/theme';
import { Avatar } from '@/shared/ui/Avatar';
import { Press } from '@/shared/ui/Press';
import { useTabRetap } from '@/shared/ui/tabRetap';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { TopNav, useTopNavScroll } from '@/shared/ui/TopNav';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useTheme } from '@/hooks/use-theme';

export default function DmListScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { data: rooms, isLoading, isError, error, refetch } = useRooms();
  // 방별 대기 중 AI 할 일 제안 수 — 행에 ✨ 뱃지
  const { data: suggestionCounts } = usePendingSuggestionCounts();

  // 당김 새로고침 스피너는 사용자 제스처에만 반응.
  // (isRefetching을 그대로 바인딩하면 탭 진입 시의 포커스 refetch가 RefreshControl을
  //  프로그램적으로 열어 목록이 스피너 높이만큼 아래로 밀렸다가 돌아오는 현상이 생긴다)
  const [pulling, setPulling] = useState(false);
  const onPullRefresh = async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  };

  // 방 검색 — 이름·이메일·그룹명·마지막 메시지 매칭 (웹 DmPage 필터 미러)
  const [query, setQuery] = useState('');
  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return (rooms ?? []).filter((r) =>
      [r.partnerName, r.partnerEmail, r.groupName, r.lastMessage]
        .some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  }, [rooms, query]);

  // 대화 내용 검색 — 통합 검색 API로 모든 방의 메시지 본문 매칭 (탭하면 그 메시지로 점프)
  const debounced = useDebounce(query, 300);
  const contentQuery = debounced.trim().length >= 2 ? debounced : '';
  const {
    data: searchData,
    isFetching: searching,
    isError: searchFailed,
    error: searchError,
    refetch: refetchSearch,
  } = useSearch(contentQuery);
  // 메시지는 검색 0페이지에만 실려 온다 (할 일만 페이징됨) — 여기선 다음 페이지를 당길 일이 없다
  const messageHits = contentQuery ? (searchData?.pages[0]?.messages ?? []) : [];
  // 검색 실패를 "결과 없음"으로 뭉개지 않는다 — 방 이름 필터는 로컬이라 계속 동작하지만,
  // 대화 내용 검색은 서버 호출이라 실패하면 그 사실을 그대로 알리고 재시도를 준다.
  const msgSearchFailed = !!contentQuery && searchFailed && !searching;

  // 목록으로 돌아오면 안 읽음/마지막 메시지 갱신
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // 스와이프 '읽음' — 방 읽음 처리(방을 열 때와 동일한 markRead API). 배지는 낙관적으로 즉시 제거 후 서버 값으로 동기화
  const qc = useQueryClient();
  const markRoomRead = useCallback(
    async (roomId?: number) => {
      if (roomId == null) return;
      qc.setQueryData<DmRoom[]>(dmKeys.rooms, (old) =>
        old?.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r)),
      );
      try {
        await markRead(roomId);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        qc.invalidateQueries({ queryKey: dmKeys.rooms });
      }
    },
    [qc],
  );

  const { navH, scrollY, onScroll } = useTopNavScroll();
  const listRef = useRef<Animated.FlatList<NonNullable<typeof rooms>[number]>>(null);
  useTabRetap('dm', () => (listRef.current as unknown as { scrollToOffset?: (o: { offset: number; animated: boolean }) => void })?.scrollToOffset?.({ offset: 0, animated: true }));
  const insets = useSafeAreaInsets();

  // 새 대화 버튼 — 캘린더·할일 탭의 뷰 메뉴와 동일한 네이티브 SF Symbol(font size 21, tint)로 위치·크기 통일
  const newMessageBtn = (
    <Host matchContents>
      <Button
        label=""
        systemImage="square.and.pencil"
        modifiers={[tint(theme.text), font({ size: 21 })]}
        onPress={() => router.push('/dm/new')}
      />
    </Host>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isLoading ? (
        <View style={[styles.flex1, { paddingTop: navH + 8 }]}>
          <SkeletonList rows={8} avatar={48} />
        </View>
      ) : isError ? (
        <View style={[styles.center, { paddingTop: navH }]}>
          <ThemedText type="default" style={[styles.error, { color: theme.danger }]}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : (
        <Animated.FlatList
          ref={listRef}
          // 라이트: 대화 목록을 흰 콘텐츠 시트로. 다크: 회색 캔버스 유지.
          style={!theme.isDark && { backgroundColor: theme.surface }}
          data={filteredRooms}
          keyExtractor={(item) => String(item.id)}
          refreshing={pulling}
          onRefresh={() => void onPullRefresh()}
          progressViewOffset={navH}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          itemLayoutAnimation={LinearTransition.duration(220)}
          contentContainerStyle={{ paddingTop: navH, paddingBottom: BottomTabInset + insets.bottom + 24 }}
          ListHeaderComponent={
            (rooms?.length ?? 0) > 0 ? (
              <View style={[styles.searchBar, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="search" size={16} color={theme.textSecondary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="대화 검색"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.searchInput, { color: theme.text }]}
                  autoCorrect={false}
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="검색어 지우기" accessibilityRole="button">
                    <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            // 메시지 검색이 실패한 상태면 '결과 없음' 대신 아래 푸터의 에러+재시도만 보여준다
            messageHits.length === 0 && !msgSearchFailed ? (
              <View style={styles.center}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceSelected }]}>
                  <Ionicons name="chatbubbles-outline" size={28} color={theme.textTertiary} />
                </View>
                <ThemedText type="default" style={styles.empty}>
                  {query ? (searching ? '검색 중…' : '검색 결과가 없어요.') : '대화가 없어요.'}
                </ThemedText>
                {!query ? (
                  <Press
                    onPress={() => router.push('/dm/new')}
                    style={[styles.emptyCta, { borderColor: theme.primary }]}
                    scale={1}
                    pressedStyle={{ opacity: 0.6 }}>
                    <Ionicons name="add" size={16} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                      새 대화 시작하기
                    </ThemedText>
                  </Press>
                ) : null}
              </View>
            ) : null
          }
          // 대화 내용 매칭 — 방 목록 아래 "메시지" 섹션으로 (탭하면 그 메시지 위치로 점프)
          ListFooterComponent={
            messageHits.length ? (
              <View style={styles.msgSection}>
                <ThemedText type="small" style={[styles.msgHeader, { color: theme.textSecondary }]}>
                  메시지
                </ThemedText>
                {messageHits.map((m, i) => (
                  <Pressable
                    key={`${m.roomId}-${m.sentAt ?? ''}-${i}`}
                    onPress={() => {
                      if (m.roomId == null) return;
                      const title = encodeURIComponent(m.partnerName ?? '대화');
                      const focus = m.sentAt ? `&focusAt=${encodeURIComponent(m.sentAt)}` : '';
                      router.push(`/dm/${m.roomId}?title=${title}${focus}`);
                    }}
                    style={({ pressed }) => [styles.msgRow, pressed && { backgroundColor: theme.surfaceSelected }]}>
                    <Avatar person={{ name: m.partnerName, profileImageUrl: m.partnerProfileImageUrl }} size={38} />
                    <View style={styles.msgBody}>
                      <ThemedText type="default" numberOfLines={1} style={styles.msgName}>
                        {m.partnerName ?? '대화'}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={2}>
                        {m.lastMessage}
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={theme.textTertiary} />
                  </Pressable>
                ))}
              </View>
            ) : query && searching ? (
              <ActivityIndicator style={styles.msgLoading} />
            ) : msgSearchFailed ? (
              <View style={styles.msgError}>
                <ThemedText type="small" style={[styles.msgErrorText, { color: theme.danger }]}>
                  {getApiErrorMessage(searchError)}
                </ThemedText>
                <Pressable onPress={() => void refetchSearch()} accessibilityRole="button">
                  <ThemedText type="link">다시 시도</ThemedText>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <RoomRow
              room={item}
              suggestionCount={item.id != null ? (suggestionCounts?.[String(item.id)] ?? 0) : 0}
              onPress={() => {
                const name = item.isGroup ? (item.groupName ?? '그룹') : (item.partnerName ?? '대화');
                router.push(`/dm/${item.id}?title=${encodeURIComponent(name)}`);
              }}
              onMarkRead={() => void markRoomRead(item.id)}
            />
          )}
        />
      )}
      <TopNav scrollY={scrollY} trailing={newMessageBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  error: { textAlign: 'center' },
  empty: { opacity: 0.5 },
  flex1: { flex: 1 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderRadius: 999, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, borderRadius: 10, paddingHorizontal: 10, marginHorizontal: 16, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  msgSection: { paddingTop: 12 },
  msgHeader: { fontWeight: '700', marginLeft: 20, marginBottom: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 10 },
  msgBody: { flex: 1, gap: 2 },
  msgName: { fontWeight: '700' },
  msgLoading: { marginTop: 16 },
  msgError: { alignItems: 'center', gap: 6, marginTop: 32, paddingHorizontal: 32 },
  msgErrorText: { textAlign: 'center' },
});
