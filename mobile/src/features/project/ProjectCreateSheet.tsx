import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Project } from '@/features/project/api';
import { useCreateProject, useUpdateProject } from '@/features/project/queries';
import { PROJECT_ICON_KEYS, projectIcon } from '@/features/project/projectIcons';
import { BottomSheet } from '@/features/todo/todoPickers';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';

/** 기존 웹 ProjectCreateDialog 매칭 — 미리보기 + 이름 + 아이콘 + 색 선택. project 전달 시 수정 모드. */
export const PROJECT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#A855F7', '#EF4444', '#06B6D4', '#EC4899', '#84CC16', '#6366F1', '#F97316'];

export function ProjectCreateSheet({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const theme = useTheme();
  const create = useCreateProject();
  const update = useUpdateProject();
  const editing = project != null;
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [icon, setIcon] = useState('folder');

  // 시트 열릴 때 값 초기화/프리필 (열림 전환 시 1회)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? '');
    setColor(project?.color ?? PROJECT_COLORS[0]);
    setIcon(project?.icon ?? 'folder');
  }, [open, project]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onSubmit = () => {
    const n = name.trim();
    if (!n) return;
    if (editing && project?.id != null) {
      update.mutate({ id: project.id, name: n, color, icon }, { onSuccess: onClose });
    } else {
      create.mutate({ name: n, color, icon }, { onSuccess: onClose });
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled">
        <ThemedText type="label" style={styles.title}>
          {editing ? '프로젝트 수정' : '새 프로젝트'}
        </ThemedText>

        {/* 미리보기 */}
        <View style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.previewIcon, { backgroundColor: color }]}>
            <Ionicons name={projectIcon(icon)} size={18} color="#fff" />
          </View>
          <ThemedText type="default" style={{ color: name.trim() ? theme.text : theme.textSecondary, fontWeight: '700' }}>
            {name.trim() || '프로젝트 이름'}
          </ThemedText>
        </View>

        <ThemedText type="small" style={[styles.cap, { color: theme.textSecondary }]}>
          이름
        </ThemedText>
        <TextField placeholder="프로젝트 이름" value={name} onChangeText={setName} autoFocus onSubmitEditing={onSubmit} />

        <ThemedText type="small" style={[styles.cap, { color: theme.textSecondary }]}>
          아이콘
        </ThemedText>
        <View style={styles.icons}>
          {PROJECT_ICON_KEYS.map((it) => {
            const sel = it.key === icon;
            return (
              <Pressable
                key={it.key}
                onPress={() => setIcon(it.key)}
                style={[styles.iconCell, { borderColor: sel ? color : theme.border, backgroundColor: sel ? color + '1F' : 'transparent' }]}>
                <Ionicons name={it.icon} size={20} color={sel ? color : theme.textSecondary} />
              </Pressable>
            );
          })}
        </View>

        <ThemedText type="small" style={[styles.cap, { color: theme.textSecondary }]}>
          색상
        </ThemedText>
        <View style={styles.colors}>
          {PROJECT_COLORS.map((c) => {
            const sel = c === color;
            return (
              <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, sel && styles.swatchSel]}>
                {sel ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </Pressable>
            );
          })}
        </View>

        <Button title={busy ? '저장 중…' : editing ? '저장' : '프로젝트 추가'} onPress={onSubmit} style={styles.add} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // 시트 maxHeight(키보드 시 축소) 안에서 줄어들며 스크롤되도록
  bodyScroll: { flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  title: { marginBottom: 2 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14 },
  previewIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cap: { fontWeight: '700', marginTop: 4 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: { width: 40, height: 40, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  swatchSel: { borderWidth: 2, borderColor: '#fff' },
  add: { marginTop: 8 },
});
