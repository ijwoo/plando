import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BottomSheet } from '@/features/todo/todoPickers';
import { readableOn } from '@/shared/ui/tone';
import { tickHaptic } from '@/shared/ui/haptics';
import { useCreateStatus, useStatusMap, useStatuses } from './queries';
import { useWorkspacePermissions } from '@/features/workspace/permissions';

const CAT_LABEL: Record<string, string> = { TODO: '미시작', IN_PROGRESS: '진행', DONE: '완료' };
const CAT_ORDER = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
const NEW_COLORS = ['#94A3B8', '#3070EB', '#22B8A6', '#F59E0B', '#7C3AED', '#EC4899', '#0EA5E9', '#E5484D'];

/** 상세 화면 상태 행 — 현재 상태 칩 + (편집 가능 시) 동적 상태 피커(선택/생성). */
export function StatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (statusKey: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const { data: statuses } = useStatuses();
  const sm = useStatusMap();
  const { canManageWorkspace } = useWorkspacePermissions();
  const createStatus = useCreateStatus();
  const [draft, setDraft] = useState('');
  const [newCat, setNewCat] = useState<'TODO' | 'IN_PROGRESS' | 'DONE'>('IN_PROGRESS');
  // 시트 maxHeight(70%)에서 핸들·하단 여백을 뺀 만큼만 스크롤 — 짧으면 시트도 딱 맞게 줄어든다
  const { height: winH } = useWindowDimensions();
  const sheetMaxH = winH * 0.7 - 70;

  const curColor = sm.color(value) ?? theme.textTertiary;
  const grouped = useMemo(() => {
    const g: Record<string, typeof statuses> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    for (const s of statuses ?? []) (g[s.category] ??= []).push(s);
    return g;
  }, [statuses]);

  const pick = (key: string) => {
    tickHaptic();
    onChange(key);
    setOpen(false);
  };
  const onCreate = async () => {
    const label = draft.trim();
    if (!label) return;
    const color = NEW_COLORS[(statuses?.length ?? 0) % NEW_COLORS.length];
    const created = await createStatus.mutateAsync({ label, category: newCat, color });
    setDraft('');
    onChange(created.statusKey);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        disabled={disabled}
        style={styles.row}>
        <Ionicons name="ellipse" size={16} color={curColor} style={styles.rowIcon} />
        <ThemedText type="default" style={styles.rowLabel}>
          상태
        </ThemedText>
        <View style={[styles.chip, { backgroundColor: curColor + '22' }]}>
          <ThemedText type="small" style={{ color: theme.text, fontWeight: '600' }}>
            {sm.label(value) || '할 일'}
          </ThemedText>
        </View>
        {!disabled ? <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} /> : null}
      </Pressable>

      {open ? (
        <BottomSheet open onClose={() => setOpen(false)}>
          {/* 상태가 많으면 시트 maxHeight(70%)를 넘겨 하단 '새 상태 만들기'가 잘리므로 스크롤 */}
          <ScrollView
            style={[styles.sheetScroll, { maxHeight: sheetMaxH }]}
            contentContainerStyle={styles.sheet}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled">
            <ThemedText type="default" style={styles.sheetTitle}>
              상태 선택
            </ThemedText>
            {CAT_ORDER.map((cat) =>
              (grouped[cat]?.length ?? 0) > 0 ? (
                <View key={cat} style={styles.catBlock}>
                  <ThemedText type="small" style={[styles.catLabel, { color: theme.textTertiary }]}>
                    {CAT_LABEL[cat]}
                  </ThemedText>
                  {grouped[cat]!.map((s) => {
                    const c = s.color ?? theme.textTertiary;
                    const on = s.statusKey === value;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => pick(s.statusKey)}
                        style={({ pressed }) => [styles.pickRow, pressed && { backgroundColor: theme.surfaceSelected }]}>
                        <View style={[styles.dot, { backgroundColor: c }]} />
                        <ThemedText type="default" style={styles.flex} numberOfLines={1}>
                          {s.label}
                        </ThemedText>
                        {on ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null,
            )}

            {/* 새 상태 만들기 — 상태 정의는 워크스페이스 설정(ADMIN 이상)에게만 노출 */}
            {canManageWorkspace ? (
            <View style={styles.createBlock}>
              <ThemedText type="small" style={[styles.catLabel, { color: theme.textTertiary }]}>
                새 상태 만들기
              </ThemedText>
              <View style={styles.catPick}>
                {CAT_ORDER.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setNewCat(cat)}
                    style={[
                      styles.catChip,
                      { borderColor: theme.border, backgroundColor: newCat === cat ? theme.primary : 'transparent' },
                    ]}>
                    <ThemedText type="small" style={{ color: newCat === cat ? readableOn(theme.primary) : theme.textSecondary, fontWeight: '600' }}>
                      {CAT_LABEL[cat]}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <View style={[styles.createRow, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="add" size={18} color={theme.textSecondary} />
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="상태 이름 (예: 검토중)"
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.createInput, { color: theme.text }]}
                  onSubmitEditing={onCreate}
                  returnKeyType="done"
                  maxLength={64}
                />
                {draft.trim() ? (
                  <Pressable onPress={onCreate} hitSlop={8}>
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                      만들기
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </View>
            ) : null}
          </ScrollView>
        </BottomSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // ListRow dense와 동일 규격(상세 속성 카드 정렬 일치): pH 16, 아이콘 width 20
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 },
  rowIcon: { width: 20, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 16 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sheetScroll: { flexShrink: 1 }, // 시트 maxHeight 안에서 줄어들며 스크롤
  sheet: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 },
  sheetTitle: { fontWeight: '800', fontSize: 18 },
  catBlock: { gap: 2 },
  catLabel: { fontWeight: '700', marginTop: 6, marginBottom: 2 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 6, borderRadius: 8 },
  createBlock: { gap: 8, marginTop: 4 },
  catPick: { flexDirection: 'row', gap: 6 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, paddingHorizontal: 12 },
  createInput: { flex: 1, fontSize: 15 },
});
