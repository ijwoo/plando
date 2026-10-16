import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/themed-text';
import { isTodoDone } from '@/features/status/queries';
import { useWorkspacePermissions } from '@/features/workspace/permissions';
import { useTheme } from '@/hooks/use-theme';
import { AvatarStack } from '@/shared/ui/Avatar';
import type { Todo } from './api';
import { useCreateSubtask, useDeleteSubtask, useSubtasks, useTodo, useToggleSubtask } from './queries';
import { formatMonthDay, getDueTone } from './todoFilters';

/**
 * 서브태스크 섹션 — 클릭업 스타일. 진행률 헤더 + 행(체크 토글·담당자·마감 칩, 탭=자체 상세,
 * 왼쪽 스와이프=삭제) + 인라인 "+ 서브태스크 추가"(연속 입력). 서브태스크는 진짜 할 일이라
 * 행 탭이 같은 상세 화면을 재사용한다. 깊이 1단계 — 서브태스크 자신의 상세엔 이 섹션 대신
 * ParentBreadcrumb를 쓴다.
 */
export function SubtaskSection({
  parentId,
  projectColor,
  readonly,
}: {
  parentId: number;
  /** 진행률 바 색 — 프로젝트 색, 없으면 primary */
  projectColor?: string;
  readonly?: boolean;
}) {
  const theme = useTheme();
  const perms = useWorkspacePermissions();
  const router = useRouter();
  const { data: subtasks, isLoading } = useSubtasks(parentId);
  const toggle = useToggleSubtask(parentId);
  const create = useCreateSubtask(parentId);
  const del = useDeleteSubtask(parentId);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const total = subtasks?.length ?? 0;
  const doneCount = subtasks?.filter((t) => isTodoDone(t)).length ?? 0;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const barColor = projectColor || theme.primary;

  const onAdd = () => {
    const title = text.trim();
    if (!title) return;
    setText('');
    create.mutate(title);
    inputRef.current?.focus(); // 연속 추가 — 입력·포커스 유지
  };

  const confirmDelete = (t: Todo) =>
    Alert.alert('서브태스크 삭제', `"${t.title ?? '서브태스크'}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => t.id != null && del.mutate(t.id) },
    ]);

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="git-branch-outline" size={15} color={theme.textSecondary} />
          <ThemedText type="small" style={[styles.title, { color: theme.text }]}>
            서브태스크
          </ThemedText>
        </View>
        {total ? (
          <ThemedText type="small" style={[styles.count, { color: theme.textTertiary }]}>
            {doneCount}/{total}
          </ThemedText>
        ) : null}
      </View>

      {total ? (
        <View style={[styles.track, { backgroundColor: theme.divider }]}>
          <View style={[styles.fill, { backgroundColor: barColor, width: `${pct}%` }]} />
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        subtasks?.map((t) => (
          <SubtaskDetailRow
            key={t.id}
            todo={t}
            // 서버는 삭제를 '작성자 또는 ADMIN' 으로 제한한다(requireCanDeleteTodo).
            // readonly 만 보면 MEMBER 가 남의 서브태스크를 밀어 지우려다 403 을 맞는다.
            readonly={readonly || !perms.canDeleteTodo(t)}
            onToggle={(done) => t.id != null && toggle.mutate({ id: t.id, done })}
            onOpen={() => t.id != null && router.push(`/todo/${t.id}`)}
            onDelete={() => confirmDelete(t)}
          />
        ))
      )}

      {/* 인라인 추가 — 탭하면 그 자리에서 입력 확장, 제출 후에도 포커스 유지(연속 추가) */}
      {!readonly ? (
        <Pressable
          onPress={() => {
            setAdding(true);
            inputRef.current?.focus();
          }}
          style={[styles.row, total > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
          <Ionicons name="add-circle" size={22} color={theme.primary} />
          {adding ? (
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              onSubmitEditing={onAdd}
              onBlur={() => {
                if (!text.trim()) setAdding(false);
              }}
              placeholder="서브태스크 추가"
              placeholderTextColor={theme.textTertiary}
              autoFocus
              submitBehavior="submit"
              returnKeyType="done"
              style={[styles.rowTitle, styles.input, { color: theme.text }]}
            />
          ) : (
            <ThemedText type="default" style={{ color: theme.textSecondary }}>
              서브태스크 추가
            </ThemedText>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** 서브태스크 행 — 체크박스·제목(완료 취소선)·담당자·마감 톤 칩. 왼쪽 스와이프 = 삭제. */
function SubtaskDetailRow({
  todo,
  readonly,
  onToggle,
  onOpen,
  onDelete,
}: {
  todo: Todo;
  readonly?: boolean;
  onToggle: (done: boolean) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  const done = isTodoDone(todo);
  const dueTone = !done ? getDueTone(todo.dueDate) : null;
  const dueText = todo.dueDate
    ? dueTone?.label
      ? `${dueTone.label} · ${formatMonthDay(todo.dueDate)}`
      : formatMonthDay(todo.dueDate)
    : null;
  const assignees = todo.assignees ?? [];

  // 체크박스와 행 본문은 중첩이 아니라 형제 Pressable — Swipeable 아래 중첩 프레스는 터치를 잃는다
  const row = (
    <View style={[styles.cardRow, { backgroundColor: theme.surfaceAlt }]}>
      <Pressable
        hitSlop={10}
        disabled={readonly}
        onPress={() => onToggle(!done)}
        accessibilityRole="button"
        accessibilityLabel={done ? '완료 해제' : '완료'}>
        <Ionicons name={done ? 'checkbox' : 'square-outline'} size={21} color={done ? theme.green : theme.textTertiary} />
      </Pressable>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`서브태스크 ${todo.title ?? ''} 상세로 이동`}
        style={({ pressed }) => [styles.rowBody, pressed && { opacity: 0.6 }]}>
        <ThemedText
          type="default"
          numberOfLines={1}
          style={[styles.rowTitle, done && { color: theme.textSecondary, textDecorationLine: 'line-through' }]}>
          {todo.title}
        </ThemedText>
        {assignees.length ? <AvatarStack people={assignees} size={20} max={2} /> : null}
        {dueText ? (
          <View style={[styles.duePill, { backgroundColor: (dueTone?.color ?? theme.textSecondary) + '1A' }]}>
            <Text style={[styles.due, { color: dueTone?.color ?? theme.textSecondary, fontWeight: dueTone?.weight ?? '600' }]}>
              {dueText}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );

  if (readonly) return <View style={styles.swipeWrap}>{row}</View>;
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.4}
      rightThreshold={32}
      overshootRight={false}
      containerStyle={styles.swipeWrap}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel="서브태스크 삭제"
          style={[styles.delAction, { backgroundColor: theme.danger }]}>
          <Ionicons name="trash" size={17} color="#fff" />
        </Pressable>
      )}>
      {row}
    </ReanimatedSwipeable>
  );
}

/** 서브태스크 상세 상단 브레드크럼 — 상위 할 일 제목, 탭하면 부모 상세로 이동. */
export function ParentBreadcrumb({ parentId }: { parentId: number }) {
  const theme = useTheme();
  const router = useRouter();
  const { data: parent } = useTodo(parentId);
  return (
    <Pressable
      onPress={() => router.push(`/todo/${parentId}`)}
      accessibilityRole="button"
      accessibilityLabel="상위 할 일로 이동"
      style={({ pressed }) => [styles.crumb, { backgroundColor: theme.surfaceAlt }, pressed && { opacity: 0.6 }]}>
      <Ionicons name="return-up-back" size={14} color={theme.textSecondary} />
      <ThemedText type="small" style={[styles.crumbLabel, { color: theme.textSecondary }]}>
        상위 할 일
      </ThemedText>
      <ThemedText type="small" numberOfLines={1} style={[styles.crumbTitle, { color: theme.text }]}>
        {parent?.title ?? '…'}
      </ThemedText>
      <Ionicons name="chevron-forward" size={13} color={theme.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontWeight: '700', letterSpacing: 0.2 },
  count: { fontWeight: '700' },
  track: { height: 4, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  loading: { alignSelf: 'flex-start', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 },
  swipeWrap: { marginTop: 6, borderRadius: 10, overflow: 'hidden' },
  duePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  rowTitle: { flex: 1 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { paddingVertical: 0, fontSize: 16 },
  due: { fontSize: 12 },
  delAction: { width: 64, alignItems: 'center', justifyContent: 'center' },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  crumbLabel: { fontWeight: '700' },
  crumbTitle: { flexShrink: 1, fontWeight: '700' },
});
