import { Children, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { HighlightText } from '@/shared/ui/HighlightText';
import { useCreateRoom } from '@/features/dm/queries';
import type { SearchResult, SearchTag } from '@/features/search/api';
import { useSearch } from '@/features/search/queries';
import { TagChip } from '@/features/tag/TagSection';
import { loadRecents, pushRecent, removeRecent } from '@/features/search/recentStore';
import { useTheme } from '@/hooks/use-theme';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useStatusMap } from '@/features/status/queries';
import { priorityColor, PRIORITY_LABEL, type TodoPriority } from '@/shared/ui/tone';

const MIN_QUERY = 2; // 웹과 동일 — 1글자 검색은 노이즈·부하만 커서 막는다

type TaskRow = NonNullable<SearchResult['tasks']>[number];

/** 통합 검색 — 할 일·메시지·멤버·프로젝트·태그. 기존 search 기능 매칭. */
export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const longEnough = debounced.trim().length >= MIN_QUERY;
  const { data, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } = useSearch(longEnough ? debounced : '');
  const createRoom = useCreateRoom();
  // 커스텀 상태를 원시 키(st_<uuid>)로 노출하지 않도록 워크스페이스 상태 맵을 통해 라벨링
  const sm = useStatusMap();

  // 최근 검색어 — 결과를 실제로 열었을 때 기록
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    void loadRecents().then(setRecents);
  }, []);
  const noteSearch = () => {
    const v = debounced.trim();
    if (v.length >= MIN_QUERY) void pushRecent(v).then(setRecents);
  };

  // 멤버 탭 → 그 사용자와 DM 방 생성/열기 (웹 openPartnerId 미러)
  const onMember = async (userId?: number, name?: string) => {
    if (userId == null || createRoom.isPending) return;
    noteSearch();
    try {
      const room = await createRoom.mutateAsync(userId);
      if (room?.id != null) router.push(`/dm/${room.id}?title=${encodeURIComponent(name ?? '대화')}`);
    } catch {
      // 방 생성 실패는 무시 (MutationCache에서 토스트 처리)
    }
  };

  // 할 일 외 종류는 0페이지에만 실려 온다 — 2페이지부터는 빈 배열이라 첫 페이지에서만 읽는다.
  const first = data?.pages[0];
  const messages = first?.messages ?? [];
  const members = first?.members ?? [];
  const projects = first?.projects ?? [];
  // TagChip은 id가 확정된 TagLite를 받는다 — 스펙상 optional이라 여기서 한 번 걸러 둔다
  const tags = (first?.tags ?? []).filter((t): t is SearchTag & { id: number } => t.id != null);
  const hasQuery = longEnough;
  const tooShort = debounced.trim().length > 0 && !longEnough;

  /**
   * 할 일 = 서버가 관련도순으로 페이징해 준 결과를 페이지 순서대로 이어 붙인 것.
   * (예전엔 여기서 로컬 목록 매칭을 덧붙였지만, 지금은 서버가 제목·본문을 같은 조건으로
   *  훑고 보관 항목까지 포함하므로 중복일 뿐 아니라 관련도 정렬·페이징을 깨뜨린다.)
   * 페이지 경계에서 같은 항목이 겹칠 여지가 있어 id로 한 번 걸러 준다.
   */
  const tasks = useMemo(() => {
    const map = new Map<number, TaskRow>();
    for (const p of data?.pages ?? []) for (const t of p.tasks ?? []) if (t.id != null && !map.has(t.id)) map.set(t.id, t);
    return [...map.values()];
  }, [data]);

  const empty =
    hasQuery && !isFetching && tasks.length + messages.length + members.length + projects.length + tags.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '검색',
          headerBackButtonDisplayMode: 'minimal',
          headerSearchBarOptions: {
            placeholder: '할 일·메시지·멤버 검색',
            autoFocus: true,
            autoCapitalize: 'none',
            hideWhenScrolling: false,
            onChangeText: (e) => setQ(e.nativeEvent.text),
            onCancelButtonPress: () => router.back(),
          },
        }}
      />

      <ScrollView
        contentContainerStyle={styles.results}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled">
        {/* 빈 영역 아무 데나 탭하면 키보드 닫힘 (네이티브 검색바 키보드 명시 dismiss) */}
        <Pressable style={styles.tapArea} onPress={() => Keyboard.dismiss()} accessible={false}>
        {/* keepPreviousData로 타이핑 중엔 이전 결과가 유지되므로, 스피너는 결과가 아예 없을 때만 */}
        {isFetching && !data ? <ActivityIndicator style={styles.loading} /> : null}
        {tooShort ? (
          <ThemedText type="small" style={styles.empty}>
            두 글자 이상 입력해주세요.
          </ThemedText>
        ) : null}
        {empty ? (
          <View style={styles.emptyBox}>
            <ThemedText type="default" style={styles.empty}>
              검색 결과가 없어요.
            </ThemedText>
            {/* 결과 없음 → 그 문구로 바로 할 일 만들기 (웹 addFromSearch 미러) */}
            <Pressable
              onPress={() => {
                noteSearch();
                router.push({ pathname: '/todo/new', params: { title: debounced.trim() } });
              }}
              style={[styles.addBtn, { borderColor: theme.primary }]}>
              <Ionicons name="add" size={16} color={theme.primary} />
              <ThemedText type="default" style={{ color: theme.primary, fontWeight: '700' }} numberOfLines={1}>
                “{debounced.trim()}” 할 일로 추가
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* 최근 검색 — 입력 전 */}
        {!hasQuery && !tooShort && recents.length ? (
          <View style={styles.section}>
            <ThemedText type="small" style={[styles.dim, styles.recentTitle]}>
              최근 검색
            </ThemedText>
            <View style={styles.recentWrap}>
              {recents.map((r) => (
                <Pressable key={r} onPress={() => setQ(r)} style={[styles.recentChip, { backgroundColor: theme.surfaceAlt }]}>
                  <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
                  <ThemedText type="small" numberOfLines={1}>
                    {r}
                  </ThemedText>
                  <Pressable
                    onPress={() => void removeRecent(r).then(setRecents)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`최근 검색 "${r}" 삭제`}>
                    <Ionicons name="close" size={13} color={theme.textTertiary} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {tasks.length > 0 && (
          // 다음 페이지가 남아 있으면 개수를 "30+"로 — 지금 보이는 게 전부라는 오해를 막는다
          <CategoryGroup
            icon="checkbox-outline"
            title="할 일"
            color={theme.primary}
            count={hasNextPage ? `${tasks.length}+` : tasks.length}>
            {tasks.map((t) => {
              const prio = t.priority
                ? { label: PRIORITY_LABEL[t.priority as TodoPriority], color: priorityColor(theme, t.priority) }
                : undefined;
              const isArchived = t.archived === true; // 서버가 내려주는 값 (예전엔 보관 목록을 따로 받아 대조했다)
              return (
                <Row
                  key={`task-${t.id}`}
                  onPress={() => {
                    if (t.id == null) return;
                    noteSearch();
                    router.push(`/todo/${t.id}`);
                  }}
                  theme={theme}>
                  <View style={styles.titleRow}>
                    <HighlightText
                      type="default"
                      numberOfLines={1}
                      // 보관 항목은 제목까지 한 톤 죽여서, 배지를 못 봐도 살아 있는 할 일과 구분되게
                      style={[styles.flex, isArchived && styles.archivedTitle]}
                      text={t.title ?? ''}
                      query={debounced}
                    />
                    {isArchived ? (
                      <View style={[styles.tag, { backgroundColor: theme.surfaceSelected }]}>
                        <Ionicons name="archive-outline" size={11} color={theme.textSecondary} />
                        <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                          보관
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.meta}>
                    {t.status ? (
                      <ThemedText type="small" style={styles.dim}>
                        {sm.label(t.status)}
                      </ThemedText>
                    ) : null}
                    {prio ? (
                      <View style={[styles.badge, { backgroundColor: prio.color }]}>
                        <ThemedText type="small" style={styles.badgeText}>
                          {prio.label}
                        </ThemedText>
                      </View>
                    ) : null}
                    {t.dueDate ? (
                      <ThemedText type="small" style={styles.dim}>
                        {t.dueDate}
                      </ThemedText>
                    ) : null}
                  </View>
                </Row>
              );
            })}
            {/* '더 보기'는 명시 버튼 — 할 일 아래로 프로젝트·메시지·멤버가 이어지므로
                스크롤 끝 자동 로드를 걸면 엉뚱한 섹션을 보는 중에 목록이 늘어난다.
                로딩 중에도 기존 행은 그대로 두고 버튼만 스피너로 바꾼다. */}
            {hasNextPage ? (
              <Pressable
                onPress={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                accessibilityRole="button"
                accessibilityLabel="할 일 검색 결과 더 보기"
                style={({ pressed }) => [styles.moreBtn, pressed && { backgroundColor: theme.surfaceSelected }]}>
                {isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <>
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                      더 보기
                    </ThemedText>
                    <Ionicons name="chevron-down" size={13} color={theme.primary} />
                  </>
                )}
              </Pressable>
            ) : null}
          </CategoryGroup>
        )}

        {projects.length > 0 && (
          <CategoryGroup icon="folder-outline" title="프로젝트" color={theme.purple} count={projects.length}>
            {projects.map((p) => (
              <Row
                key={`proj-${p.id}`}
                theme={theme}
                onPress={() => {
                  if (p.id == null) return;
                  noteSearch();
                  router.push(`/project/${p.id}`);
                }}>
                <View style={styles.titleRow}>
                  {/* 점 색은 프로젝트가 가진 색 그대로 — 없으면 테마 중립색 */}
                  <View style={[styles.projDot, { backgroundColor: p.color ?? theme.textTertiary }]} />
                  <HighlightText type="default" numberOfLines={1} style={styles.flex} text={p.name ?? '프로젝트'} query={debounced} />
                </View>
                <ThemedText type="small" style={[styles.dim, styles.projMeta]}>
                  미완료 {p.openCount ?? 0}
                </ThemedText>
              </Row>
            ))}
          </CategoryGroup>
        )}

        {tags.length > 0 && (
          <CategoryGroup icon="pricetags-outline" title="태그" color={theme.green} count={tags.length}>
            {tags.map((tg) => (
              <Row
                key={`tag-${tg.id}`}
                theme={theme}
                onPress={() => {
                  noteSearch();
                  // 할 일 탭으로 이동하면서 태그 필터를 딥링크로 전달 — todo.tsx가 filterTags에 반영한다.
                  // tab=all을 함께 넘기는 이유: 직전에 보던 탭이 '오늘'이면 태그를 걸어도 대부분 걸러져
                  // 결과가 비어 보인다(필터가 안 먹은 것처럼 읽힌다).
                  router.push(`/todo?tab=all&tag=${tg.id}`);
                }}>
                <View style={styles.titleRow}>
                  {/* 태그는 자기 색을 가진 칩이 곧 식별자라 상세의 TagChip을 그대로 쓴다 */}
                  <TagChip tag={{ id: tg.id, name: tg.name ?? '태그', color: tg.color }} theme={theme} />
                  <View style={styles.flex} />
                  <ThemedText type="small" style={styles.dim}>
                    할 일 {tg.todoCount ?? 0}
                  </ThemedText>
                </View>
              </Row>
            ))}
          </CategoryGroup>
        )}

        {messages.length > 0 && (
          <CategoryGroup icon="chatbubble-ellipses-outline" title="메시지" color="#3D7BFF" count={messages.length}>
            {messages.map((m) => (
              <Row
                key={`msg-${m.roomId}`}
                theme={theme}
                onPress={() => {
                  if (m.roomId == null) return;
                  noteSearch();
                  const title = encodeURIComponent(m.partnerName ?? '대화');
                  const focus = m.sentAt ? `&focusAt=${encodeURIComponent(m.sentAt)}` : '';
                  router.push(`/dm/${m.roomId}?title=${title}${focus}`);
                }}>
                <ThemedText type="default" numberOfLines={1}>
                  {m.partnerName ?? '대화'}
                </ThemedText>
                <HighlightText type="small" style={styles.dim} numberOfLines={2} text={m.lastMessage ?? ''} query={debounced} />
              </Row>
            ))}
          </CategoryGroup>
        )}

        {members.length > 0 && (
          <CategoryGroup icon="people-outline" title="멤버" color={theme.orange} count={members.length}>
            {members.map((mb) => {
              const owner = mb.role === 'OWNER';
              return (
                <Row key={`mem-${mb.userId}`} theme={theme} onPress={() => onMember(mb.userId, mb.name ?? mb.email)}>
                  <View style={styles.titleRow}>
                    <ThemedText type="default" numberOfLines={1} style={styles.flex}>
                      {mb.name ?? mb.email}
                    </ThemedText>
                    <View style={[styles.tag, { backgroundColor: owner ? theme.orange + '1F' : theme.surfaceSelected }]}>
                      <ThemedText type="small" style={{ color: owner ? theme.orange : theme.textSecondary, fontWeight: '700' }}>
                        {owner ? '소유자' : '멤버'}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText type="small" style={styles.dim}>
                    {mb.email}
                  </ThemedText>
                </Row>
              );
            })}
          </CategoryGroup>
        )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** 카테고리 그룹 — 아이콘+제목+개수 헤더(탭하면 접기/펴기) + 행들을 한 카드에 묶음. */
function CategoryGroup({
  icon,
  title,
  color,
  count,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  color: string;
  /** 문자열도 받는다 — 페이징 중인 할 일은 "30+"처럼 '더 있음'을 함께 표기하기 위함 */
  count: number | string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const items = Children.toArray(children);

  return (
    <View style={styles.section}>
      <Pressable style={styles.catHeader} onPress={() => setOpen((v) => !v)}>
        <View style={[styles.catIcon, { backgroundColor: color + '1A' }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <ThemedText type="label" style={styles.catTitle}>
          {title}
        </ThemedText>
        <View style={[styles.countBadge, { backgroundColor: theme.surfaceAlt }]}>
          <ThemedText type="small" style={[styles.countText, { color: theme.textSecondary }]}>
            {count}
          </ThemedText>
        </View>
        <View style={styles.flex} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textTertiary} />
      </Pressable>
      {open ? (
        <View style={[styles.list, { borderTopColor: theme.divider }]}>
          {items.map((child, i) => (
            <View
              key={i}
              style={i < items.length - 1 ? { borderBottomColor: theme.divider, borderBottomWidth: StyleSheet.hairlineWidth } : null}>
              {child}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** 카드 내부 결과 행 */
function Row({ onPress, theme, children }: { onPress: () => void; theme: ReturnType<typeof useTheme>; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceSelected }]}>
      <View style={styles.body}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  results: { padding: 16, flexGrow: 1 },
  tapArea: { flexGrow: 1, gap: 8 },
  loading: { marginVertical: 12 },
  empty: { opacity: 0.5, textAlign: 'center', paddingTop: 40 },
  section: { marginBottom: 14 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4 },
  catIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catTitle: { fontWeight: '700' },
  countBadge: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 9, alignItems: 'center' },
  countText: { fontWeight: '700' },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { paddingVertical: 13, paddingHorizontal: 4 },
  body: { gap: 3 },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dim: { opacity: 0.6 },
  emptyBox: { alignItems: 'center', gap: 14, paddingTop: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, maxWidth: '90%' },
  recentTitle: { marginBottom: 8, marginLeft: 4 },
  recentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, maxWidth: '100%' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, minHeight: 44 },
  archivedTitle: { opacity: 0.55 },
  projDot: { width: 8, height: 8, borderRadius: 4 },
  projMeta: { marginLeft: 16 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: '#fff', fontWeight: '700' },
});
