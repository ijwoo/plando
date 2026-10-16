import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import type { Todo } from '@/features/todo/api';
import { useStatusMap } from '@/features/status/queries';
import { useTheme } from '@/hooks/use-theme';
import { AvatarStack } from '@/shared/ui/Avatar';
import { tickHaptic } from '@/shared/ui/haptics';
import { readableOn, statusColor } from '@/shared/ui/tone';

import { pad, parseYmd, weekdayColor, WEEKDAY_LABELS, ymd } from './calendarUtils';

const HOUR_H = 56;
const GUTTER = 46;
const SNAP = HOUR_H / 2; // 30분 스냅

function toMin(t?: string): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function minToHHmm(min: number): string {
  // 상한이 24*60이면 "24:00"이 나오는데 백엔드 LocalTime은 이를 거부해 저장이 400으로 실패했다
  // (그리드 맨 아래까지 끌면 재현). 하루의 마지막 유효 시각인 23:59로 캡한다. 웹도 동일 규칙.
  const m = Math.max(0, Math.min(23 * 60 + 59, min));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

type Placed = { t: Todo; s: number; e: number; col: number; cols: number };

/**
 * 하루의 시간 이벤트를 겹침 클러스터로 묶고 컬럼을 배정한다(웹 eventLayout.assignColumns 대응).
 * 같은 클러스터의 이벤트는 컬럼 수만큼 가로를 나눠 나란히 그려진다.
 */
function layoutDay(list: Todo[]): Placed[] {
  const evs: Placed[] = [];
  for (const t of list) {
    const s = toMin(t.startTime);
    if (s == null) continue; // 종일은 별도 행
    const e = Math.max(toMin(t.endTime) ?? Math.min(s + 60, 1440), s + 30);
    evs.push({ t, s, e, col: 0, cols: 1 });
  }
  evs.sort((a, b) => a.s - b.s || a.e - b.e);

  // 클러스터: 시간이 이어져 겹치는 구간 묶음 → 각 클러스터에서 그리디 컬럼 배정
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    for (const ev of cluster) {
      let col = colEnds.findIndex((end) => end <= ev.s);
      if (col < 0) {
        col = colEnds.length;
        colEnds.push(ev.e);
      } else {
        colEnds[col] = ev.e;
      }
      ev.col = col;
    }
    for (const ev of cluster) ev.cols = colEnds.length;
    cluster = [];
    clusterEnd = -1;
  };
  for (const ev of evs) {
    if (cluster.length && ev.s >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.e);
  }
  flush();
  return evs;
}

/**
 * 타임라인 뷰 — numDays개 컬럼(세로선) + 시간 격자(가로선). 주(7)·일(1) 공용.
 * 시간 있는 할 일은 해당 날짜·시간 블록. 현재 시간선/라벨 표시.
 * 빈 곳을 **롱프레스 후 드래그**하면 시간 범위 미리보기(+좌측 시간 라벨)가 뜨고, 놓으면 그 시간으로 생성.
 */
export function WeekTimeline({
  selected,
  weekStartsOn,
  eventsByDate,
  today,
  onOpen,
  onCreateSlot,
  onMoveEvent,
  onOpenDay,
  bottomInset = 0,
  numDays = 7,
  refreshing,
  onRefresh,
}: {
  selected: string;
  weekStartsOn: 0 | 1;
  eventsByDate: Record<string, Todo[]>;
  today: string;
  onOpen: (id: number) => void;
  onCreateSlot: (dayYmd: string, startTime: string, endTime: string) => void;
  /**
   * 그 날짜의 전체 일정 목록 열기(날짜 시트). 종일 행은 컬럼당 2~4개만 그리고 나머지는 "+N"으로
   * 접히는데, 예전엔 이게 그냥 텍스트라 가려진 종일 일정을 열어볼 방법이 아예 없었다.
   * 미지정이면 요일 헤더/"+N"을 눌러도 아무 일도 안 나므로 **탭 가능한 모양으로 그리지 않는다**.
   */
  onOpenDay?: (dayYmd: string) => void;
  /** 기존 이벤트 롱프레스 드래그 이동 (웹 useTimelineDnD onEventDrop 대응). 미지정 시 이동 비활성 */
  onMoveEvent?: (todoId: number, dayYmd: string, startTime: string, endTime: string) => void;
  bottomInset?: number;
  numDays?: 1 | 7;
  /** 당김새로고침 — 월/목록 뷰에만 있어서 주·일 뷰만 새로고침이 먹지 않았다 */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  // 블록 색은 상태 기준 — 월 그리드 점·EventCard·웹 타임라인(WeekEventBlock)과 같은 규칙.
  // 예전엔 여기만 우선순위 색이라 같은 일정이 뷰마다 다른 색으로 보였고, 사용자가 만든
  // 커스텀 상태의 지정색은 타임라인에서 전혀 반영되지 않았다.
  const sm = useStatusMap();
  const eventColor = (t: Todo) => sm.color(t.status) ?? statusColor(theme, t.status, sm.category(t.status));
  const [colsW, setColsW] = useState(0);
  const colW = colsW / numDays;

  // 현재 시간(분) — 1분마다 갱신
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // 진입 시 "현재 시각 1시간 전"으로 스크롤 (웹 타임라인과 동일).
  // 예전엔 항상 00:00에서 시작해, 주·일 뷰를 열 때마다 새벽 빈 구간부터 손으로 내려야 했다.
  const scrollRef = useRef<ScrollView>(null);
  const initialY = useMemo(() => {
    const d = new Date();
    // 마운트 시점 기준 1회 — 이후 시간이 흘러도 보던 위치를 뺏지 않는다
    return Math.max(0, ((d.getHours() * 60 + d.getMinutes()) / 60) * HOUR_H - HOUR_H);
  }, []);
  // contentOffset은 iOS 전용이라 그것만으로는 안드로이드에서 00:00에 남는다 → 레이아웃 후 1회 보정
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: initialY, animated: false }), 50);
    return () => clearTimeout(t);
  }, [initialY]);

  const days = useMemo(() => {
    const sel = parseYmd(selected);
    if (numDays === 1) return [sel];
    const diff = (sel.getDay() - weekStartsOn + 7) % 7;
    const startDate = new Date(sel);
    startDate.setDate(sel.getDate() - diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return d;
    });
  }, [selected, weekStartsOn, numDays]);
  const todayCol = days.findIndex((d) => ymd(d) === today);

  // 미리보기(롱프레스 드래그 — 생성/이동 공용)
  const pVisible = useSharedValue(0);
  const pCol = useSharedValue(0);
  const pTop = useSharedValue(0);
  const pHeight = useSharedValue(SNAP);
  const startY = useSharedValue(0);
  const lastS = useSharedValue(-1);
  const lastE = useSharedValue(-1);
  // 이동 모드: 잡은 블록 정보 (id<0 = 생성 모드)
  const moveId = useSharedValue(-1);
  const moveDur = useSharedValue(0);
  const grabDy = useSharedValue(0);
  const [slot, setSlot] = useState<{ s: number; e: number } | null>(null);

  const handleCreate = (col: number, topPx: number, botPx: number) => {
    const d = days[col];
    if (!d) return;
    const startMin = Math.round((topPx / HOUR_H) * 60);
    const endMin = Math.max(startMin + 30, Math.round((botPx / HOUR_H) * 60));
    onCreateSlot(ymd(d), minToHHmm(startMin), minToHHmm(endMin));
  };

  const handleMove = (id: number, col: number, topPx: number, durMin: number) => {
    const d = days[col];
    if (!d || !onMoveEvent) return;
    const startMin = Math.max(0, Math.round((topPx / HOUR_H) * 60));
    // 자정 초과 방지 — 웹 useTimelineDnD의 23:59 캡과 동일 정책
    const endMin = Math.min(23 * 60 + 59, startMin + durMin);
    onMoveEvent(id, ymd(d), minToHHmm(startMin), minToHHmm(endMin));
  };

  // 워크릿 히트테스트용 — 렌더된 시간 블록들의 픽셀 사각형 (제스처 재생성 시 캡처됨)
  const hitRects = useMemo(() => {
    if (!colW || !onMoveEvent) return [];
    const rects: { id: number; x0: number; x1: number; y0: number; y1: number; dur: number }[] = [];
    days.forEach((d, col) => {
      for (const { t, s, e, col: sub, cols } of layoutDay(eventsByDate[ymd(d)] ?? [])) {
        if (t.id == null) continue;
        const w = (colW - 2) / cols;
        const x0 = col * colW + 1 + sub * w;
        rects.push({ id: t.id, x0, x1: x0 + w, y0: (s / 60) * HOUR_H, y1: (e / 60) * HOUR_H, dur: e - s });
      }
    });
    return rects;
  }, [days, eventsByDate, colW, onMoveEvent]);

  const createGesture = Gesture.Pan()
    .activateAfterLongPress(350)
    .onStart((e) => {
      // 블록 위에서 시작하면 이동 모드, 빈 곳이면 생성 모드
      let grabbed: (typeof hitRects)[number] | null = null;
      for (const r of hitRects) {
        if (e.x >= r.x0 && e.x <= r.x1 && e.y >= r.y0 && e.y <= r.y1) {
          grabbed = r;
          break;
        }
      }
      if (grabbed) {
        moveId.value = grabbed.id;
        moveDur.value = grabbed.dur;
        grabDy.value = e.y - grabbed.y0;
        pCol.value = Math.max(0, Math.min(numDays - 1, Math.floor(e.x / colW)));
        pTop.value = Math.round(grabbed.y0 / SNAP) * SNAP;
        pHeight.value = (grabbed.dur / 60) * HOUR_H;
        pVisible.value = 1;
        const s = Math.round((pTop.value / HOUR_H) * 60);
        lastS.value = s;
        lastE.value = s + grabbed.dur;
        runOnJS(setSlot)({ s, e: s + grabbed.dur });
        runOnJS(tickHaptic)();
        return;
      }
      moveId.value = -1;
      const col = Math.max(0, Math.min(numDays - 1, Math.floor(e.x / colW)));
      const top = Math.max(0, Math.round(e.y / SNAP) * SNAP);
      pCol.value = col;
      startY.value = top;
      pTop.value = top;
      pHeight.value = SNAP;
      pVisible.value = 1;
      const s = Math.round((top / HOUR_H) * 60);
      lastS.value = s;
      lastE.value = s + 30;
      runOnJS(setSlot)({ s, e: s + 30 });
      runOnJS(tickHaptic)(); // 롱프레스 활성 시 햅틱
    })
    .onUpdate((e) => {
      if (moveId.value >= 0) {
        // 이동: 블록 전체를 손가락 따라 (30분 스냅, 컬럼 전환 가능)
        const maxTop = 24 * HOUR_H - pHeight.value;
        const top = Math.max(0, Math.min(maxTop, Math.round((e.y - grabDy.value) / SNAP) * SNAP));
        pTop.value = top;
        pCol.value = Math.max(0, Math.min(numDays - 1, Math.floor(e.x / colW)));
        const s = Math.round((top / HOUR_H) * 60);
        if (s !== lastS.value) {
          lastS.value = s;
          lastE.value = s + moveDur.value;
          runOnJS(setSlot)({ s, e: s + moveDur.value });
        }
        return;
      }
      const endY = Math.max(startY.value + SNAP, Math.round(e.y / SNAP) * SNAP);
      pTop.value = startY.value;
      pHeight.value = endY - startY.value;
      const s = Math.round((startY.value / HOUR_H) * 60);
      const en = Math.round((endY / HOUR_H) * 60);
      if (s !== lastS.value || en !== lastE.value) {
        lastS.value = s;
        lastE.value = en;
        runOnJS(setSlot)({ s, e: en });
      }
    })
    .onEnd(() => {
      if (moveId.value >= 0) {
        runOnJS(handleMove)(moveId.value, pCol.value, pTop.value, moveDur.value);
      } else {
        runOnJS(handleCreate)(pCol.value, pTop.value, pTop.value + pHeight.value);
      }
      pVisible.value = 0;
      moveId.value = -1;
      runOnJS(setSlot)(null);
    })
    .onFinalize(() => {
      pVisible.value = 0;
      moveId.value = -1;
      runOnJS(setSlot)(null);
    });

  const previewStyle = useAnimatedStyle(() => ({
    opacity: pVisible.value,
    top: pTop.value,
    height: pHeight.value,
    left: pCol.value * colW + 1,
    width: Math.max(0, colW - 2),
  }));

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // 종일(시간 없는) 이벤트 — 요일 헤더 아래 별도 행 (웹 AllDayRow 대응)
  const allDayByCol = useMemo(
    () => days.map((d) => (eventsByDate[ymd(d)] ?? []).filter((t) => toMin(t.startTime) == null)),
    [days, eventsByDate],
  );
  const hasAllDay = allDayByCol.some((l) => l.length > 0);
  const allDayMax = numDays === 1 ? 4 : 2;

  return (
    <View style={styles.flex1}>
      {/* 요일 헤더 */}
      <View style={styles.header}>
        <View style={{ width: GUTTER }} />
        {days.map((d) => {
          const key = ymd(d);
          const isToday = key === today;
          const inner = (
            <>
              <ThemedText type="label" style={{ color: weekdayColor(d.getDay(), theme) }}>
                {WEEKDAY_LABELS[d.getDay()]}
              </ThemedText>
              <View style={[styles.headDay, isToday && { backgroundColor: theme.primary }]}>
                <ThemedText type="label" style={{ color: isToday ? readableOn(theme.primary) : theme.text, fontWeight: '700' }}>
                  {d.getDate()}
                </ThemedText>
              </View>
            </>
          );
          // 요일 헤더 탭 = 그날 전체 일정 시트 (종일 "+N"과 같은 동선)
          return onOpenDay ? (
            <Pressable
              key={key}
              style={styles.headCol}
              onPress={() => onOpenDay(key)}
              accessibilityRole="button"
              accessibilityLabel={`${d.getMonth() + 1}월 ${d.getDate()}일 일정 보기`}>
              {inner}
            </Pressable>
          ) : (
            <View key={key} style={styles.headCol}>
              {inner}
            </View>
          );
        })}
      </View>

      {/* 종일 행 */}
      {hasAllDay ? (
        <View style={[styles.allDayRow, { borderBottomColor: theme.divider }]}>
          <View style={styles.allDayGutter}>
            <ThemedText type="label" style={{ color: theme.textSecondary, fontSize: 10 }}>
              종일
            </ThemedText>
          </View>
          {allDayByCol.map((list, i) => (
            <View key={ymd(days[i])} style={styles.allDayCol}>
              {list.slice(0, allDayMax).map((t) => {
                const color = eventColor(t);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => t.id != null && onOpen(t.id)}
                    style={[styles.allDayChip, { backgroundColor: `${color}26`, borderLeftColor: color }]}>
                    <ThemedText type="label" numberOfLines={1} style={styles.allDayChipText}>
                      {t.title}
                    </ThemedText>
                  </Pressable>
                );
              })}
              {/* 접힌 종일 일정 — 탭하면 그날 전체 목록. 열 수 없을 땐(onOpenDay 미지정)
                  탭 가능한 색/역할을 주지 않는다(누르면 아무 일도 안 나는 버튼 방지) */}
              {list.length > allDayMax ? (
                onOpenDay ? (
                  <Pressable
                    onPress={() => onOpenDay(ymd(days[i]))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`가려진 종일 일정 ${list.length - allDayMax}개 더 보기`}>
                    {/* 주 뷰는 컬럼 폭이 ~47pt라 "더보기"까지 넣으면 줄바꿈으로 행이 늘어난다 */}
                    <ThemedText type="label" numberOfLines={1} style={{ color: theme.primary, fontSize: 10, fontWeight: '700' }}>
                      {numDays === 1 ? `+${list.length - allDayMax}개 더보기` : `+${list.length - allDayMax}`}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText type="label" style={{ color: theme.textSecondary, fontSize: 10 }}>
                    +{list.length - allDayMax}
                  </ThemedText>
                )
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: initialY }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomInset + 16 }}>
        <View style={styles.grid}>
          {/* 시간 격자(가로선) + 시간 라벨 */}
          {hours.map((h) => (
            <View key={h} style={[styles.hourRow, { borderTopColor: theme.divider }]}>
              <ThemedText type="label" style={[styles.hourLabel, { color: theme.textSecondary }]}>
                {pad(h)}:00
              </ThemedText>
            </View>
          ))}
          {/* 마지막 24:00 라벨 (그리드 맨 아래 경계) */}
          <ThemedText type="label" style={[styles.hourLabel, { color: theme.textSecondary, top: 24 * HOUR_H - 7 }]}>
            24:00
          </ThemedText>

          {/* 현재 시간 라벨 (거터, 빨강) */}
          {todayCol >= 0 ? (
            <View style={[styles.timeTag, { top: (nowMin / 60) * HOUR_H - 8, backgroundColor: theme.background }]} pointerEvents="none">
              <ThemedText type="label" style={{ color: theme.danger, fontWeight: '800', fontSize: 11 }}>
                {minToHHmm(nowMin)}
              </ThemedText>
            </View>
          ) : null}

          {/* 롱프레스 선택 시간 라벨 (거터, primary) */}
          {slot ? (
            <>
              <View style={[styles.timeTag, { top: (slot.s / 60) * HOUR_H - 8, backgroundColor: theme.background }]} pointerEvents="none">
                <ThemedText type="label" style={{ color: theme.primary, fontWeight: '800', fontSize: 11 }}>
                  {minToHHmm(slot.s)}
                </ThemedText>
              </View>
              <View style={[styles.timeTag, { top: (slot.e / 60) * HOUR_H - 8, backgroundColor: theme.background }]} pointerEvents="none">
                <ThemedText type="label" style={{ color: theme.primary, fontWeight: '800', fontSize: 11 }}>
                  {minToHHmm(slot.e)}
                </ThemedText>
              </View>
            </>
          ) : null}

          {/* 컬럼(세로선) + 이벤트 — 거터 오른쪽 */}
          <View style={styles.cols} onLayout={(e) => setColsW(e.nativeEvent.layout.width)}>
            <GestureDetector gesture={createGesture}>
              <View style={styles.flex1}>
                {/* 세로 구분선 */}
                {days.map((d, i) => (
                  <View key={ymd(d)} style={[styles.colLine, { left: `${(100 / numDays) * i}%`, backgroundColor: theme.divider }]} />
                ))}
                {/* 이벤트 블록 — 겹치는 이벤트는 컬럼을 나눠 나란히 */}
                {colsW > 0 &&
                  days.map((d, col) => {
                    const placed = layoutDay(eventsByDate[ymd(d)] ?? []);
                    return placed.map(({ t, s, e, col: sub, cols }) => {
                      const top = (s / 60) * HOUR_H;
                      const height = Math.max(((e - s) / 60) * HOUR_H - 2, 18);
                      const w = (colW - 2) / cols;
                      const color = eventColor(t);
                      const assignees = t.assignees ?? [];
                      // 담당자 아바타는 블록이 충분히 높고(≥40px) 단일 컬럼일 때만 — 좁은 블록엔 제목만(웹 타임라인 미러)
                      const showAvatars = assignees.length > 0 && height >= 40 && cols === 1;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => t.id != null && onOpen(t.id)}
                          style={[
                            styles.block,
                            { top, height, left: col * colW + 1 + sub * w, width: w - (cols > 1 ? 1 : 0), backgroundColor: `${color}26`, borderLeftColor: color },
                          ]}>
                          <ThemedText type="label" numberOfLines={showAvatars ? 1 : 2} style={styles.blockTitle}>
                            {t.title}
                          </ThemedText>
                          {showAvatars ? (
                            <View style={styles.blockAvatars}>
                              <AvatarStack people={assignees} size={16} max={3} />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    });
                  })}
                {/* 현재 시간선 */}
                {todayCol >= 0 ? (
                  <View style={[styles.nowLine, { top: (nowMin / 60) * HOUR_H, backgroundColor: theme.danger }]} pointerEvents="none">
                    <View style={[styles.nowDot, { left: todayCol * colW - 3, backgroundColor: theme.danger }]} />
                  </View>
                ) : null}
                {/* 롱프레스 드래그 미리보기 */}
                <Animated.View style={[styles.preview, { backgroundColor: `${theme.primary}33`, borderColor: theme.primary }, previewStyle]} pointerEvents="none" />
              </View>
            </GestureDetector>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  header: { flexDirection: 'row', paddingBottom: 4 },
  headCol: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  allDayRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  allDayGutter: { width: GUTTER, alignItems: 'center', paddingTop: 3 },
  allDayCol: { flex: 1, gap: 2, paddingHorizontal: 1 },
  allDayChip: { borderRadius: 4, borderLeftWidth: 2, paddingHorizontal: 3, paddingVertical: 1.5 },
  allDayChipText: { fontSize: 10, fontWeight: '600' },
  headDay: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  grid: { position: 'relative' },
  hourRow: { height: HOUR_H, borderTopWidth: StyleSheet.hairlineWidth, paddingLeft: GUTTER },
  hourLabel: { position: 'absolute', left: 6, top: -7, fontSize: 11 },
  timeTag: { position: 'absolute', left: 2, paddingHorizontal: 2, zIndex: 5 },
  cols: { position: 'absolute', left: GUTTER, right: 0, top: 0, bottom: 0 },
  colLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  block: { position: 'absolute', borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 4, paddingVertical: 2, overflow: 'hidden' },
  blockTitle: { fontSize: 11, fontWeight: '600' },
  blockAvatars: { marginTop: 2 },
  preview: { position: 'absolute', borderRadius: 6, borderWidth: 1, borderStyle: 'dashed' },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 1.5 },
  nowDot: { position: 'absolute', top: -3.5, width: 8, height: 8, borderRadius: 4 },
});
