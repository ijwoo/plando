import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { AvatarStack } from '@/shared/ui/Avatar';
import { projectIcon } from '@/features/project/projectIcons';
import { radius, shadow } from '@/shared/ui/tokens';
import { priorityColor, PRIORITY_LABEL, readableOn, statusColor, STATUS_LABEL, type TodoPriority, type TodoStatus } from '@/shared/ui/tone';
import { stripMarkdown } from '@/shared/utils/markdown';
import { SubtaskChip } from './TaskListRow';
import { formatMonthDay, getDueTone } from './todoFilters';
import type { Todo } from './api';
import { isTodoDone } from '@/features/status/queries';

/** 칸반 컬럼 — 상태별 할 일 카드 목록. 아카이브 컬럼처럼 접을 수 있는 모드 지원. */
export function KanbanColumn({
  status,
  todos,
  count,
  width,
  refreshing = false,
  onRefresh,
  onToggle,
  onOpen,
  onLongPress,
  showMeta = false,
  projectMap,
  subtaskCounts,
  label,
  dotColor,
  toggleMode = 'complete',
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  bottomPad,
}: {
  status: string;
  todos: Todo[];
  /**
   * 헤더에 표시할 개수. 기본은 렌더 중인 목록 길이지만, 접혀 있어 목록을 아직 받아오지
   * 않은 컬럼(아카이브)은 `null`을 줘서 숫자를 아예 감춘다 — 모르는 값을 0으로 그리면
   * "보관함이 비었다"로 읽힌다.
   */
  count?: number | null;
  width: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  onToggle: (todo: Todo, done: boolean) => void;
  onDelete?: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
  onLongPress?: (todo: Todo) => void;
  /** 전체/인박스 스코프에서만 프로젝트·담당자 노출 */
  showMeta?: boolean;
  projectMap?: Map<number, { name?: string; color?: string; icon?: string }>;
  /** 서브태스크 진행률(N/M) — todoId → {done,total} */
  subtaskCounts?: Map<number, { done: number; total: number }>;
  /** 카드 왼쪽 버튼의 의미. 아카이브 컬럼은 '완료 체크'가 아니라 '복원'이라
      같은 동그라미 체크박스를 쓰면 눌렀을 때 벌어지는 일과 모양이 어긋난다. */
  toggleMode?: 'complete' | 'restore';
  /** 헤더 라벨/점 색 오버라이드(아카이브 등 상태 외 컬럼용) */
  label?: string;
  dotColor?: string;
  /** 접기 가능 컬럼(아카이브) — collapsed면 카드 목록 숨김 */
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** 하단 플로팅 탭바에 마지막 카드가 가리지 않게 컬럼 리스트 하단 패딩 */
  bottomPad?: number;
}) {
  const theme = useTheme();
  // count를 명시하지 않으면(일반 상태 컬럼) 목록 길이를 그대로 쓴다.
  const shown = count === undefined ? todos.length : count;
  const header = (
    <View style={styles.header}>
      <View style={[styles.dot, { backgroundColor: dotColor ?? statusColor(theme, status) }]} />
      <ThemedText type="default" style={styles.title}>
        {label ?? STATUS_LABEL[status as TodoStatus] ?? status}
      </ThemedText>
      {shown != null ? (
        <ThemedText type="small" style={styles.count}>
          {shown}
        </ThemedText>
      ) : null}
      {collapsible ? (
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={theme.textSecondary}
          style={styles.chevron}
        />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.col, { width }]}>
      {collapsible ? (
        <Pressable onPress={onToggleCollapse}>{header}</Pressable>
      ) : (
        header
      )}

      {collapsible && collapsed ? null : (
        <FlatList
          data={todos}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, bottomPad != null && { paddingBottom: bottomPad }]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
          /* 당겨서 새로고침 — refreshing/onRefresh 는 props 로 **선언만 되고 쓰이지 않아**
             보드에서만 새로고침이 통째로 없었다. 바깥은 가로 ScrollView라 RefreshControl 을
             달 수 없으니(세로 제스처가 필요) 각 컬럼의 세로 리스트에 단다. */
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
          }
          ListEmptyComponent={
            <ThemedText type="small" style={styles.empty}>
              없음
            </ThemedText>
          }
          renderItem={({ item }) => (
            <KanbanCard
              todo={item}
              showMeta={showMeta}
              project={showMeta && item.projectId != null ? projectMap?.get(item.projectId) : undefined}
              subtasks={item.id != null ? subtaskCounts?.get(item.id) : undefined}
              onToggle={(done) => onToggle(item, done)}
              toggleMode={toggleMode}
              onOpen={() => onOpen(item)}
              onLongPress={onLongPress ? () => onLongPress(item) : undefined}
            />
          )}
        />
      )}
    </View>
  );
}

/** 보드 카드 — surface 카드 + 좌측 우선순위 바 + 제목·본문·메타(프로젝트·우선순위·담당자·마감 톤). */
function KanbanCard({
  todo,
  showMeta,
  project,
  subtasks,
  onToggle,
  toggleMode = 'complete',
  onOpen,
  onLongPress,
}: {
  todo: Todo;
  showMeta?: boolean;
  project?: { name?: string; color?: string; icon?: string };
  /** 서브태스크 진행률(N/M) — 있을 때만 칩 표시 */
  subtasks?: { done: number; total: number };
  onToggle: (done: boolean) => void;
  toggleMode?: 'complete' | 'restore';
  onOpen: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  const done = isTodoDone(todo);
  const pColor = priorityColor(theme, todo.priority);
  const showBar = !done && todo.priority && todo.priority !== 'LOW';
  const dueTone = !done ? getDueTone(todo.dueDate) : null;
  const dueText = todo.dueDate
    ? dueTone?.label
      ? `${dueTone.label} · ${formatMonthDay(todo.dueDate)}`
      : formatMonthDay(todo.dueDate)
    : null;

  // 참여자 아바타는 스코프와 무관하게 항상 표시(목록 뷰와 통일). 프로젝트 칩만 스코프 게이팅.
  const assignees = todo.assignees ?? [];
  const showProject = showMeta && project?.name;
  const hasMeta =
    showProject || (!done && todo.priority) || assignees.length > 0 || dueText || (subtasks && subtasks.total > 0);

  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.85 },
      ]}>
      {showBar ? <View style={[styles.prioBar, { backgroundColor: pColor }]} /> : null}

      <View style={styles.cardTop}>
        {/* 아카이브 컬럼에서 이 버튼은 '완료'가 아니라 '복원'이다. 예전엔 두 경우 모두
            동그라미 체크박스를 그려서, 누르면 항목이 아카이브에서 빠져나가는데도
            모양은 '완료 체크'로 읽혔다. 하는 일이 다르면 아이콘도 달라야 한다. */}
        <Pressable
          onPress={() => onToggle(!done)}
          hitSlop={8}
          style={styles.check}
          accessibilityRole="button"
          accessibilityLabel={toggleMode === 'restore' ? '복원' : done ? '완료 해제' : '완료'}>
          <Ionicons
            name={
              toggleMode === 'restore' ? 'arrow-undo-outline' : done ? 'checkmark-circle' : 'ellipse-outline'
            }
            size={toggleMode === 'restore' ? 19 : 22}
            color={toggleMode === 'restore' ? theme.textSecondary : done ? theme.green : theme.textSecondary}
          />
        </Pressable>
        <ThemedText
          type="default"
          style={[styles.cardTitle, done && { color: theme.textSecondary, textDecorationLine: 'line-through' }]}
          numberOfLines={3}>
          {todo.title}
        </ThemedText>
      </View>

      {todo.content ? (
        <ThemedText type="small" style={[styles.content, { color: theme.textSecondary }]} numberOfLines={2}>
          {stripMarkdown(todo.content)}
        </ThemedText>
      ) : null}

      {hasMeta ? (
        <View style={styles.meta}>
          {showProject ? (
            <View style={styles.metaItem}>
              <View style={[styles.projBadge, { backgroundColor: project?.color ?? theme.textSecondary }]}>
                <Ionicons name={projectIcon(project?.icon)} size={10} color="#fff" />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }} numberOfLines={1}>
                {project?.name}
              </ThemedText>
            </View>
          ) : null}
          {!done && todo.priority ? (
            <View style={[styles.pill, { backgroundColor: pColor }]}>
              <Text style={[styles.pillText, { color: readableOn(pColor) }]}>{PRIORITY_LABEL[todo.priority as TodoPriority]}</Text>
            </View>
          ) : null}
          {subtasks && subtasks.total > 0 ? <SubtaskChip done={subtasks.done} total={subtasks.total} /> : null}
          {assignees.length ? <AvatarStack people={assignees} size={20} /> : null}
          {dueText ? (
            <Text style={[styles.due, { color: dueTone?.color ?? theme.textSecondary, fontWeight: dueTone?.weight ?? '500' }]}>
              {dueText}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontWeight: '700' },
  count: { opacity: 0.5 },
  chevron: { marginLeft: 'auto' },
  list: { paddingHorizontal: 12, paddingBottom: 24, flexGrow: 1 },
  sep: { height: 10 },
  empty: { opacity: 0.4, textAlign: 'center', paddingTop: 24 },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8, overflow: 'hidden', ...shadow.card },
  prioBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: { paddingTop: 1 },
  cardTitle: { flex: 1, fontWeight: '600', lineHeight: 21 },
  content: { lineHeight: 19, marginLeft: 32 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 32 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  projBadge: { width: 16, height: 16, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  due: { fontSize: 12 },
});
