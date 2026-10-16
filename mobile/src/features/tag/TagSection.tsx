import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BottomSheet } from '@/features/todo/todoPickers';
import { readableOn } from '@/shared/ui/tone';
import { tickHaptic } from '@/shared/ui/haptics';
import type { TagLite } from '@/api/typesExt';
import { useCreateTag, useSetTodoTags, useTags } from './queries';
import { useTagManage } from './useTagManage';

/** 새 태그 기본 색 팔레트 — 순서대로 배정 */
const TAG_COLORS = ['#E5484D', '#F59E0B', '#22A06B', '#3D7BFF', '#7C3AED', '#EC4899', '#0EA5E9', '#64748B'];

export function TagChip({
  tag,
  theme,
  selected,
  style,
  onPress,
}: {
  tag: TagLite;
  theme: ReturnType<typeof useTheme>;
  /** 필터 시트에서 선택된 태그 — 다른 필터 축(담당·우선순위)처럼 축 색으로 꽉 채운다 */
  selected?: boolean;
  /** 호출부 칩 규격 맞춤용(예: 필터 시트의 칩 패딩) */
  style?: StyleProp<ViewStyle>;
  /** 주면 누를 수 있는 칩이 된다(할 일 상세 → 그 태그의 목록으로 이동) */
  onPress?: () => void;
}) {
  const color = tag.color ?? theme.textTertiary;
  // 태그 색은 데이터에서 오므로 명도가 제각각 — 채웠을 때 글자색은 readableOn으로 결정
  const fg = selected ? readableOn(color) : theme.text;
  const body = (
    <>
      <View style={[styles.dot, { backgroundColor: selected ? fg : color }]} />
      <ThemedText type="small" style={[styles.chipText, { color: fg }]} numberOfLines={1}>
        {tag.name}
      </ThemedText>
    </>
  );
  const chipStyle = [
    styles.chip,
    { backgroundColor: selected ? color : color + '22', borderColor: selected ? color : color + '55' },
    style,
  ];
  // onPress가 있을 때만 누를 수 있게 — 필터 시트처럼 바깥에서 이미 Pressable로 감싼 곳에서는
  // 중첩 터치가 되지 않도록 그대로 View로 둔다.
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${tag.name} 태그가 붙은 할 일 보기`}
        style={({ pressed }) => [...chipStyle, pressed && { opacity: 0.6 }]}>
        {body}
      </Pressable>
    );
  }
  return <View style={chipStyle}>{body}</View>;
}

/** 할 일 상세의 태그 섹션 — 칩 표시 + (편집 가능 시) 피커로 부착/생성 */
export function TagSection({
  todoId,
  tags,
  readonly,
}: {
  todoId: number;
  tags: TagLite[];
  readonly?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: all } = useTags();
  const createTag = useCreateTag();
  const setTags = useSetTodoTags();
  const tagManage = useTagManage();
  const [draft, setDraft] = useState('');
  // 피커 열릴 때 현재 부착 태그로 초기화되는 로컬 선택 집합
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const openPicker = () => {
    setSelected(new Set((tags ?? []).map((t) => t.id)));
    setDraft('');
    setOpen(true);
  };
  const toggle = (id: number) => {
    tickHaptic();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const onCreate = async () => {
    const name = draft.trim();
    if (!name) return;
    const color = TAG_COLORS[(all?.length ?? 0) % TAG_COLORS.length];
    const created = await createTag.mutateAsync({ name, color });
    setDraft('');
    setSelected((prev) => new Set(prev).add(created.id));
  };
  const onApply = () => {
    setTags.mutate({ todoId, tagIds: [...selected] });
    setOpen(false);
  };

  const sortedAll = useMemo(
    () => [...(all ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [all],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
          태그
        </ThemedText>
        {!readonly ? (
          <Pressable onPress={openPicker} hitSlop={8} accessibilityLabel="태그 편집">
            <Ionicons name="pricetags-outline" size={18} color={theme.primary} />
          </Pressable>
        ) : null}
      </View>

      {tags?.length ? (
        <View style={styles.chips}>
          {tags.map((t) => (
            <TagChip
              key={t.id}
              tag={t}
              theme={theme}
              /* 태그를 누르면 그 태그가 붙은 할 일 목록으로. 예전엔 태그를 붙여만 두고
                 활용하려면 목록 → 필터 → 태그 3단계를 거쳐야 했다.
                 tab=all 고정: 마지막 탭이 '오늘'이면 대부분 걸러져 빈 화면처럼 보인다. */
              onPress={() => router.push(`/todo?tab=all&tag=${t.id}`)}
            />
          ))}
        </View>
      ) : (
        <Pressable onPress={readonly ? undefined : openPicker} disabled={readonly}>
          <ThemedText type="small" style={{ color: theme.textTertiary }}>
            {readonly ? '태그 없음' : '태그 추가'}
          </ThemedText>
        </Pressable>
      )}

      {open ? (
        <BottomSheet open onClose={() => setOpen(false)}>
          <View style={styles.sheet}>
            <ThemedText type="default" style={styles.sheetTitle}>
              태그
            </ThemedText>
            {/* 새 태그 만들기 */}
            <View style={[styles.createRow, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="add" size={18} color={theme.textSecondary} />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="새 태그 만들기"
                placeholderTextColor={theme.textTertiary}
                style={[styles.createInput, { color: theme.text }]}
                onSubmitEditing={onCreate}
                returnKeyType="done"
                maxLength={40}
              />
              {draft.trim() ? (
                <Pressable onPress={onCreate} hitSlop={8}>
                  <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                    만들기
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            {/* 기존 태그 토글 */}
            <View style={styles.list}>
              {sortedAll.map((t) => {
                const on = selected.has(t.id);
                const color = t.color ?? theme.textTertiary;
                return (
                  <View key={t.id} style={styles.pickRowWrap}>
                    <Pressable
                      onPress={() => toggle(t.id)}
                      style={({ pressed }) => [styles.pickRow, styles.flex, pressed && { backgroundColor: theme.surfaceSelected }]}>
                      <View style={[styles.dot, { backgroundColor: color }]} />
                      <ThemedText type="default" style={styles.flex} numberOfLines={1}>
                        {t.name}
                      </ThemedText>
                      {on ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
                    </Pressable>
                    {/* 태그 관리(이름 변경·삭제) — 만들기만 되고 고치거나 지울 방법이 없어
                        오타 태그가 계속 쌓였다. 권한이 아예 없는 뷰어에게는 그리지 않는다. */}
                    {tagManage.canManage ? (
                      <Pressable
                        onPress={() => tagManage.promptManage(t)}
                        hitSlop={10}
                        style={styles.manageBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.name} 태그 관리`}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
              {!sortedAll.length ? (
                <ThemedText type="small" style={{ color: theme.textTertiary, paddingVertical: 8 }}>
                  아직 태그가 없어요. 위에서 만들어보세요.
                </ThemedText>
              ) : null}
            </View>
            <Pressable onPress={onApply} style={[styles.applyBtn, { backgroundColor: theme.primary }]}>
              <ThemedText type="default" style={{ color: readableOn(theme.primary), fontWeight: '700' }}>
                적용
              </ThemedText>
            </Pressable>
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontWeight: '600', maxWidth: 160 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
  sheet: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 12 },
  sheetTitle: { fontWeight: '800', fontSize: 18 },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, paddingHorizontal: 12 },
  createInput: { flex: 1, fontSize: 15 },
  list: { gap: 2 },
  pickRowWrap: { flexDirection: 'row', alignItems: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 6, borderRadius: 8 },
  manageBtn: { paddingHorizontal: 8, paddingVertical: 10 },
  applyBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
