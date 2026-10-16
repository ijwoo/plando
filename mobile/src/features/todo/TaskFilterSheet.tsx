import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BottomSheet } from '@/features/todo/todoPickers';
import { priorityColor, PRIORITY_LABEL, type TodoPriority } from '@/shared/ui/tone';
import type { MobileTab, SortKey } from '@/features/todo/todoFilters';
import { sameCriteria, useSmartViews, type SmartView } from '@/features/todo/smartViews';
import { tickHaptic } from '@/shared/ui/haptics';
import { toast } from '@/shared/ui/toast';
import { TagChip } from '@/features/tag/TagSection';
import { useTags } from '@/features/tag/queries';
import { useTagManage } from '@/features/tag/useTagManage';

const PRIORITIES: TodoPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

/** 마감 퀵 필터 — 웹 useTaskListFilters의 dueDateFilter(null|today|overdue) 미러 */
export type DueFilter = 'all' | 'today' | 'overdue';
const DUES: { value: DueFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', label: '전체', icon: 'calendar-clear-outline' },
  { value: 'today', label: '오늘', icon: 'today-outline' },
  { value: 'overdue', label: '지연', icon: 'alert-circle-outline' },
];

const SORTS: { value: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'default', label: '기본', icon: 'layers-outline' },
  { value: 'due', label: '마감 빠른 순', icon: 'time-outline' },
  { value: 'priority', label: '우선순위 높은 순', icon: 'flag-outline' },
  { value: 'title', label: '제목 가나다', icon: 'text-outline' },
];

/** 할일 필터·정렬 시트 — 우선순위 다중 필터 + 마감 단일 필터 + 정렬 단일 선택. */
export function TaskFilterSheet({
  open,
  onClose,
  tab,
  assigneeSel,
  onToggleAssignee,
  members = [],
  myEmail,
  priorities,
  onTogglePriority,
  due,
  onDue,
  tagSel,
  onToggleTag,
  sort,
  onSort,
  onReset,
  onApplyView,
}: {
  open: boolean;
  onClose: () => void;
  tab: MobileTab;
  /** 담당 다중 필터 토큰: 'me' · 'none' · <email>. 합집합. */
  assigneeSel: string[];
  onToggleAssignee: (token: string) => void;
  members?: { name?: string; email?: string }[];
  myEmail: string;
  priorities: TodoPriority[];
  onTogglePriority: (p: TodoPriority) => void;
  due: DueFilter;
  onDue: (d: DueFilter) => void;
  /** 태그 다중 필터(태그 id). 합집합. */
  tagSel: number[];
  onToggleTag: (id: number) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  onReset: () => void;
  onApplyView: (v: SmartView) => void;
}) {
  const theme = useTheme();
  // 시트 maxHeight(70%)에서 헤들·헤더·하단 여백을 뺀 만큼만 스크롤 영역으로 —
  // 상한을 명시해야 콘텐츠가 짧을 때 시트가 딱 맞게 줄고, 길 때도 빈 공간이 남지 않는다.
  const { height: winH } = useWindowDimensions();
  const bodyMaxH = winH * 0.7 - 110;
  const active =
    assigneeSel.length > 0 || priorities.length > 0 || tagSel.length > 0 || due !== 'all' || sort !== 'default';

  // 워크스페이스 태그 목록 — 상세 태그 편집과 같은 쿼리 재사용(중복 fetch 없음).
  // 정렬은 태그 피커(TagSection)와 동일하게 이름순 — 두 화면에서 순서가 달라 보이지 않게.
  const { data: allTags } = useTags();
  const tags = useMemo(() => [...(allTags ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [allTags]);
  const tagManage = useTagManage();

  const views = useSmartViews((s) => s.views);
  const addView = useSmartViews((s) => s.add);
  const removeView = useSmartViews((s) => s.remove);
  const current = { tab, assignees: assigneeSel, prio: priorities, due, tags: tagSel, sort };

  const onSaveView = () => {
    Alert.prompt(
      '뷰 저장',
      '현재 탭·필터·정렬을 이름 붙여 저장해요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '저장',
          onPress: (name?: string) => {
            const n = (name ?? '').trim();
            // 이름 없이 저장하면 아무 일도 안 일어난 것처럼 보인다 — 이유를 알려준다
            if (!n) {
              toast.error('뷰 이름을 입력해주세요');
              return;
            }
            tickHaptic();
            addView(n, current);
          },
        },
      ],
      'plain-text',
      '',
    );
  };

  const onDeleteView = (v: SmartView) =>
    Alert.alert('뷰 삭제', `"${v.name}" 뷰를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => removeView(v.id) },
    ]);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={styles.head}>
        <ThemedText type="label" style={styles.title}>
          필터 · 정렬
        </ThemedText>
        {active ? (
          <Pressable onPress={onReset} hitSlop={8} style={styles.reset}>
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
              초기화
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* 본문 스크롤 — 멤버가 많으면 담당 칩이 늘어 시트 maxHeight(70%)를 넘긴다 */}
      <ScrollView
        style={[styles.body, { maxHeight: bodyMaxH }]}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled">
      {views.length ? (
        <>
          <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>
            저장된 뷰
          </ThemedText>
          <View style={styles.chips}>
            {views.map((v) => {
              const on = sameCriteria(current, v);
              return (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    tickHaptic();
                    onApplyView(v);
                    onClose();
                  }}
                  onLongPress={() => onDeleteView(v)}
                  delayLongPress={300}
                  style={[styles.chip, { backgroundColor: on ? theme.primary : theme.surfaceAlt, borderColor: on ? theme.primary : theme.border }]}>
                  <Ionicons name="bookmark" size={12} color={on ? '#fff' : theme.primary} />
                  <ThemedText type="small" style={{ color: on ? '#fff' : theme.text, fontWeight: '700' }} numberOfLines={1}>
                    {v.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>
        담당 (여러 명 선택 가능)
      </ThemedText>
      <View style={[styles.chips, styles.chipsWrap]}>
        {[
          { token: 'me', label: '내 할 일', icon: 'person' as const },
          ...members
            .filter((m) => m.email && m.email !== myEmail)
            .map((m) => ({ token: m.email as string, label: m.name || (m.email as string), icon: 'person-outline' as const })),
          { token: 'none', label: '미지정', icon: 'person-remove-outline' as const },
        ].map((c) => {
          const on = assigneeSel.includes(c.token);
          return (
            <Pressable
              key={c.token}
              onPress={() => onToggleAssignee(c.token)}
              accessibilityLabel={c.label}
              accessibilityState={{ selected: on }}
              style={[styles.chip, { backgroundColor: on ? theme.primary : theme.surfaceAlt, borderColor: on ? theme.primary : theme.border }]}>
              <Ionicons name={c.icon} size={12} color={on ? '#fff' : theme.textSecondary} />
              <ThemedText type="small" style={{ color: on ? '#fff' : theme.text, fontWeight: '700' }} numberOfLines={1}>
                {c.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>
        우선순위
      </ThemedText>
      <View style={styles.chips}>
        {PRIORITIES.map((p) => {
          const on = priorities.includes(p);
          const c = priorityColor(theme, p);
          return (
            <Pressable
              key={p}
              onPress={() => onTogglePriority(p)}
              style={[styles.chip, { backgroundColor: on ? c : theme.surfaceAlt, borderColor: on ? c : theme.border }]}>
              <Ionicons name="flag" size={12} color={on ? '#fff' : c} />
              <ThemedText type="small" style={{ color: on ? '#fff' : theme.text, fontWeight: '700' }}>
                {PRIORITY_LABEL[p]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>
        마감
      </ThemedText>
      <View style={styles.chips}>
        {DUES.map((d) => {
          const on = due === d.value;
          // 지연은 위험 톤, 나머지는 프라이머리 톤 (마감 D-day 색조와 통일)
          const c = d.value === 'overdue' ? theme.danger : theme.primary;
          return (
            <Pressable
              key={d.value}
              onPress={() => onDue(d.value)}
              accessibilityLabel={`마감 필터: ${d.label}`}
              style={[styles.chip, { backgroundColor: on ? c : theme.surfaceAlt, borderColor: on ? c : theme.border }]}>
              <Ionicons name={d.icon} size={12} color={on ? '#fff' : c} />
              <ThemedText type="small" style={{ color: on ? '#fff' : theme.text, fontWeight: '700' }}>
                {d.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* 태그 — 워크스페이스에 태그가 하나도 없으면 섹션 자체를 감춘다(빈 박스 방지) */}
      {tags.length ? (
        <>
          <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>
            태그 (여러 개 선택 가능)
          </ThemedText>
          {/* 태그는 여기서만 늘어나고 정리할 곳이 없었다. 저장된 뷰와 같은 규칙(길게 눌러
              관리)으로 이름 변경·삭제를 붙이고, 숨은 동작이 되지 않게 안내를 한 줄 남긴다.
              권한이 없으면(뷰어) 안내도 롱프레스도 없다. */}
          {tagManage.canManage ? (
            <ThemedText type="small" style={[styles.hint, { color: theme.textTertiary }]}>
              길게 누르면 이름 변경{tagManage.canDelete ? ' · 삭제' : ''}
            </ThemedText>
          ) : null}
          <View style={[styles.chips, styles.chipsWrap]}>
            {tags.map((t) => {
              const on = tagSel.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onToggleTag(t.id)}
                  onLongPress={tagManage.canManage ? () => tagManage.promptManage(t) : undefined}
                  delayLongPress={300}
                  accessibilityLabel={t.name}
                  accessibilityState={{ selected: on }}>
                  {/* 태그 칩은 상세 화면과 같은 컴포넌트를 쓰되, 패딩만 시트 칩 규격으로 맞춘다 */}
                  <TagChip tag={t} theme={theme} selected={on} style={styles.tagChip} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <ThemedText type="small" style={[styles.section, { color: theme.textSecondary }]}>
        정렬
      </ThemedText>
      <View style={styles.sortList}>
        {SORTS.map((s) => {
          const on = sort === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => onSort(s.value)}
              style={[styles.sortRow, on && { backgroundColor: theme.primary + '14' }]}>
              <Ionicons name={s.icon} size={17} color={on ? theme.primary : theme.textSecondary} />
              <ThemedText type="default" style={[styles.sortLabel, on && { color: theme.primary, fontWeight: '700' }]}>
                {s.label}
              </ThemedText>
              {on ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="이 조건 저장" onPress={onSaveView} style={[styles.saveBtn, { borderColor: theme.border }]}>
        <Ionicons name="bookmark-outline" size={16} color={theme.primary} />
        <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
          현재 조건을 뷰로 저장
        </ThemedText>
      </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  // 시트 maxHeight 안에서 줄어들며 스크롤되도록 flexShrink 필요
  body: { flexShrink: 1 },
  bodyContent: { paddingBottom: 8 },
  title: { fontWeight: '700', flex: 1, textAlign: 'center' },
  reset: { position: 'absolute', right: 16 },
  section: { fontWeight: '700', paddingHorizontal: 18, marginTop: 14, marginBottom: 8 },
  hint: { paddingHorizontal: 18, marginTop: -4, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  chipsWrap: { flexWrap: 'wrap', rowGap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  tagChip: { paddingHorizontal: 12, paddingVertical: 8 },
  sortList: { paddingHorizontal: 10, paddingBottom: 8, gap: 2 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  sortLabel: { flex: 1 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
