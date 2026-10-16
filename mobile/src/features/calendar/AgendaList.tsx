import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Todo } from '@/features/todo/api';
import { useTheme } from '@/hooks/use-theme';

import { addDaysYmd, parseYmd, WEEKDAY_LABELS } from './calendarUtils';
import { EventCard } from './EventCard';

/** 웹(react-big-calendar) agenda 뷰의 기본 범위(length=30일)를 미러 — 시작일부터 30일 롤링 */
export const AGENDA_RANGE_DAYS = 30;

type Row =
  | { type: 'header'; key: string; label: string; isToday: boolean }
  | { type: 'event'; key: string; todo: Todo };

/** 날짜 헤더 라벨 — 오늘 / 내일 / "7월 12일 (토)" */
function headerLabel(key: string, today: string): string {
  if (key === today) return '오늘';
  if (key === addDaysYmd(today, 1)) return '내일';
  const d = parseYmd(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_LABELS[d.getDay()]})`;
}

/**
 * 목록(아젠다) 뷰 — 시작일부터 30일간의 일정을 날짜 헤더로 묶어 시간순 플랫 리스트로.
 * 웹 캘린더의 '목록'(react-big-calendar agenda) 뷰 대응. 행은 기존 EventCard 재사용.
 */
export function AgendaList({
  start,
  today,
  eventsByDate,
  onOpen,
  bottomInset = 0,
  refreshing,
  onRefresh,
  emptyText = '이 기간에 일정이 없어요',
}: {
  /** 범위 시작일 (YYYY-MM-DD) — 여기서부터 30일 */
  start: string;
  /** 오늘 (YYYY-MM-DD) — 화면에서 자정 갱신되는 값을 받는다. 여기서 직접 계산하면
   *  앱을 켜둔 채 자정을 넘겼을 때 "오늘/내일" 라벨이 하루 밀린 채로 남는다 */
  today: string;
  /** 날짜(YYYY-MM-DD) → 일정 목록 (프로젝트 스코프·반복 필터가 이미 적용된 맵) */
  eventsByDate: Record<string, Todo[]>;
  onOpen: (todoId: number) => void;
  bottomInset?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  emptyText?: string;
}) {
  const theme = useTheme();

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (let i = 0; i < AGENDA_RANGE_DAYS; i++) {
      const key = addDaysYmd(start, i);
      const todos = eventsByDate[key];
      if (!todos?.length) continue;
      out.push({ type: 'header', key: `h-${key}`, label: headerLabel(key, today), isToday: key === today });
      // 종일(시간 없음) 먼저, 그다음 시작 시간순 — 웹 agenda 정렬과 동일한 감각
      const sorted = [...todos].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
      for (const t of sorted) out.push({ type: 'event', key: `e-${key}-${t.id}`, todo: t });
    }
    return out;
  }, [start, eventsByDate, today]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      refreshing={refreshing}
      onRefresh={onRefresh}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 24 }, rows.length === 0 && styles.emptyGrow]}
      ListEmptyComponent={
        <ThemedText type="default" style={[styles.empty, { color: theme.textSecondary }]}>
          {emptyText}
        </ThemedText>
      }
      renderItem={({ item }) =>
        item.type === 'header' ? (
          <View style={[styles.header, { borderBottomColor: theme.divider }]}>
            <ThemedText
              type="small"
              style={[styles.headerText, { color: item.isToday ? theme.primary : theme.textSecondary }]}>
              {item.label}
            </ThemedText>
          </View>
        ) : (
          <EventCard todo={item.todo} onPress={() => item.todo.id != null && onOpen(item.todo.id)} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 4 },
  emptyGrow: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', paddingVertical: 40 },
  header: { paddingTop: 14, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { fontWeight: '800', letterSpacing: -0.2 },
});
