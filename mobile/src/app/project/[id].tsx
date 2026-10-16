import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Button as MenuButton, Host, Menu } from '@expo/ui/swift-ui';
import { font, tint } from '@expo/ui/swift-ui/modifiers';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useDeleteProject, useProjectActivity, useProjects } from '@/features/project/queries';
import { projectIcon } from '@/features/project/projectIcons';
import { ProjectCreateSheet } from '@/features/project/ProjectCreateSheet';
import { changeSummary, collapseLogs } from '@/features/todo/logs';
import { isTodoDone, useStatusMap } from '@/features/status/queries';
import { TaskListRow } from '@/features/todo/TaskListRow';
import { useTodos, useToggleTodo } from '@/features/todo/queries';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/shared/ui/Avatar';
import { relativeTime, toDateString } from '@/shared/utils/datetime';

type StatusChip = 'all' | 'in_progress' | 'done' | 'overdue';

/** 프로젝트 상세 — 상태 칩(탭 필터) + 할 일 목록 + 진행률 + 우측 ...(수정/삭제). 웹 ProjectDetailPage 미러. */
export default function ProjectDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);
  const { data: projects } = useProjects();
  const { data: todos, isLoading, isError, error, refetch, isRefetching } = useTodos();
  const toggle = useToggleTodo();
  const del = useDeleteProject();
  const [editOpen, setEditOpen] = useState(false);
  const [chip, setChip] = useState<StatusChip>('all');

  const project = projects?.find((p) => p.id === pid);
  const items = useMemo(() => (todos ?? []).filter((t) => t.projectId === pid), [todos, pid]);
  const { data: activity } = useProjectActivity(pid);
  const statusMap = useStatusMap();
  const { label: statusLabel } = statusMap;
  // 로그의 todoId → 할 일 제목 매핑 (활동 피드에 어떤 할 일인지 표시)
  const todoTitle = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of todos ?? []) if (t.id != null) m.set(t.id, t.title ?? '할 일');
    return m;
  }, [todos]);
  const doneCount = items.filter((t) => isTodoDone(t)).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const color = project?.color ?? theme.textSecondary;

  // 상태 칩 카운트 + 필터 (웹 상단 stat chips 대응 — 탭하면 아래 목록 필터)
  const today = toDateString(new Date());
  const isOverdue = (t: (typeof items)[number]) => !isTodoDone(t) && !!t.dueDate && t.dueDate < today;
  const chipCounts: { key: StatusChip; label: string; count: number; tint: string }[] = [
    { key: 'all', label: '전체', count: items.length, tint: theme.textSecondary },
    { key: 'in_progress', label: '진행 중', count: items.filter((t) => statusMap.category(t.status) === 'IN_PROGRESS').length, tint: theme.orange },
    { key: 'done', label: '완료', count: doneCount, tint: theme.green },
    { key: 'overdue', label: '지연', count: items.filter(isOverdue).length, tint: theme.danger },
  ];
  const visible = useMemo(() => {
    // 커스텀 상태 워크스페이스에서도 동작하도록 category 로 판정한다
    if (chip === 'in_progress') return items.filter((t) => statusMap.category(t.status) === 'IN_PROGRESS');
    if (chip === 'done') return items.filter((t) => isTodoDone(t));
    if (chip === 'overdue') return items.filter(isOverdue);
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isOverdue는 today에만 의존
  }, [items, chip, today]);

  const onDelete = () => {
    Alert.alert('프로젝트 삭제', `"${project?.name ?? ''}" 프로젝트를 삭제할까요? (할 일은 유지됩니다)`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => del.mutate(pid, { onSuccess: () => router.back() }),
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: project?.name ?? '프로젝트',
          headerRight: () => (
            <Host matchContents>
              <Menu label="" systemImage="ellipsis" modifiers={[tint(theme.text), font({ size: 21 })]}>
                <MenuButton label="수정" systemImage="pencil" onPress={() => setEditOpen(true)} />
                <MenuButton label="삭제" systemImage="trash" role="destructive" onPress={onDelete} />
              </Menu>
            </Host>
          ),
        }}
      />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <ThemedText type="default" style={{ color: theme.danger }}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            <View style={styles.head}>
              <View style={styles.titleRow}>
                <View style={[styles.iconBox, { backgroundColor: color }]}>
                  <Ionicons name={projectIcon(project?.icon)} size={20} color="#fff" />
                </View>
                <ThemedText type="title" style={styles.name} numberOfLines={1}>
                  {project?.name ?? '프로젝트'}
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                할 일 {items.length} · 완료 {doneCount}
              </ThemedText>
              {items.length ? (
                <View style={[styles.track, { backgroundColor: theme.divider }]}>
                  <View style={[styles.fill, { backgroundColor: color, width: `${pct}%` }]} />
                </View>
              ) : null}
              {items.length ? (
                <View style={styles.chips}>
                  {chipCounts.map((c) => {
                    const active = chip === c.key;
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => setChip(c.key)}
                        style={[styles.chip, { backgroundColor: active ? c.tint + '22' : theme.surfaceAlt, borderColor: active ? c.tint : 'transparent' }]}>
                        <ThemedText type="small" style={{ color: active ? c.tint : theme.textSecondary, fontWeight: '700' }}>
                          {c.label} {c.count}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <ThemedText type="small" style={styles.empty}>
              {chip === 'all' ? '이 프로젝트의 할 일이 없어요.' : '해당하는 할 일이 없어요.'}
            </ThemedText>
          }
          renderItem={({ item }) => (
            /* 할 일 탭과 **같은 행**을 쓴다.
               [고치는 결함] 여기만 다른 행(TodoRow)이라 스와이프도 햅틱도 없었다.
               같은 앱에서 같은 동작이 화면마다 다르게 반응하면 덜 만든 화면으로 읽힌다. */
            <TaskListRow
              todo={item}
              onToggle={(done) => item.id != null && toggle.mutate({ id: item.id, done })}
              onOpen={() => item.id != null && router.push(`/todo/${item.id}`)}
            />
          )}
          ListFooterComponent={
            activity && activity.length ? (
              <View style={styles.activity}>
                <ThemedText type="small" style={[styles.activityHead, { color: theme.textSecondary }]}>
                  최근 활동
                </ThemedText>
                {collapseLogs(activity).slice(0, 12).map((l) => {
                  const who = l.modifierName ?? l.modifier ?? '누군가';
                  const title = l.todoId != null ? todoTitle.get(l.todoId) : undefined;
                  return (
                    <Pressable
                      key={l.id}
                      style={styles.actRow}
                      disabled={l.todoId == null}
                      onPress={() => l.todoId != null && router.push(`/todo/${l.todoId}?tab=activity`)}>
                      <Avatar person={{ name: who, profileImageUrl: l.modifierProfileImageUrl }} size={26} />
                      <View style={styles.actBody}>
                        <ThemedText type="small" numberOfLines={2}>
                          <ThemedText type="small" style={styles.actWho}>
                            {who}
                          </ThemedText>
                          {`님 · ${title ? `"${title}" ` : ''}${changeSummary(l, statusLabel)}`}
                        </ThemedText>
                        <ThemedText type="small" style={styles.actTime}>
                          {relativeTime(l.modifiedAt)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null
          }
        />
      )}

      <ProjectCreateSheet open={editOpen} onClose={() => setEditOpen(false)} project={project} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  list: { padding: 16, gap: 0, flexGrow: 1 },
  sep: { height: 8 },
  head: { paddingBottom: 14, gap: 8 },
  track: { height: 4, borderRadius: 999, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 999 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { flexShrink: 1 },
  empty: { textAlign: 'center', opacity: 0.5, paddingTop: 40 },
  activity: { marginTop: 24, gap: 16 },
  activityHead: { fontWeight: '800', fontSize: 14.5 },
  actRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  actBody: { flex: 1, gap: 2 },
  actWho: { fontWeight: '700' },
  actTime: { opacity: 0.5, marginTop: 1 },
});
