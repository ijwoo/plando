import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * 캘린더 상단 헤더 — "{월}월 {년}년" + 오늘 pill + trailing(세그먼트/축소 등).
 * 이전/다음 이동은 화살표 버튼 대신 본문 좌우 스와이프로 한다(네이티브·기존 앱과 동일).
 */
export function CalendarHeader({
  year,
  month,
  onToday,
  isToday = false,
  trailing,
}: {
  year: number;
  month: number; // 0-based
  onToday: () => void;
  isToday?: boolean;
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.title}>
          <ThemedText type="title" style={styles.month}>
            {month + 1}월
          </ThemedText>
          <ThemedText type="small" style={[styles.year, { color: theme.textSecondary }]}>
            {year}년
          </ThemedText>
        </View>
        <Pressable
          onPress={onToday}
          disabled={isToday}
          hitSlop={6}
          style={[styles.todayPill, { borderColor: theme.backgroundElement }]}>
          <ThemedText
            type="label"
            style={{ color: isToday ? theme.textSecondary : theme.text, opacity: isToday ? 0.5 : 1 }}>
            오늘
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.right}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  month: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  year: { fontWeight: '600' },
  todayPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
