import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTags } from '@/features/tag/queries';
import type { DueFilter } from '@/features/todo/TaskFilterSheet';
import { useTheme } from '@/hooks/use-theme';
import { Press } from '@/shared/ui/Press';
import { PRIORITY_LABEL, priorityColor, readableOn, type TodoPriority } from '@/shared/ui/tone';
import { radius, space } from '@/shared/ui/tokens';

/**
 * 지금 걸려 있는 필터를 목록 위에 칩으로 보여주고, 칩을 눌러 바로 해제한다.
 *
 * 예전엔 필터 버튼에 점 하나만 찍혔다. 그래서 태그나 담당자로 걸러 놓고 나면
 * "왜 목록이 이것뿐이지?"가 되고, 풀려면 필터 시트를 다시 열어야 했다.
 * 특히 태그를 눌러 이 화면으로 들어온 경우(할 일 상세 → 태그 탭) 사용자는
 * 자기가 필터를 건 적이 없다고 느끼므로 표시가 없으면 고장으로 읽힌다.
 *
 * 아무 필터도 없으면 아무것도 그리지 않는다(높이 0) — 평소 화면을 밀어내지 않기 위해서.
 */
export function ActiveFilterBar({
  assignees,
  onClearAssignees,
  prios,
  onTogglePrio,
  due,
  onClearDue,
  tagIds,
  onToggleTag,
  onClearAll,
  myEmail,
}: {
  assignees: string[];
  onClearAssignees: () => void;
  prios: TodoPriority[];
  onTogglePrio: (p: TodoPriority) => void;
  due: DueFilter;
  onClearDue: () => void;
  tagIds: number[];
  onToggleTag: (id: number) => void;
  onClearAll: () => void;
  myEmail: string;
}) {
  const theme = useTheme();
  const { data: allTags } = useTags();

  const dueLabel = due === 'today' ? '오늘 마감' : due === 'overdue' ? '지연' : null;
  const assigneeLabel =
    assignees.length === 0
      ? null
      : assignees.length === 1
        ? assignees[0] === 'me'
          ? '내 할 일'
          : assignees[0] === 'none'
            ? '담당자 없음'
            : (assignees[0] === myEmail ? '내 할 일' : assignees[0].split('@')[0])
        : `담당자 ${assignees.length}명`;

  const tags = (allTags ?? []).filter((t) => t.id != null && tagIds.includes(t.id));
  const count = (assigneeLabel ? 1 : 0) + prios.length + (dueLabel ? 1 : 0) + tags.length;
  if (count === 0) return null;

  return (
    <View style={[styles.wrap, { borderBottomColor: theme.divider }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled">
        {assigneeLabel ? (
          <Chip label={assigneeLabel} onClear={onClearAssignees} theme={theme} />
        ) : null}

        {prios.map((p) => {
          const c = priorityColor(theme, p);
          return (
            <Chip
              key={p}
              label={PRIORITY_LABEL[p]}
              bg={c}
              fg={readableOn(c)}
              onClear={() => onTogglePrio(p)}
              theme={theme}
            />
          );
        })}

        {dueLabel ? <Chip label={dueLabel} onClear={onClearDue} theme={theme} /> : null}

        {tags.map((t) => {
          const c = t.color ?? theme.textTertiary;
          return (
            <Chip
              key={t.id}
              label={t.name ?? ''}
              bg={c}
              fg={readableOn(c)}
              onClear={() => onToggleTag(t.id!)}
              theme={theme}
            />
          );
        })}

        {/* 칩이 2개 이상일 때만 — 1개면 그 칩의 X가 곧 전체 해제라 중복이다 */}
        {count > 1 ? (
          <Press onPress={onClearAll} hitSlop={6} style={styles.clearAll}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              모두 해제
            </ThemedText>
          </Press>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  onClear,
  theme,
  bg,
  fg,
}: {
  label: string;
  onClear: () => void;
  theme: ReturnType<typeof useTheme>;
  /** 태그·우선순위처럼 고유색이 있는 축은 그 색으로 채운다 */
  bg?: string;
  fg?: string;
}) {
  const background = bg ?? theme.surfaceSelected;
  const foreground = fg ?? theme.text;
  return (
    <Press
      onPress={onClear}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${label} 필터 해제`}
      style={[styles.chip, { backgroundColor: background }]}>
      <ThemedText type="small" style={{ color: foreground }} numberOfLines={1}>
        {label}
      </ThemedText>
      <Ionicons name="close" size={13} color={foreground} />
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: 16, paddingVertical: space[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    maxWidth: 180,
  },
  clearAll: { paddingHorizontal: 6, paddingVertical: 5 },
});
