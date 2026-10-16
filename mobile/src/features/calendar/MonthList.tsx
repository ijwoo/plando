import { forwardRef, memo, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Press } from '@/shared/ui/Press';
import type { Todo } from '@/features/todo/api';
import { useStatusMap } from '@/features/status/queries';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { readableOn, statusColor } from '@/shared/ui/tone';

import { pad, parseYmd, weekdayColor, weekdayHeader, ymd } from './calendarUtils';

const RANGE = 48; // 오늘 기준 ±개월
const LABEL_H = 38; // 월 라벨 행 높이
const ROW_H = 86; // 주(week) 행 높이 — 고정 (연속 스크롤 + 다음 달 ~1.3주 미리보기)

type MonthMeta = { key: string; year: number; month: number; weeks: number };
export type MonthListHandle = { scrollToMonth: (anchorYmd: string) => void };

type Props = {
  today: string;
  selected: string;
  eventsByDate: Record<string, Todo[]>;
  weekStartsOn: 0 | 1;
  onSelect: (ymd: string) => void;
  onMonthChange: (anchorYmd: string) => void; // 상단에 보이는 달(헤더 라벨)
  bottomInset?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
};

/** 한 달 블록 — 월 라벨 + 고정 높이 주 행들. 그 달 날짜만(다른 달은 빈칸). */
const MonthBlock = memo(function MonthBlock({
  year,
  month,
  weeks,
  today,
  selected,
  eventsByDate,
  weekStartsOn,
  onSelect,
}: {
  year: number;
  month: number;
  weeks: number;
  today: string;
  selected: string;
  eventsByDate: Record<string, Todo[]>;
  weekStartsOn: 0 | 1;
  onSelect: (ymd: string) => void;
}) {
  const theme = useTheme();
  const sm = useStatusMap();
  const offset = (new Date(year, month, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < weeks * 7) cells.push(null);

  return (
    <View>
      <ThemedText type="default" style={[styles.monthLabel, { color: theme.text }]}>
        {month === 0 ? `${year}년 1월` : `${month + 1}월`}
      </ThemedText>
      {Array.from({ length: weeks }, (_, w) => (
        <View key={w} style={[styles.week, { borderTopColor: theme.border }]}>
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (day == null) return <View key={i} style={styles.cell} />;
            const key = `${year}-${pad(month + 1)}-${pad(day)}`;
            const weekday = (weekStartsOn + i) % 7;
            const isToday = key === today;
            const isSelected = key === selected;
            const events = eventsByDate[key] ?? [];
            const numColor = isSelected ? readableOn(theme.primary) : isToday ? theme.primary : weekdayColor(weekday, theme);
            return (
              <Press key={i} style={styles.cell} scale={1} pressedStyle={{ opacity: 0.5 }} onPress={() => onSelect(key)}>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: theme.primary },
                    !isSelected && isToday && { borderColor: theme.primary, borderWidth: StyleSheet.hairlineWidth },
                  ]}>
                  <ThemedText type="default" style={[styles.dayNum, { color: numColor }]}>
                    {day}
                  </ThemedText>
                </View>
                <View style={styles.dots}>
                  {events.slice(0, 3).map((e, di) => (
                    <View key={di} style={[styles.dot, { backgroundColor: sm.color(e.status) ?? statusColor(theme, e.status, sm.category(e.status)) }]} />
                  ))}
                  {events.length > 3 ? (
                    <ThemedText type="label" style={[styles.moreCount, { color: theme.textSecondary }]}>
                      +{events.length - 3}
                    </ThemedText>
                  ) : null}
                </View>
              </Press>
            );
          })}
        </View>
      ))}
    </View>
  );
});

/**
 * 세로 연속 월 캘린더 (iOS 기본 캘린더) — 월들이 세로로 이어지고 자유 스크롤.
 * 고정 행 높이라 다음 달 첫 주가 아래에 미리보기로 보여 위/아래 스와이프를 유도.
 * 행 높이가 고정(측정 X)이라 위치 어긋남/번쩍임 없음.
 */
export const MonthList = forwardRef<MonthListHandle, Props>(function MonthList(
  { today, selected, eventsByDate, weekStartsOn, onSelect, onMonthChange, bottomInset = 0, refreshing = false, onRefresh },
  ref,
) {
  const theme = useTheme();
  const listRef = useRef<FlatList<MonthMeta>>(null);
  const t0 = parseYmd(today);
  const lastKey = useRef(`${t0.getFullYear()}-${t0.getMonth()}`);

  // 리스트 범위의 기준 달은 **마운트 시점 1회**로 고정한다. `today`에 묶어두면 자정을 넘길 때
  // (특히 말일→1일) 달 배열 전체가 한 칸 밀려, 보고 있던 스크롤 위치가 다른 달로 바뀐다.
  // 오늘 표시(링)는 아래 MonthBlock의 `today` prop으로 계속 갱신되므로 문제없다.
  const [baseMonth] = useState(() => {
    const t = parseYmd(today);
    return { year: t.getFullYear(), month: t.getMonth() };
  });

  const months = useMemo<MonthMeta[]>(() => {
    return Array.from({ length: RANGE * 2 + 1 }, (_, idx) => {
      const d = new Date(baseMonth.year, baseMonth.month + (idx - RANGE), 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const offset = (d.getDay() - weekStartsOn + 7) % 7;
      const dim = new Date(year, month + 1, 0).getDate();
      return { key: `${year}-${month}`, year, month, weeks: Math.ceil((offset + dim) / 7) };
    });
  }, [baseMonth, weekStartsOn]);

  // 각 달 높이/누적 오프셋 (고정 행 높이 기반 → 정확)
  const layouts = useMemo(() => {
    let off = 0;
    return months.map((m) => {
      const length = LABEL_H + m.weeks * ROW_H;
      const item = { length, offset: off };
      off += length;
      return item;
    });
  }, [months]);

  const header = useMemo(() => weekdayHeader(weekStartsOn), [weekStartsOn]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToMonth: (anchorYmd: string) => {
        const d = parseYmd(anchorYmd);
        const i = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
        if (i >= 0) listRef.current?.scrollToIndex({ index: i, animated: true });
      },
    }),
    [months],
  );

  // 스크롤이 멈출 때 상단에 보이는 달을 헤더에 알림
  const settle = (y: number) => {
    let idx = 0;
    for (let i = 0; i < layouts.length; i++) {
      if (layouts[i].offset <= y + LABEL_H) idx = i;
      else break;
    }
    const m = months[idx];
    if (!m) return;
    if (m.key !== lastKey.current) {
      lastKey.current = m.key;
      tickHaptic(); // 달 바뀔 때 진동
    }
    onMonthChange(ymd(new Date(m.year, m.month, 1)));
  };

  return (
    // 라이트: 월 그리드를 흰 콘텐츠 시트로(다른 탭과 통일). 다크: 회색 캔버스 유지.
    <View style={[styles.flex1, !theme.isDark && { backgroundColor: theme.surface }]}>
      <View style={[styles.weekHeader, { borderBottomColor: theme.border }]}>
        {header.map(({ label, weekday }) => (
          <View key={weekday} style={styles.cell}>
            <ThemedText type="label" style={{ color: weekdayColor(weekday, theme), fontWeight: '700', fontSize: 13 }}>
              {label}
            </ThemedText>
          </View>
        ))}
      </View>
      <FlatList
        ref={listRef}
        data={months}
        keyExtractor={(m) => m.key}
        initialScrollIndex={RANGE}
        getItemLayout={(_, i) => ({ length: layouts[i].length, offset: layouts[i].offset, index: i })}
        onScrollToIndexFailed={() => {}}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
        renderItem={({ item }) => (
          <MonthBlock
            year={item.year}
            month={item.month}
            weeks={item.weeks}
            today={today}
            selected={selected}
            eventsByDate={eventsByDate}
            weekStartsOn={weekStartsOn}
            onSelect={onSelect}
          />
        )}
      />
    </View>
  );
});

const CIRCLE = 36;
const styles = StyleSheet.create({
  flex1: { flex: 1 },
  weekHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 3, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  monthLabel: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, paddingHorizontal: 14, height: LABEL_H, lineHeight: LABEL_H },
  week: { flexDirection: 'row', height: ROW_H, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 7, gap: 4 },
  dayCircle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontWeight: '600', fontSize: 18 },
  dots: { flexDirection: 'row', gap: 3, height: 9, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  moreCount: { fontSize: 8, fontWeight: '700', lineHeight: 9 },
});
