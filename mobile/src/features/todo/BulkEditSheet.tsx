import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWorkspaceMembers } from '@/features/workspace/queries';
import { useProjects } from '@/features/project/queries';
import { projectIcon } from '@/features/project/projectIcons';
import { Avatar } from '@/shared/ui/Avatar';
import { BottomSheet, CompactDate } from '@/features/todo/todoPickers';
import { toDateString } from '@/shared/utils/datetime';
import { useTheme } from '@/hooks/use-theme';
import { priorityColor, PRIORITY_LABEL, PRIORITY_OPTIONS, readableOn, type TodoPriority } from '@/shared/ui/tone';

/** 다중 선택 일괄 편집 시트 — 우선순위·담당자·마감·프로젝트. 적용 시 해당 콜백 호출 후 닫힘. */
export function BulkEditSheet({
  open,
  onClose,
  count,
  onPriority,
  onAssignees,
  onDue,
  onProject,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  onPriority: (p: TodoPriority) => void;
  onAssignees: (emails: string[]) => void;
  onDue: (date?: string) => void;
  onProject: (projectId: number) => void;
}) {
  const theme = useTheme();
  const { data: members } = useWorkspaceMembers();
  const { data: projects } = useProjects();
  const [assignSel, setAssignSel] = useState<string[]>([]);
  // 마감일은 "고르고 → 적용" 2단계. 예전엔 값 없는 CompactDate를 그대로 써서 탭하는 순간
  // 오늘 날짜가 적용되고 시트가 닫혔다 — 다른 날짜를 고를 방법이 아예 없었다.
  const [due, setDue] = useState(() => toDateString(new Date()));

  const close = () => {
    setAssignSel([]);
    setDue(toDateString(new Date()));
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close}>
      <ThemedText type="label" style={styles.title}>
        {count}개 일괄 편집
      </ThemedText>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 우선순위 */}
        <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>우선순위</ThemedText>
        <View style={styles.chips}>
          {PRIORITY_OPTIONS.map((o) => {
            const c = priorityColor(theme, o.value);
            return (
              <Pressable key={o.value} onPress={() => { onPriority(o.value); close(); }} style={[styles.chip, { backgroundColor: c + '1A', borderColor: c }]}>
                <Ionicons name="flag" size={12} color={c} />
                <ThemedText type="small" style={{ color: c, fontWeight: '700' }}>{PRIORITY_LABEL[o.value]}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* 마감일 */}
        <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>마감일</ThemedText>
        <View style={styles.dueRow}>
          <View style={[styles.dueBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <CompactDate value={due} onChange={(d) => d && setDue(d)} />
          </View>
          <Pressable onPress={() => { onDue(due); close(); }} style={[styles.dueApply, { backgroundColor: theme.primary }]}>
            <ThemedText type="small" style={{ color: readableOn(theme.primary), fontWeight: '700' }}>마감 적용</ThemedText>
          </Pressable>
          <Pressable onPress={() => { onDue(undefined); close(); }} style={[styles.clearBtn, { borderColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>마감 제거</ThemedText>
          </Pressable>
        </View>

        {/* 프로젝트 이동 */}
        <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>프로젝트 이동</ThemedText>
        <View style={styles.chips}>
          <Pressable onPress={() => { onProject(0); close(); }} style={[styles.projChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <Ionicons name="file-tray-outline" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.text, fontWeight: '600' }}>인박스</ThemedText>
          </Pressable>
          {(projects ?? []).map((p) => (
            <Pressable key={p.id} onPress={() => { if (p.id != null) { onProject(p.id); close(); } }} style={[styles.projChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <View style={[styles.projBadge, { backgroundColor: p.color ?? theme.textTertiary }]}>
                <Ionicons name={projectIcon(p.icon)} size={10} color="#fff" />
              </View>
              <ThemedText type="small" style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>{p.name ?? '프로젝트'}</ThemedText>
            </Pressable>
          ))}
        </View>

        {/* 담당자 (다중 선택 후 적용) */}
        <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>담당자</ThemedText>
        <View style={styles.memberList}>
          {members?.map((m) => {
            const on = !!m.email && assignSel.includes(m.email);
            return (
              <Pressable
                key={m.userId}
                onPress={() => m.email && setAssignSel((prev) => (prev.includes(m.email!) ? prev.filter((e) => e !== m.email) : [...prev, m.email!]))}
                style={[styles.member, on && { backgroundColor: theme.primary + '14' }]}>
                <Avatar person={m} size={32} />
                <ThemedText type="default" style={styles.flex} numberOfLines={1}>{m.name ?? m.email}</ThemedText>
                {on ? <Ionicons name="checkmark-circle" size={20} color={theme.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => { onAssignees(assignSel); close(); }}
          style={[styles.apply, { backgroundColor: theme.primary }]}>
          <ThemedText type="default" style={[styles.applyText, { color: readableOn(theme.primary) }]}>담당자 적용{assignSel.length ? ` (${assignSel.length})` : ' · 모두 비우기'}</ThemedText>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { textAlign: 'center', fontWeight: '700', marginBottom: 6 },
  scroll: { maxHeight: 460 },
  section: { fontWeight: '700', paddingHorizontal: 16, marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  projChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%' },
  projBadge: { width: 16, height: 16, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  dueRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  dueBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 4, paddingVertical: 3, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  dueApply: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  memberList: { paddingHorizontal: 10, gap: 2 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  flex: { flex: 1 },
  apply: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  applyText: { fontWeight: '700' },
});
