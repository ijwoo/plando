import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Todo } from '@/features/todo/api';
import { useStatusMap } from '@/features/status/queries';
import { useTheme } from '@/hooks/use-theme';
import { Press } from '@/shared/ui/Press';
import { statusColor } from '@/shared/ui/tone';
import { stripMarkdown } from '@/shared/utils/markdown';

/** "HH:mm[:ss]" → "HH:mm" / 시간 없으면 null */
function hhmm(t?: string): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/**
 * 일정(할 일) 카드 — 좌측 상태색 바 + 제목(+내용) + 우측 시간.
 * 기존 앱 MobileCalendarEventCard 구성을 RN으로 재현.
 */
export function EventCard({ todo, onPress }: { todo: Todo; onPress?: () => void }) {
  const theme = useTheme();
  // 커스텀 상태 색을 먼저 본다. 예전엔 statusColor 만 써서 'IN_PROGRESS'/'DONE' 이 아닌
  // 커스텀 키가 전부 빨강으로 칠해졌다(웹은 이미 고쳐진 버그).
  const sm = useStatusMap();
  const barColor = sm.color(todo.status) ?? statusColor(theme, todo.status, sm.category(todo.status));
  const time = hhmm(todo.startTime) ?? '종일';

  return (
    <Press onPress={onPress} style={styles.row} scale={1} pressedStyle={{ opacity: 0.55 }}>
      <View style={[styles.bar, { backgroundColor: barColor }]} />
      <View style={styles.body}>
        <ThemedText type="default" numberOfLines={1} style={styles.title}>
          {todo.title}
        </ThemedText>
        {todo.content ? (
          <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary, marginTop: 2 }}>
            {stripMarkdown(todo.content)}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" style={[styles.time, { color: theme.textSecondary }]}>
        {time}
      </ThemedText>
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
  bar: { width: 4, alignSelf: 'stretch', minHeight: 32, borderRadius: 3 },
  body: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  time: { fontWeight: '600', paddingTop: 1 },
});
