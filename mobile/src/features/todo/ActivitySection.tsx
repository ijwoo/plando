import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useStatusMap } from '@/features/status/queries';
import { Avatar } from '@/shared/ui/Avatar';
import { SkeletonList } from '@/shared/ui/Skeleton';
import { relativeTime } from '@/shared/utils/datetime';
import { changeSummary, collapseLogs, useTodoLogs } from './logs';

/** 활동 탭 — 할 일 변경 로그(읽기 전용). 아바타 + 한 줄 요약 + 시간. 내용 변경은 눌러서 전체 보기. */
export function ActivitySection({ todoId }: { todoId: number }) {
  const theme = useTheme();
  const { label: statusLabel } = useStatusMap();
  const { data: logs, isLoading } = useTodoLogs(todoId);
  const items = useMemo(() => collapseLogs(logs ?? []), [logs]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id?: number) =>
    id != null &&
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isLoading) return <SkeletonList rows={3} avatar={30} lines={1} />;
  if (!items.length) {
    return (
      <ThemedText type="small" style={styles.empty}>
        활동 내역이 없어요.
      </ThemedText>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((l) => {
        const who = l.modifierName ?? l.modifier ?? '누군가';
        const isContent = l.field === 'content' && !!l.afterValue;
        const open = l.id != null && expanded.has(l.id);
        return (
          <View key={l.id} style={styles.row}>
            <Avatar person={{ name: who, profileImageUrl: l.modifierProfileImageUrl }} size={30} />
            <Pressable style={styles.body} disabled={!isContent} onPress={() => toggle(l.id)}>
              <ThemedText type="small" numberOfLines={2}>
                <ThemedText type="small" style={styles.who}>
                  {who}
                </ThemedText>
                {`님 · ${changeSummary(l, statusLabel)}`}
              </ThemedText>
              {isContent && open ? (
                <View style={[styles.contentBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {l.afterValue}
                  </ThemedText>
                </View>
              ) : null}
              {isContent ? (
                <ThemedText type="small" style={[styles.more, { color: theme.primary }]}>
                  {open ? '접기' : '바뀐 내용 전체 보기'}
                </ThemedText>
              ) : null}
              <ThemedText type="small" style={styles.time}>
                {relativeTime(l.modifiedAt)}
              </ThemedText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { opacity: 0.5, textAlign: 'center', paddingVertical: 32 },
  list: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  body: { flex: 1, gap: 1 },
  who: { fontWeight: '700' },
  contentBox: { marginTop: 6, padding: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  more: { marginTop: 4, fontWeight: '700' },
  time: { opacity: 0.5, marginTop: 2 },
});
