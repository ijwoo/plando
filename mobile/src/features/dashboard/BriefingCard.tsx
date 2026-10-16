import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toDateString } from '@/shared/utils/datetime';
import { shadow } from '@/shared/ui/tokens';
import { useStatusMap } from '@/features/status/queries';
import { getPeriodTasks, type PeriodTask } from './api';

// AI 시그니처 그라디언트 (인디고→시안) — 브리핑·AI 기능 공통 포커스 컬러
export const AI_FROM = '#6366F1';
export const AI_TO = '#22B8CF';

/**
 * 지난주 월요일 ~ 이번 주 일요일(월요일 시작 주) 경계 — YYYY-MM-DD.
 * 웹 useDashboardData의 getThisWeekRange/getLastWeekRange 미러 (dueDate가 ymd 문자열이라 문자열 비교로 동치).
 */
function weekBounds(now: Date) {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const ymd = (offset: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return toDateString(d);
  };
  return { thisStart: ymd(0), thisEnd: ymd(6), lastStart: ymd(-7), lastEnd: ymd(-1) };
}

/** 구간 완료율(%) — dueDate가 [from, to]인 태스크의 DONE 비율. 태스크 없으면 null. isDone: 커스텀 완료 상태(카테고리) 판정. */
function completionRate(tasks: PeriodTask[], from: string, to: string, isDone: (t: PeriodTask) => boolean): number | null {
  const inRange = tasks.filter((t) => t.dueDate && t.dueDate >= from && t.dueDate <= to);
  if (inRange.length === 0) return null;
  return Math.round((inRange.filter(isDone).length / inRange.length) * 100);
}

/**
 * 홈 브리핑 카드 (1단계 — 로컬 조합 목업, AI 미사용).
 * 시간대 인사 + 오늘 요약 문장 + 진행률 링 + (임박 시) Up Next.
 * 오늘 전부 완료면 셀레브레이션 변형. 문장 조합부는 나중에 AI 응답으로 교체 가능한 단일 지점.
 */
export function BriefingCard({
  name,
  todayOpen,
  todayDone,
  overdue,
  next,
  onPressToday,
}: {
  name?: string;
  /** 오늘 마감(미완료) */
  todayOpen: number;
  /** 오늘 완료 */
  todayDone: number;
  overdue: number;
  /** 다음 일정 (오늘, 현재 이후 가장 이른 것) */
  next: { title: string; time: string } | null;
  onPressToday: () => void;
}) {
  const theme = useTheme();
  // 마운트 시점 기준 — 분 단위 실시간 갱신은 불필요(당겨서 새로고침으로 충분)
  const [now] = useState(() => new Date());
  // svg 그라디언트는 퍼센트 크기가 첫 레이아웃에 고정되는 경우가 있어 실측 크기로 그린다
  const [box, setBox] = useState({ w: 0, h: 0 });
  const hour = now.getHours();

  // 주간 완료율 — 지난주 월요일~이번 주 일요일 dueDate 범위의 태스크(웹 periodTasks 미러, archived 무관)
  const bounds = useMemo(() => weekBounds(now), [now]);
  const wsActive = useWorkspaceStore((s) => s.activeId) != null;
  const { data: periodTasks } = useQuery({
    queryKey: ['dashboard', 'period-tasks', bounds.lastStart, bounds.thisEnd],
    queryFn: () => getPeriodTasks(bounds.lastStart, bounds.thisEnd),
    enabled: wsActive,
    staleTime: 5 * 60_000,
  });
  // PeriodTaskDto엔 doneAt이 없어 상태 key의 카테고리로 완료 판정 (커스텀 완료 상태 대응)
  const { category } = useStatusMap();
  const weekly = useMemo(() => {
    if (!periodTasks) return null;
    const isDone = (t: PeriodTask) => category(t.status) === 'DONE';
    const rate = completionRate(periodTasks, bounds.thisStart, bounds.thisEnd, isDone);
    if (rate == null) return null; // 이번 주 할 일 없음 — 칩 생략
    const lastRate = completionRate(periodTasks, bounds.lastStart, bounds.lastEnd, isDone);
    // 웹 weeklyDelta와 동일 — 지난주 태스크가 없으면 0
    return { rate, delta: lastRate == null ? 0 : rate - lastRate };
  }, [periodTasks, bounds, category]);

  const { greetIcon, greeting, body, celebrate } = useMemo(() => {
    const total = todayOpen + todayDone;
    const who = name ? `${name}님` : '';
    const greet =
      hour < 5 ? { i: 'moon', t: `늦은 밤이에요${who ? `, ${who}` : ''}` }
      : hour < 12 ? { i: 'sunny', t: `좋은 아침이에요${who ? `, ${who}` : ''}` }
      : hour < 18 ? { i: 'partly-sunny', t: `좋은 오후예요${who ? `, ${who}` : ''}` }
      : { i: 'moon', t: `하루 마무리 잘 하고 있어요${who ? `, ${who}` : ''}` };

    // 전부 완료 — 셀레브레이션
    if (total > 0 && todayOpen === 0) {
      return {
        greetIcon: greet.i,
        greeting: greet.t,
        body: `오늘 할 일 ${total}건을 모두 끝냈어요. 남은 하루도 가볍게 보내세요!`,
        celebrate: true,
      };
    }

    // 요약 문장 조합 — 이 부분만 AI 응답으로 교체하면 2단계
    const parts: string[] = [];
    if (todayOpen > 0) parts.push(`오늘 할 일이 ${todayOpen}건 남아 있어요`);
    else parts.push('오늘 마감인 할 일은 없어요');
    if (next) parts.push(`${next.time}에 '${next.title}'${todayOpen > 0 ? '이(가) 예정돼 있어요' : '부터 시작해요'}`);
    if (overdue > 0) parts.push(`지연 ${overdue}건은 오늘 정리하는 걸 추천해요`);
    return { greetIcon: greet.i, greeting: greet.t, body: parts.join('. ') + '.', celebrate: false };
  }, [hour, name, todayOpen, todayDone, overdue, next]);

  const total = todayOpen + todayDone;
  const pct = total > 0 ? todayDone / total : 0;

  return (
    <Pressable
      onPress={onPressToday}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((prev) => (prev.w !== width || prev.h !== height ? { w: width, h: height } : prev));
      }}
      accessibilityLabel="오늘 브리핑"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.isDark ? theme.border : 'transparent' },
        !theme.isDark && shadow.raised,
        pressed && { opacity: 0.92 },
      ]}>
      {/* AI 시그니처 그라디언트 배경 + 좌측 악센트 바 */}
      <View style={styles.gradientFill} pointerEvents="none">
        {box.w > 0 && box.h > 0 ? (
          <Svg width={box.w} height={box.h}>
            <Defs>
              <LinearGradient id="briefBg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={AI_FROM} stopOpacity={theme.isDark ? 0.16 : 0.08} />
                <Stop offset="1" stopColor={AI_TO} stopOpacity={theme.isDark ? 0.1 : 0.05} />
              </LinearGradient>
              <LinearGradient id="briefBar" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={celebrate ? theme.green : AI_FROM} />
                <Stop offset="1" stopColor={celebrate ? theme.green : AI_TO} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={box.w} height={box.h} rx="16" fill="url(#briefBg)" />
            <Rect x="0" y="0" width="3.5" height={box.h} fill="url(#briefBar)" />
          </Svg>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.greetRow}>
          <Ionicons name={(celebrate ? 'sparkles' : greetIcon) as keyof typeof Ionicons.glyphMap} size={13} color={celebrate ? theme.green : AI_FROM} />
          <ThemedText type="small" style={[styles.greeting, { color: celebrate ? theme.green : AI_FROM }]}>
            {celebrate ? '오늘 다 비웠어요!' : greeting}
          </ThemedText>
        </View>
        <ThemedText type="default" style={styles.text}>
          {body}
        </ThemedText>
        {next && !celebrate ? (
          <View style={[styles.nextRow, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)' }]}>
            <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
            <ThemedText type="small" style={[styles.nextText, { color: theme.text }]} numberOfLines={1}>
              다음 일정 · {next.time} {next.title}
            </ThemedText>
          </View>
        ) : null}
        {weekly ? (
          <View
            style={styles.weeklyRow}
            accessibilityLabel={`이번 주 완료율 ${weekly.rate}퍼센트, ${
              weekly.delta === 0 ? '지난주와 변화 없음' : `지난주보다 ${weekly.delta > 0 ? '+' : ''}${weekly.delta}퍼센트포인트`
            }`}>
            <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
              이번 주 완료율 {weekly.rate}% ·{' '}
            </ThemedText>
            <Ionicons
              name={weekly.delta > 0 ? 'arrow-up' : weekly.delta < 0 ? 'arrow-down' : 'remove'}
              size={11}
              // 하락은 경고색(빨강) 대신 중립 — 완료율 dip을 첫인상에서 알람처럼 보이지 않게
              color={weekly.delta > 0 ? theme.green : theme.textTertiary}
            />
            <ThemedText
              type="small"
              numberOfLines={1}
              style={[styles.weeklyDelta, { color: weekly.delta > 0 ? theme.green : theme.textTertiary }]}>
              {weekly.delta === 0 ? '지난주와 변화 없음' : `지난주보다 ${weekly.delta > 0 ? '+' : ''}${weekly.delta}%p`}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {/* 오늘 진행률 링 */}
      {total > 0 ? (
        <View style={styles.ringBox}>
          <ProgressRing size={52} stroke={5} progress={pct} color={celebrate ? theme.green : AI_FROM} track={theme.divider} />
          <View style={styles.ringLabel} pointerEvents="none">
            <ThemedText type="small" style={styles.ringText}>
              {todayDone}/{total}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

/** SVG 원형 진행률 링 */
export function ProgressRing({
  size,
  stroke,
  progress,
  color,
  track,
}: {
  size: number;
  stroke: number;
  progress: number; // 0~1
  color: string;
  track: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c}`}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    paddingLeft: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gradientFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, overflow: 'hidden' },
  body: { flex: 1, gap: 5 },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  greeting: { fontWeight: '800', letterSpacing: 0.2 },
  text: { lineHeight: 21 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, marginTop: 2 },
  nextText: { fontWeight: '600' },
  weeklyRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  weeklyDelta: { fontWeight: '700', flexShrink: 1 },
  ringBox: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontWeight: '800', fontSize: 11 },
});
