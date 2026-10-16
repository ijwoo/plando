import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/features/todo/todoPickers';
import {
  useCreateStatus,
  useDeleteStatus,
  useReorderStatuses,
  useSetDefaultStatus,
  useStatuses,
  useUpdateStatus,
} from '@/features/status/queries';
import { useWorkspacePermissions } from '@/features/workspace/permissions';
import { SettingsShell } from '@/features/settings/shared';
import { useTheme } from '@/hooks/use-theme';
import type { WorkflowStatusLite } from '@/api/typesExt';
import { ListGroup, ListSectionHeader } from '@/shared/ui/List';
import { tickHaptic } from '@/shared/ui/haptics';
import { readableOn } from '@/shared/ui/tone';

const CAT_LABEL: Record<string, string> = { TODO: '미시작', IN_PROGRESS: '진행 중', DONE: '완료' };
const CAT_ORDER = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
// 상태 색 팔레트 — StatusPicker와 동일 세트
const COLORS = ['#94A3B8', '#3070EB', '#22B8A6', '#F59E0B', '#7C3AED', '#EC4899', '#0EA5E9', '#E5484D'];

/** 설정 > 워크플로우 상태 — 라벨·색 수정, 순서 변경(위/아래), 기본값 지정, 삭제(재배정). 웹 ManageStatusesDialog 미러. */
export default function StatusManageScreen() {
  const theme = useTheme();
  const { data: statuses, isLoading, isError, error } = useStatuses();
  const update = useUpdateStatus();
  const reorder = useReorderStatuses();
  const setDefault = useSetDefaultStatus();
  const del = useDeleteStatus();
  const create = useCreateStatus();
  // 상태 정의 변경은 ADMIN 이상 (StatusPicker의 생성 UI와 동일 기준)
  const { canManageWorkspace } = useWorkspacePermissions();

  const [editing, setEditing] = useState<WorkflowStatusLite | null>(null);
  const [creating, setCreating] = useState(false);

  // 현재 순서(정렬된 전체) — 위/아래 이동 시 인접 스왑 후 reorder 호출
  const ordered = useMemo(() => [...(statuses ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [statuses]);

  // 순서 이동은 같은 구분(미시작/진행 중/완료) 안에서만 한다.
  // 화면이 구분별로 묶여 있어서, 전체 목록 기준으로 인접 스왑하면 구분 경계에서는
  // 서버만 다녀오고 그룹 안 순서는 그대로였다 — 눌러도 아무 일도 안 하는 버튼처럼 보였다.
  // (구분 자체는 편집 시트에서 바꿀 수 없으므로 구분을 넘나드는 이동은 의미가 없다.)
  const move = (group: { s: WorkflowStatusLite; idx: number }[], i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= group.length) return; // 그룹 양 끝 버튼은 disabled — 여기 오지 않는다
    tickHaptic();
    // 전체 순서 배열에서 두 항목의 자리를 맞바꾼다(그룹 안에서만 앞뒤가 뒤집힌다)
    const ids = ordered.map((s) => s.id);
    [ids[group[i].idx], ids[group[to].idx]] = [ids[group[to].idx], ids[group[i].idx]];
    reorder.mutate(ids);
  };

  const onDelete = (s: WorkflowStatusLite) => {
    // 삭제 시 이 상태의 할 일을 어디로 옮길지 — 같은 카테고리의 다른 상태 우선, 없으면 첫 상태
    const others = ordered.filter((o) => o.id !== s.id);
    if (!others.length) {
      Alert.alert('삭제할 수 없어요', '상태는 최소 1개 이상 있어야 해요.');
      return;
    }
    const reassign = others.find((o) => o.category === s.category) ?? others[0];
    Alert.alert(
      '상태 삭제',
      `"${s.label}" 상태를 삭제하면 이 상태의 할 일은 "${reassign.label}"(으)로 옮겨져요. 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => del.mutate({ id: s.id, reassignTo: reassign.statusKey }) },
      ],
    );
  };

  // 카테고리별 그룹 렌더 (순서는 sortOrder 유지)
  const grouped = useMemo(() => {
    const g: Record<string, { s: WorkflowStatusLite; idx: number }[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    ordered.forEach((s, idx) => (g[s.category] ??= []).push({ s, idx }));
    return g;
  }, [ordered]);

  return (
    <SettingsShell title="워크플로우 상태" loading={isLoading} error={isError ? error : undefined}>
      {statuses ? (
        <>
          <ThemedText type="small" style={[styles.help, { color: theme.textSecondary }]}>
            할 일의 상태를 팀에 맞게 정의해요. 이름과 색을 바꾸거나 순서를 조정하고, 기본 상태를 지정할 수 있어요.
          </ThemedText>
          {CAT_ORDER.map((cat) =>
            grouped[cat]?.length ? (
              <View key={cat}>
                <ListSectionHeader>{CAT_LABEL[cat]}</ListSectionHeader>
                <ListGroup>
                  {grouped[cat].map(({ s }, i) => {
                    const color = s.color ?? theme.textTertiary;
                    const isFirst = i === 0;
                    const isLast = i === grouped[cat].length - 1;
                    return (
                      <View
                        key={s.id}
                        style={[styles.row, { borderBottomColor: theme.divider }, isLast && styles.rowLast]}>
                        <View style={[styles.dot, { backgroundColor: color }]} />
                        <Pressable style={styles.rowMain} onPress={() => setEditing(s)}>
                          <ThemedText type="default" numberOfLines={1} style={styles.label}>
                            {s.label}
                          </ThemedText>
                          {s.isDefault ? (
                            <View style={[styles.defBadge, { backgroundColor: theme.primarySoft }]}>
                              <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700', fontSize: 11 }}>
                                기본
                              </ThemedText>
                            </View>
                          ) : null}
                        </Pressable>
                        {/* 순서 이동 — 같은 구분 안에서만, 양 끝은 흐리게 비활성 */}
                        <Pressable onPress={() => move(grouped[cat], i, -1)} disabled={isFirst} hitSlop={6} style={styles.iconBtn}>
                          <Ionicons name="chevron-up" size={18} color={isFirst ? theme.textTertiary : theme.textSecondary} />
                        </Pressable>
                        <Pressable onPress={() => move(grouped[cat], i, 1)} disabled={isLast} hitSlop={6} style={styles.iconBtn}>
                          <Ionicons name="chevron-down" size={18} color={isLast ? theme.textTertiary : theme.textSecondary} />
                        </Pressable>
                        <Pressable onPress={() => setEditing(s)} hitSlop={6} style={styles.iconBtn}>
                          <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                    );
                  })}
                </ListGroup>
              </View>
            ) : null,
          )}

          {/* 새 상태 추가 — 상태 정의 변경은 ADMIN 이상 */}
          {canManageWorkspace ? (
            <ListGroup>
              <Pressable
                onPress={() => {
                  tickHaptic();
                  setCreating(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="새 상태 추가"
                style={[styles.row, styles.rowLast]}>
                <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                <ThemedText type="default" style={[styles.label, { color: theme.primary, fontWeight: '600', marginLeft: 10 }]}>
                  새 상태 추가
                </ThemedText>
              </Pressable>
            </ListGroup>
          ) : null}
        </>
      ) : null}

      <CreateStatusSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(input) => {
          create.mutate(input);
          setCreating(false);
        }}
      />

      <EditStatusSheet
        status={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) update.mutate({ id: editing.id, patch });
          setEditing(null);
        }}
        onSetDefault={() => {
          if (editing && !editing.isDefault) setDefault.mutate(editing.id);
          setEditing(null);
        }}
        onDelete={() => {
          const s = editing;
          setEditing(null);
          if (s) onDelete(s);
        }}
      />
    </SettingsShell>
  );
}

/** 새 상태 만들기 — 카테고리(할 일/진행 중/완료) + 이름 + 색. 카테고리가 완료면 그 상태로 옮긴 할 일은 완료로 집계된다. */
function CreateStatusSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { label: string; category: (typeof CAT_ORDER)[number]; color: string }) => void;
}) {
  const theme = useTheme();
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<(typeof CAT_ORDER)[number]>('IN_PROGRESS');
  const [color, setColor] = useState(COLORS[3]);

  // 시트가 열릴 때마다 입력 초기화
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLabel('');
      setCategory('IN_PROGRESS');
      setColor(COLORS[3]);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={styles.sheet}>
        <ThemedText type="subtitle">새 상태</ThemedText>

        <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          구분
        </ThemedText>
        <View style={styles.catPick}>
          {CAT_ORDER.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                tickHaptic();
                setCategory(c);
              }}
              style={[styles.catChip, { borderColor: theme.border, backgroundColor: category === c ? theme.primary : 'transparent' }]}>
              <ThemedText
                type="small"
                style={{ color: category === c ? readableOn(theme.primary) : theme.textSecondary, fontWeight: '600' }}>
                {CAT_LABEL[c]}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          이름
        </ThemedText>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="상태 이름 (예: 검수완료)"
          placeholderTextColor={theme.textTertiary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
          maxLength={20}
        />

        <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          색상
        </ThemedText>
        <View style={styles.swatches}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                tickHaptic();
                setColor(c);
              }}
              style={[styles.swatch, { backgroundColor: c }, color === c && { borderColor: theme.text, borderWidth: 3 }]}>
              {color === c ? <Ionicons name="checkmark" size={16} color={readableOn(c)} /> : null}
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => label.trim() && onCreate({ label: label.trim(), category, color })}
          disabled={!label.trim()}
          style={[styles.saveBtn, { backgroundColor: label.trim() ? theme.primary : theme.surfaceAlt }]}>
          <ThemedText type="default" style={[styles.saveText, !label.trim() && { color: theme.textTertiary }]}>
            만들기
          </ThemedText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function EditStatusSheet({
  status,
  onClose,
  onSave,
  onSetDefault,
  onDelete,
}: {
  status: WorkflowStatusLite | null;
  onClose: () => void;
  onSave: (patch: { label: string; color: string }) => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  // 시트가 열릴 때 현재 값 주입 (status 변경 = 다른 상태 편집 시작)
  const key = status?.id ?? -1;
  const [syncedKey, setSyncedKey] = useState(-1);
  if (key !== syncedKey && status) {
    setSyncedKey(key);
    setLabel(status.label);
    setColor(status.color ?? COLORS[0]);
  }

  return (
    <BottomSheet open={status != null} onClose={onClose}>
      {status ? (
        <View style={styles.sheet}>
          <ThemedText type="subtitle">상태 편집</ThemedText>

          <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            이름
          </ThemedText>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="상태 이름"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
            maxLength={20}
          />

          <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            색상
          </ThemedText>
          <View style={styles.swatches}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  tickHaptic();
                  setColor(c);
                }}
                style={[styles.swatch, { backgroundColor: c }, color === c && { borderColor: theme.text, borderWidth: 3 }]}>
                {color === c ? <Ionicons name="checkmark" size={16} color={readableOn(c)} /> : null}
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => label.trim() && onSave({ label: label.trim(), color })}
            style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
            <ThemedText type="default" style={styles.saveText}>
              저장
            </ThemedText>
          </Pressable>

          <View style={styles.secondaryRow}>
            {!status.isDefault ? (
              <Pressable accessibilityRole="button" accessibilityLabel="기본 상태로 지정" onPress={onSetDefault} style={styles.secondaryBtn}>
                <Ionicons name="star-outline" size={16} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: '600' }}>
                  기본 상태로
                </ThemedText>
              </Pressable>
            ) : (
              <View style={styles.secondaryBtn} />
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="상태 삭제" onPress={onDelete} style={styles.secondaryBtn}>
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
              <ThemedText type="small" style={{ color: theme.danger, fontWeight: '600' }}>
                삭제
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  help: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLast: { borderBottomWidth: 0 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flexShrink: 1 },
  defBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  iconBtn: { padding: 4 },
  // edit sheet
  sheet: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  fieldLabel: { marginTop: 8, fontWeight: '600' },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { marginTop: 14, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  // create sheet — 카테고리 선택 칩 (StatusPicker와 동일 톤)
  catPick: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  secondaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 4, minWidth: 90, justifyContent: 'center' },
});
