import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useDeleteProject, useProjects } from '@/features/project/queries';
import { projectIcon } from '@/features/project/projectIcons';
import { ProjectCreateSheet } from '@/features/project/ProjectCreateSheet';
import { useWorkspacePermissions } from '@/features/workspace/permissions';
import { useTheme } from '@/hooks/use-theme';
import { ListGroup, ListRow } from '@/shared/ui/List';
import { tickHaptic } from '@/shared/ui/haptics';

/** 프로젝트 관리 — 목록 + 우측 상단 추가(바텀시트) + 삭제. */
export default function ProjectsScreen() {
  const theme = useTheme();
  const perms = useWorkspacePermissions();
  const router = useRouter();
  const { data: projects, isLoading, isError, error, refetch, isRefetching } = useProjects();
  const del = useDeleteProject();
  const [sheetOpen, setSheetOpen] = useState(false);

  const onDelete = (id: number, label: string) => {
    Alert.alert('프로젝트 삭제', `"${label}" 프로젝트를 삭제할까요? (할 일은 유지됩니다)`, [
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
          title: '프로젝트',
          headerRight: () => (
            <Pressable onPress={() => setSheetOpen(true)} hitSlop={8}>
              <Ionicons name="add" size={26} color={theme.primary} />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <ThemedText type="default" style={[styles.err, { color: theme.danger }]}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="folder-open-outline" size={30} color={theme.textTertiary} />
              </View>
              <ThemedText type="default" style={styles.emptyTitle}>
                아직 프로젝트가 없어요
              </ThemedText>
              <ThemedText type="small" style={styles.empty}>
                오른쪽 위 + 로 프로젝트를 만들어보세요.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const total = item.todoCount ?? 0;
            const done = item.doneCount ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <ListGroup>
                {/* 프레스 영역은 카드 전체 — 행에만 걸면 아래 진행률 바 영역만 색이 안 입혀져 반쪽으로 보인다 */}
                <Pressable
                  onPress={() => {
                    if (item.id == null) return;
                    tickHaptic();
                    router.push(`/project/${item.id}`);
                  }}
                  style={({ pressed }) =>
                    pressed ? { backgroundColor: theme.isDark ? theme.surfaceSelected : theme.surfaceAlt } : null
                  }>
                  <ListRow
                    iconColor={item.color ?? undefined}
                    icon={projectIcon(item.icon)}
                    label={item.name ?? '프로젝트'}
                    desc={`할 일 ${total} · 완료 ${done}`}
                    // 서버는 작성자 또는 ADMIN 만 삭제를 허용한다(canDeleteProject).
                    // 예전엔 게이트가 없어 누구에게나 '삭제'가 보이고 누르면 403 이었다.
                    right={
                      perms.canDeleteProject(item) ? (
                      <Pressable
                        onPress={() => item.id != null && onDelete(item.id, item.name ?? '')}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name ?? '프로젝트'} 삭제`}>
                        <ThemedText type="small" style={[styles.del, { color: theme.danger }]}>
                          삭제
                        </ThemedText>
                      </Pressable>
                      ) : null
                    }
                    last
                  />
                  {/* 진행률 트랙 — project/[id] 헤더 진행률 바와 동일 시각 */}
                  {total > 0 ? (
                    <View style={styles.trackWrap}>
                      <View style={[styles.track, { backgroundColor: theme.divider }]}>
                        <View style={[styles.fill, { backgroundColor: item.color ?? theme.textSecondary, width: `${pct}%` }]} />
                      </View>
                    </View>
                  ) : null}
                </Pressable>
              </ListGroup>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      <ProjectCreateSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  err: {  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '700' },
  empty: { opacity: 0.5 },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, flexGrow: 1 },
  sep: { height: 10 },
  del: {  },
  trackWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  track: { height: 4, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
