import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { chatTaskNumericId, type ChatTask } from '@/features/chat/api';
import { useStatusMap } from '@/features/status/queries';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { priorityColor, PRIORITY_LABEL, statusColor, type TodoPriority } from '@/shared/ui/tone';

/**
 * AI 조회·수정 결과 카드.
 *
 * 접는 이유: 조회가 열 건이면 카드 하나가 화면을 통째로 덮어서, 방금 무슨 말을 했는지도
 * 안 보였다. 폭이 좁은 앱에서는 웹보다 훨씬 심하다. 세 건이면 "무엇이 나왔는지" 는 알 수
 * 있고 대화 흐름도 남는다.
 *
 * chat.tsx 의 renderItem 안에 있던 것을 여기로 옮겼다 — 펼침 상태를 기억하려면 훅이
 * 필요한데 renderItem 은 컴포넌트가 아니라 훅을 쓸 수 없다.
 */

const COLLAPSED_COUNT = 3;

const HEADER_LABEL: Record<string, string> = { updated: '수정 완료', listed: '조회 결과' };

export function ChatResultCard({ tasks, kind }: { tasks: ChatTask[]; kind?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const sm = useStatusMap();
  const [expanded, setExpanded] = useState(false);

  // 수정 결과는 "바뀌었다"가 먼저 읽혀야 하므로 조회와 색을 나눈다
  const isUpdate = kind === 'updated';
  const accent = isUpdate ? theme.green : theme.primary;

  const collapsible = tasks.length > COLLAPSED_COUNT;
  const visible = collapsible && !expanded ? tasks.slice(0, COLLAPSED_COUNT) : tasks;
  const hiddenCount = tasks.length - visible.length;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.header, { borderBottomColor: theme.divider }]}>
        {/* 아이콘을 칩으로 세운다. 회색 글씨 한 줄이면 카드의 머리인지 본문인지 안 읽힌다. */}
        <View style={[styles.headerIcon, { backgroundColor: accent + '1F' }]}>
          <Ionicons name={isUpdate ? 'checkmark' : 'sparkles'} size={12} color={accent} />
        </View>
        <ThemedText type="small" style={[styles.headerText, { color: accent }]}>
          {HEADER_LABEL[kind ?? 'listed'] ?? '조회 결과'}
        </ThemedText>
        {tasks.length > 1 ? (
          <View style={[styles.countBadge, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" style={[styles.countText, { color: theme.textSecondary }]}>
              {tasks.length}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {visible.map((tk, i) => {
        const pColor = priorityColor(theme, tk.priority);
        // 커스텀 상태는 statusColor 세 분기에 안 걸려 전부 danger(빨강)가 됐다
        const sColor = sm.color(tk.status) ?? statusColor(theme, tk.status, sm.category(tk.status));
        const numId = chatTaskNumericId(tk.id);
        const showDivider = i < visible.length - 1 || collapsible;
        return (
          <Pressable
            key={tk.id ?? i}
            onPress={() => numId != null && router.push(`/todo/${numId}`)}
            disabled={numId == null}
            style={[styles.row, showDivider && { borderBottomColor: theme.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <ThemedText type="default" style={styles.title} numberOfLines={2}>
              {tk.title ?? '할 일'}
            </ThemedText>
            <View style={styles.meta}>
              {tk.priority ? (
                <View style={[styles.tag, { backgroundColor: pColor + '1F' }]}>
                  <Ionicons name="flag" size={10} color={pColor} />
                  <ThemedText type="small" style={[styles.tagText, { color: pColor }]}>
                    {PRIORITY_LABEL[tk.priority as TodoPriority] ?? tk.priority}
                  </ThemedText>
                </View>
              ) : null}
              {tk.status ? (
                <View style={[styles.tag, { backgroundColor: sColor + '1F' }]}>
                  <ThemedText type="small" style={[styles.tagText, { color: sColor }]}>
                    {sm.label(tk.status)}
                  </ThemedText>
                </View>
              ) : null}
              {tk.dueDate ? (
                <View style={styles.tag}>
                  <Ionicons name="calendar-outline" size={10} color={theme.textSecondary} />
                  <ThemedText type="small" style={[styles.tagText, { color: theme.textSecondary }]}>
                    {tk.dueDate.slice(5, 10)}
                  </ThemedText>
                </View>
              ) : null}
              {numId != null ? (
                <Ionicons name="chevron-forward" size={13} color={theme.textTertiary} style={styles.chevron} />
              ) : null}
            </View>
          </Pressable>
        );
      })}

      {collapsible ? (
        /* 숨은 개수를 숫자로 말한다 — "더 보기" 만 있으면 몇 개가 남았는지 몰라
           누를지 말지 판단이 안 된다. */
        <Pressable
          onPress={() => {
            tickHaptic();
            setExpanded((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={({ pressed }) => [styles.toggle, pressed && { backgroundColor: theme.surfaceAlt }]}>
          <ThemedText type="small" style={[styles.toggleText, { color: theme.primary }]}>
            {expanded ? '접기' : `${hiddenCount}개 더 보기`}
          </ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={theme.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIcon: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  countBadge: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, alignItems: 'center' },
  countText: { fontWeight: '800' },
  headerText: { fontWeight: '800', letterSpacing: 0.2 },
  row: { paddingHorizontal: 14, paddingVertical: 11, gap: 7 },
  title: { fontWeight: '700', lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontWeight: '700' },
  chevron: { marginLeft: 'auto' },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 11 },
  toggleText: { fontWeight: '700' },
});
