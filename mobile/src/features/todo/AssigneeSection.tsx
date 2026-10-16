import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWorkspaceMembers } from '@/features/workspace/queries';
import { useTheme } from '@/hooks/use-theme';
import { Avatar, AvatarStack } from '@/shared/ui/Avatar';
import { BottomSheet } from '@/features/todo/todoPickers';

/** 담당자 멤버 선택 시트 — AssigneeSection·인라인 빠른 추가 등에서 공용 */
export function AssigneePickerSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (emails: string[]) => void;
}) {
  const theme = useTheme();
  const { data: members } = useWorkspaceMembers();
  const toggle = (email: string) => {
    onChange(value.includes(email) ? value.filter((e) => e !== email) : [...value, email]);
  };
  return (
    <BottomSheet open={open} onClose={onClose}>
      <ThemedText type="label" style={styles.sheetTitle}>
        담당자
      </ThemedText>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {members?.map((m) => {
          const active = !!m.email && value.includes(m.email);
          return (
            <Pressable
              key={m.userId}
              onPress={() => m.email && toggle(m.email)}
              style={[styles.member, active && { backgroundColor: theme.primary + '1A' }]}>
              <Avatar person={m} size={34} />
              <View style={styles.body}>
                <ThemedText type="default" numberOfLines={1}>
                  {m.name ?? m.email}
                </ThemedText>
                {m.name ? (
                  <ThemedText type="small" style={styles.empty} numberOfLines={1}>
                    {m.email}
                  </ThemedText>
                ) : null}
              </View>
              {active ? <Ionicons name="checkmark-circle" size={22} color={theme.primary} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

/** 담당자 선택 — 워크스페이스 멤버 다중 선택(이메일). 트리거는 아바타 스택(많아도 안 깨짐), 시트는 공용 BottomSheet. */
export function AssigneeSection({ value, onChange }: { value: string[]; onChange: (emails: string[]) => void }) {
  const theme = useTheme();
  const { data: members } = useWorkspaceMembers();
  const [open, setOpen] = useState(false);

  const selected = members?.filter((m) => m.email && value.includes(m.email)) ?? [];

  return (
    <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
      {selected.length > 0 ? (
        <AvatarStack people={selected} size={28} />
      ) : (
        <ThemedText type="small" style={styles.empty}>
          담당자 없음
        </ThemedText>
      )}
      <View style={[styles.addChip, { borderColor: theme.border }]}>
        <Ionicons name="add" size={16} color={theme.textSecondary} />
      </View>
      <AssigneePickerSheet open={open} onClose={() => setOpen(false)} value={value} onChange={onChange} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { opacity: 0.5 },
  addChip: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { textAlign: 'center', fontWeight: '700', marginBottom: 12 },
  list: { maxHeight: 400, paddingHorizontal: 10 },
  listContent: { paddingBottom: 8, gap: 2 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  body: { flex: 1, gap: 2 },
});
