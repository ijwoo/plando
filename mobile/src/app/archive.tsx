import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { toast } from '@/shared/ui/toast';
import type { Todo } from '@/features/todo/api';
import { useArchivedTodos, useDeleteTodo, useRestoreTodo } from '@/features/todo/queries';
import { formatMonthDay } from '@/features/todo/todoFilters';
import { useWorkspacePermissions } from '@/features/workspace/permissions';
import { useTheme } from '@/hooks/use-theme';
import { ListRow } from '@/shared/ui/List';
import { tickHaptic } from '@/shared/ui/haptics';
import { PRIORITY_LABEL, type TodoPriority } from '@/shared/ui/tone';

type MonthGroup = { key: string; label: string; items: Todo[] };

/** 보관 할 일을 월별 그룹핑 (createdAt 기준, 최신 월 먼저). */
function groupByMonth(todos: Todo[]): MonthGroup[] {
  const map = new Map<string, Todo[]>();
  for (const t of todos) {
    const key = (t.createdAt ?? '').slice(0, 7) || '0000-00';
    const arr = map.get(key);
    if (arr) arr.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const [y, m] = key.split('-');
      return { key, label: key === '0000-00' ? '날짜 없음' : `${y}년 ${Number(m)}월`, items };
    });
}

/** 아카이브 — 네이티브 검색 + 월별 아코디언(기본 접힘) 플랫 리스트 + 복원. */
export default function ArchiveScreen() {
  const theme = useTheme();
  const perms = useWorkspacePermissions();
  const router = useRouter();
  const { data: todos, isLoading, isError, error, refetch, isRefetching } = useArchivedTodos();
  const restore = useRestoreTodo();
  const del = useDeleteTodo(); // ['todos'] prefix 무효화 → 아카이브 목록도 갱신
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // 기본 접힘

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? (todos ?? []).filter((t) => t.title?.toLowerCase().includes(q)) : (todos ?? []);
    return groupByMonth(filtered);
  }, [todos, query]);

  const searching = query.trim().length > 0;
  const isOpen = (key: string) => searching || !!expanded[key];
  const toggle = (key: string) => {
    tickHaptic();
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const meta = (t: Todo) => {
    const parts: string[] = [];
    if (t.priority) parts.push(PRIORITY_LABEL[t.priority as TodoPriority]);
    if (t.dueDate) parts.push(formatMonthDay(t.dueDate));
    return parts.join(' · ') || undefined;
  };

  const onRestore = (item: Todo) => {
    if (item.id == null) return;
    tickHaptic();
    restore.mutate(item.id, { onSuccess: () => toast.success('복원했어요') });
  };

  // 영구 삭제 — 웹 ArchiveView ConfirmDialog 문구 미러
  const onDelete = (item: Todo) => {
    if (item.id == null) return;
    const id = item.id;
    Alert.alert('영구 삭제', item.title ? `"${item.title}"\n삭제하면 되돌릴 수 없어요.` : '이 작업을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          tickHaptic();
          del.mutate(id);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '아카이브',
          headerSearchBarOptions: {
            placeholder: '제목 검색',
            hideWhenScrolling: false,
            onChangeText: (e) => setQuery(e.nativeEvent.text ?? ''),
          },
        }}
      />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <ThemedText type="default" style={[styles.error, { color: theme.danger }]}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          {searching ? (
            <ThemedText type="default" style={styles.empty}>
              검색 결과가 없어요.
            </ThemedText>
          ) : (
            <>
              <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="archive-outline" size={30} color={theme.textTertiary} />
              </View>
              <ThemedText type="default" style={styles.emptyTitle}>
                보관된 할 일이 없어요
              </ThemedText>
              <ThemedText type="small" style={styles.empty}>
                완료한 할 일을 보관하면 여기에 모여요.
              </ThemedText>
            </>
          )}
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
          {groups.map((g) => {
            const open = isOpen(g.key);
            return (
              <View key={g.key}>
                <Pressable
                  onPress={() => toggle(g.key)}
                  style={({ pressed }) => [
                    styles.headerRow,
                    { borderBottomColor: theme.divider },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText type="default" style={styles.headerLabel}>
                    {g.label}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                    {g.items.length}
                  </ThemedText>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
                </Pressable>
                {open
                  ? g.items.map((item, i) => {
                      // 복원=편집, 영구삭제=삭제 권한. 예전엔 게이트가 없어
                      // VIEWER·비작성자가 눌러도 403 으로만 돌아왔다.
                      // 샘플은 서버가 수정·삭제를 모두 막으므로(PermissionService) 둘 다 뺀다.
                      const canRestore = perms.canEditContent && !item.isSample;
                      const canDelete = perms.canDeleteTodo(item) && !item.isSample;
                      return (
                      <ListRow dense
                        key={item.id}
                        label={item.title ?? '제목 없음'}
                        desc={meta(item)}
                        last={i === g.items.length - 1}
                        onPress={() => item.id != null && router.push(`/todo/${item.id}`)}
                        right={
                          <View style={styles.actions}>
                            {canRestore ? (
                            <Pressable
                              onPress={() => onRestore(item)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`${item.title ?? '할 일'} 복원`}
                              style={styles.restore}>
                              <Ionicons name="arrow-undo-outline" size={17} color={theme.primary} />
                              <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                                복원
                              </ThemedText>
                            </Pressable>
                            ) : null}
                            {canDelete ? (
                            <Pressable
                              onPress={() => onDelete(item)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`${item.title ?? '할 일'} 영구 삭제`}>
                              <Ionicons name="trash-outline" size={17} color={theme.danger} />
                            </Pressable>
                            ) : null}
                            {/* 버튼이 하나도 없으면 행이 왜 비었는지 알 수 없다 — 이유를 적어둔다
                                (둘러보기 워크스페이스는 전부 샘플이라 이 상태가 기본) */}
                            {!canRestore && !canDelete ? (
                              <ThemedText type="small" style={{ color: theme.textTertiary }}>
                                {item.isSample ? '샘플' : '읽기 전용'}
                              </ThemedText>
                            ) : null}
                          </View>
                        }
                      />
                      );
                    })
                  : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  error: {  },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '700' },
  empty: { opacity: 0.5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  headerLabel: { flex: 1, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  restore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
