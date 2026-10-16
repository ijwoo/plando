import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useProjects } from '@/features/project/queries';
import { AssigneePickerSheet } from '@/features/todo/AssigneeSection';
import { useCreateTodo } from '@/features/todo/queries';
import { BottomSheet, DateRow, SelectRow } from '@/features/todo/todoPickers';
import { useTheme } from '@/hooks/use-theme';
import { Button as AppButton } from '@/shared/ui/Button';
import { Segmented } from '@/shared/ui/Segmented';
import { toast } from '@/shared/ui/toast';
import { PRIORITY_OPTIONS, type TodoPriority } from '@/shared/ui/tone';

import { acceptSuggestion, dismissSuggestion, type DmMessage, type DmTodoSuggestion } from './api';

/** "M월 D일" 짧은 표기 (없으면 null) */
function shortDate(iso?: string | null): string | null {
  if (!iso) return null;
  const [, m, d] = iso.split('-').map(Number);
  return m && d ? `${m}월 ${d}일` : null;
}

/**
 * DM 말풍선 아래 "할 일로 만들까요?" 제안 칩 + 확인 시트.
 * 시트에서 제목·마감·우선순위·담당자·프로젝트 수정 후 기존 할 일 생성 API로 만들고
 * todoId를 제안에 연결(원본 메시지에 linkedTodo 카드가 뜬다).
 */
export function TodoSuggestionCard({
  suggestion,
  onAccepted,
  onDismissed,
}: {
  suggestion: DmTodoSuggestion;
  /** 서버가 돌려준 갱신 메시지(linkedTodoId 포함) — 캐시 upsert용 */
  onAccepted: (updated: DmMessage, suggestionId: number) => void;
  onDismissed: (suggestionId: number) => void;
}) {
  const theme = useTheme();
  const create = useCreateTodo();
  const { data: projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(suggestion.title);
  const [dueDate, setDueDate] = useState<string | undefined>(suggestion.dueDate ?? undefined);
  const [priority, setPriority] = useState<TodoPriority>('MEDIUM');
  const [assignees, setAssignees] = useState<string[]>(suggestion.ownerEmail ? [suggestion.ownerEmail] : []);
  const [projectId, setProjectId] = useState<number>(0);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gone, setGone] = useState(false); // 낙관적 숨김 (WS 이벤트 도착 전)

  if (gone) return null;

  const onDismiss = () => {
    setGone(true);
    dismissSuggestion(suggestion.id)
      .then(() => onDismissed(suggestion.id))
      .catch(() => setGone(false)); // 실패 토스트는 전역 처리
  };

  const onConfirm = async () => {
    if (saving) return;
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    try {
      const todo = await create.mutateAsync({
        title: t,
        // status 생략 — useCreateTodo 가 워크스페이스 기본 상태를 채운다
        priority,
        dueDate: dueDate || undefined,
        assignees: assignees.length ? assignees : undefined,
        projectId: projectId > 0 ? projectId : undefined,
      });
      if (todo.id == null) throw new Error('생성된 할 일 id 없음');
      const updated = await acceptSuggestion(suggestion.id, todo.id);
      setOpen(false);
      setGone(true);
      onAccepted(updated, suggestion.id);
      toast.success('할 일을 만들었어요');
    } catch {
      // 실패 토스트는 전역 mutation/응답 처리에 맡기고 상태만 복구
    } finally {
      setSaving(false);
    }
  };

  const due = shortDate(suggestion.dueDate);
  const projectOptions = [
    { value: 0, label: '없음' },
    ...(projects ?? []).filter((p) => p.id != null).map((p) => ({ value: p.id!, label: p.name ?? '프로젝트' })),
  ];
  const assigneeLabel = assignees.length
    ? assignees.length === 1
      ? assignees[0]
      : `${assignees[0]} 외 ${assignees.length - 1}명`
    : '없음';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel="할 일로 만들기 제안"
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: theme.primary + '10', borderColor: theme.primary + '2E' },
          pressed && { opacity: 0.7 },
        ]}>
        <Ionicons name="sparkles" size={13} color={theme.primary} />
        <ThemedText type="small" style={[styles.chipText, { color: theme.primary }]} numberOfLines={1}>
          할 일로 만들까요? — {suggestion.title}
          {due ? ` · ${due}` : ''}
        </ThemedText>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="제안 닫기" style={styles.close}>
          <Ionicons name="close" size={14} color={theme.textTertiary} />
        </Pressable>
      </Pressable>

      {/* 확인 시트 — 제목/마감/우선순위/담당자/프로젝트 */}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <View style={styles.sheetBody}>
          <View style={styles.sheetHeader}>
            <Ionicons name="sparkles" size={15} color={theme.primary} />
            <ThemedText type="label">대화에서 찾은 할 일</ThemedText>
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="할 일 제목"
            placeholderTextColor={theme.textTertiary}
            style={[styles.titleInput, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
          />
          <Segmented options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
          <View style={[styles.rows, { backgroundColor: theme.surfaceAlt }]}>
            <DateRow icon="calendar-outline" label="마감일" value={dueDate} onChange={setDueDate} />
            <SelectRow icon="folder-outline" label="프로젝트" title="프로젝트" value={projectId} options={projectOptions} onChange={setProjectId} />
            <Pressable
              onPress={() => setAssigneeOpen(true)}
              accessibilityLabel="담당자 선택"
              style={({ pressed }) => [styles.assigneeRow, pressed && { opacity: 0.6 }]}>
              <Ionicons name="person-outline" size={17} color={theme.textSecondary} />
              <ThemedText type="default" style={styles.assigneeLabel}>
                담당자
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                {assigneeLabel}
              </ThemedText>
              <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
            </Pressable>
          </View>
          <AppButton title={saving ? '추가 중…' : '할 일 추가'} onPress={onConfirm} disabled={saving || !title.trim()} />
        </View>
      </BottomSheet>

      <AssigneePickerSheet open={assigneeOpen} onClose={() => setAssigneeOpen(false)} value={assignees} onChange={setAssignees} />
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
    marginTop: 6,
    marginHorizontal: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { flex: 1, fontWeight: '600' },
  close: { padding: 2 },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  rows: { borderRadius: 12, paddingHorizontal: 4 },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  assigneeLabel: { flex: 1 },
});
