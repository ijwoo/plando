import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import type { PeriodTask } from '@/features/dashboard/api';
import {
  useOverdueTasks,
  usePeriodTasks,
  useWorkspacePresence,
  useWorkspaceUsers,
} from '@/features/dashboard/queries';
import { isTodoDone, useStatusMap } from '@/features/status/queries';
import { useTodos } from '@/features/todo/queries';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/shared/ui/Avatar';
import { Skeleton } from '@/shared/ui/Skeleton';
import { getPriorityLabel, priorityColor } from '@/shared/ui/tone';
import { radius, shadow } from '@/shared/ui/tokens';
import { toDateString } from '@/shared/utils/datetime';

/* ── 웹 대시보드 산식 미러 (useDashboardData / DashboardMobile) ───────────── */

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const HEAT_ROW_LABELS = ['월', '', '수', '', '금', '', '일'];
const KO_DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 지난주 월요일 ~ 이번 주 일요일 경계(YYYY-MM-DD) — 웹 getThisWeekRange/getLastWeekRange 미러. */
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

/** 이번 주 월~일 7일 (YYYY-MM-DD) — 웹 getWeekDates 미러. */
function weekDates(now: Date): string[] {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateString(d);
  });
}

/** ymd 간 일수 차 (to - from) — 로컬 자정 기준(웹 dDiff 산식과 동치). */
function daysBetween(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/** 구간 완료율(%) — 없으면 null. 웹 weeklyCompletionRate 산식. isDone: 커스텀 완료 상태 판정(카테고리). */
function completionRate(tasks: PeriodTask[], from: string, to: string, isDone: (t: PeriodTask) => boolean): number | null {
  const inRange = tasks.filter((t) => t.dueDate && t.dueDate >= from && t.dueDate <= to);
  if (inRange.length === 0) return null;
  return Math.round((inRange.filter(isDone).length / inRange.length) * 100);
}

/** 완료율 → 색 — 웹 getRateColor 미러. */
function rateColor(rate: number): string {
  if (rate >= 80) return '#00C48C';
  if (rate >= 60) return '#3D7BFF';
  if (rate >= 40) return '#F59E0B';
  return '#F43F5E';
}

/** D-Day 색/라벨 — 웹 DDaySlide 미러. */
function dDayColor(diff: number): string {
  if (diff <= 2) return '#FF5A5A';
  if (diff <= 5) return '#FF9500';
  return '#3D7BFF';
}
function dDayLabel(diff: number): string {
  if (diff === 0) return 'D-day';
  if (diff < 0) return `D+${Math.abs(diff)}`;
  return `D-${diff}`;
}
function formatDueKr(ymd?: string): string {
  if (!ymd) return '';
  const [, m, d] = ymd.split('-');
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

/** 히트맵 강도 레벨 — 웹 ActivityHeatmapCard getLevel 미러. */
function heatLevel(count: number): number {
  if (!count || count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

/** #RRGGBB + 불투명도(0~1) → #RRGGBBAA. 테마 primary 틴트용. */
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

const CELL = 13;
const GAP = 4;

/**
 * 팀 통계 — 웹 모바일 대시보드의 통계 카드(주간 완료율·D-Day·멤버 현황·활동 히트맵)를
 * 네이티브 카드 스택으로 이식. 홈 BriefingCard의 주간 칩이 요약이라면 이 화면이 딥뷰.
 */
export default function StatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  // 마운트 시점 고정 — 당겨서 새로고침으로 충분 (BriefingCard와 동일)
  const [now] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const bounds = weekBounds(now);
  const todayYmd = toDateString(now);

  const periodQ = usePeriodTasks(bounds.lastStart, bounds.thisEnd);
  const todosQ = useTodos();
  const overdueQ = useOverdueTasks();
  const usersQ = useWorkspaceUsers();
  const presenceQ = useWorkspacePresence();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all(
      [['dashboard'], ['todos']].map((key) => qc.invalidateQueries({ queryKey: key })),
    );
    setRefreshing(false);
  };

  const retry = () => {
    void periodQ.refetch();
    void todosQ.refetch();
    void overdueQ.refetch();
    void usersQ.refetch();
    void presenceQ.refetch();
  };

  // ── 파생 계산 (웹 useDashboardData 미러, React Compiler가 메모이즈) ──
  const periodTasks = periodQ.data ?? [];
  const todos = todosQ.data ?? [];
  // PeriodTaskDto엔 doneAt이 없어 상태 key의 카테고리로 완료 판정 (커스텀 완료 상태 대응)
  const { category } = useStatusMap();
  const isPeriodDone = (t: PeriodTask) => category(t.status) === 'DONE';

  // 주간 바 — 이번 주 7일 각각의 done/total
  const days = weekDates(now);
  const bars = days.map((d) => {
    const dayTasks = periodTasks.filter((t) => t.dueDate === d);
    return { date: d, done: dayTasks.filter(isPeriodDone).length, total: dayTasks.length };
  });
  const totalDone = bars.reduce((s, b) => s + b.done, 0);
  const totalAll = bars.reduce((s, b) => s + b.total, 0);
  const maxBar = Math.max(1, ...bars.map((b) => b.total));

  const weeklyRate = completionRate(periodTasks, bounds.thisStart, bounds.thisEnd, isPeriodDone) ?? 0;
  const lastRate = completionRate(periodTasks, bounds.lastStart, bounds.lastEnd, isPeriodDone);
  const weeklyDelta = lastRate == null ? 0 : weeklyRate - lastRate; // 지난주 태스크 없으면 0
  const deltaPositive = weeklyDelta >= 0;

  // D-Day — 미완료+마감일 있는 할 일 중 임박 4개
  const dDayTasks = todos
    .flatMap((t) => (t.dueDate && !isTodoDone(t) ? [{ ...t, dDiff: daysBetween(todayYmd, t.dueDate) }] : []))
    .sort((a, b) => a.dDiff - b.dDiff)
    .slice(0, 4);
  const overdueCount = overdueQ.data?.length ?? 0;

  // 멤버 현황 — 전체 멤버 0% 초기화 후 이번 주 dueDate 태스크의 assignees 집계
  const memberMap: Record<string, { email: string; name: string; profileImageUrl?: string; total: number; done: number }> = {};
  for (const u of usersQ.data ?? []) {
    if (!u.email) continue;
    memberMap[u.email] = {
      email: u.email,
      name: u.name || u.email.split('@')[0],
      profileImageUrl: u.profileImageUrl,
      total: 0,
      done: 0,
    };
  }
  for (const t of periodTasks) {
    if (!t.dueDate || t.dueDate < bounds.thisStart || t.dueDate > bounds.thisEnd) continue;
    for (const email of t.assignees ?? []) {
      memberMap[email] ??= { email, name: email.split('@')[0], total: 0, done: 0 };
      memberMap[email].total++;
      if (isPeriodDone(t)) memberMap[email].done++;
    }
  }
  const memberStats = Object.values(memberMap)
    .map((s) => ({ ...s, rate: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate);
  const avgRate = memberStats.length > 0 ? Math.round(memberStats.reduce((s, m) => s + m.rate, 0) / memberStats.length) : 0;
  const memberDoneSum = memberStats.reduce((s, m) => s + m.done, 0);
  const presence = presenceQ.data; // 실패 시 undefined → 프레즌스 점 생략

  // 히트맵 — 이번 달 dueDate 기준 완료 수 (웹 heatmapCounts 미러)
  const year = now.getFullYear();
  const month = now.getMonth();
  const heatCounts: Record<number, number> = {};
  for (const t of todos) {
    if (!isTodoDone(t) || !t.dueDate) continue;
    const [ty, tm, td] = t.dueDate.split('-').map(Number);
    if (ty === year && tm === month + 1) heatCounts[td] = (heatCounts[td] ?? 0) + 1;
  }
  const monthlyDone = Object.values(heatCounts).reduce((s, c) => s + c, 0);
  const activeDays = Object.values(heatCounts).filter((c) => c > 0).length;
  let bestDay: string | null = null;
  {
    let bestCount = 0;
    for (const [day, count] of Object.entries(heatCounts)) {
      if (count > bestCount) {
        bestCount = count;
        bestDay = KO_DOW[new Date(year, month, Number(day)).getDay()];
      }
    }
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const numCols = Math.ceil((firstDow + daysInMonth) / 7);
  const heatCols = Array.from({ length: numCols }, (_, col) =>
    Array.from({ length: 7 }, (_, row) => {
      const dayNum = col * 7 + row - firstDow + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      return { day: dayNum, count: heatCounts[dayNum] ?? 0 };
    }),
  );
  const heatColors = [
    theme.isDark ? 'rgba(255,255,255,0.07)' : withAlpha(theme.primary, 0.08),
    withAlpha(theme.primary, 0.22),
    withAlpha(theme.primary, 0.42),
    withAlpha(theme.primary, 0.65),
    theme.primary,
  ];

  const loading = periodQ.isLoading || todosQ.isLoading || usersQ.isLoading;
  const coreError = (periodQ.isError && !periodQ.data) || (todosQ.isError && !todosQ.data);
  const isEmpty = !loading && !coreError && periodTasks.length === 0 && todos.length === 0;

  const cardBase = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
  };
  const todoFill = theme.isDark ? 'rgba(255,255,255,0.10)' : withAlpha(theme.primary, 0.14);
  const stubFill = theme.isDark ? 'rgba(255,255,255,0.06)' : withAlpha(theme.primary, 0.08);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom', 'left', 'right']}>
      {/* 정적 옵션만 사용 — 인라인 함수 옵션(headerLeft/Right 클로저)은 무한 루프 이슈 */}
      <Stack.Screen options={{ headerShown: true, title: '팀 통계' }} />

      {loading ? (
        <View style={styles.skeletonStack}>
          <Skeleton style={styles.skeletonHero} />
          <Skeleton style={styles.skeletonCard} />
          <Skeleton style={styles.skeletonMembers} />
          <Skeleton style={styles.skeletonCard} />
        </View>
      ) : coreError ? (
        <View style={styles.center}>
          <ThemedText type="default" style={{ color: theme.danger }}>
            {getApiErrorMessage(periodQ.error ?? todosQ.error)}
          </ThemedText>
          <Pressable onPress={retry} hitSlop={8}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="stats-chart-outline" size={30} color={theme.textTertiary} />
          </View>
          <ThemedText type="default" style={styles.emptyTitle}>
            아직 통계로 보여줄 데이터가 없어요
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textTertiary, textAlign: 'center' }}>
            할 일에 마감일을 달면{'\n'}주간 완료율과 활동 히트맵이 채워져요.
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {/* ── 주간 완료율 히어로 ── */}
          <View style={[styles.card, cardBase, !theme.isDark && shadow.card]}>
            <View style={styles.cardHead}>
              <ThemedText type="small" style={[styles.cardLabel, { color: theme.textSecondary }]}>
                이번 주 완료
              </ThemedText>
              <View
                style={[
                  styles.deltaChip,
                  { backgroundColor: withAlpha(deltaPositive ? theme.green : theme.danger, theme.isDark ? 0.18 : 0.12) },
                ]}>
                <ThemedText type="small" style={[styles.deltaText, { color: deltaPositive ? theme.green : theme.danger }]}>
                  {deltaPositive ? '+' : ''}
                  {weeklyDelta}%
                </ThemedText>
              </View>
            </View>
            <View style={styles.heroNumRow}>
              <ThemedText type="num" style={styles.heroNum}>
                {totalDone}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textTertiary, fontWeight: '600' }}>
                / {totalAll} 완료
              </ThemedText>
              <View style={styles.flexSpacer} />
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                {weeklyRate}%
              </ThemedText>
            </View>

            {/* 7일 적층 막대 — 완료(채움) + 미완료(틴트), 오늘 강조 */}
            <View style={styles.barsRow}>
              {bars.map((b, i) => {
                const isToday = b.date === todayYmd;
                const totalH = Math.max(8, (b.total / maxBar) * 56);
                const doneH = b.total > 0 ? (b.done / b.total) * totalH : 0;
                const todoH = totalH - doneH;
                return (
                  <View key={b.date} style={styles.barCol}>
                    {b.total === 0 ? (
                      <View style={[styles.barStub, { backgroundColor: stubFill }]} />
                    ) : (
                      <View style={[styles.barStack, { height: totalH }]}>
                        {todoH > 0 ? (
                          <View style={{ flexGrow: 0, height: todoH, backgroundColor: isToday ? withAlpha(theme.primary, 0.28) : todoFill }} />
                        ) : null}
                        {doneH > 0 ? <View style={{ flexGrow: 0, height: doneH, backgroundColor: theme.primary }} /> : null}
                      </View>
                    )}
                    <ThemedText
                      type="small"
                      style={[styles.barDay, { color: isToday ? theme.primary : theme.textTertiary, fontWeight: isToday ? '800' : '600' }]}>
                      {DAY_LABELS[i]}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            {/* 범례 */}
            <View style={[styles.legendRow, { borderTopColor: theme.divider }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
                <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>
                  완료 {totalDone}
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: todoFill, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]} />
                <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>
                  미완료 {totalAll - totalDone}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* ── 마감 D-Day ── */}
          <View style={[styles.card, cardBase, !theme.isDark && shadow.card]}>
            <View style={styles.cardHead}>
              <ThemedText type="small" style={[styles.cardLabel, { color: theme.textSecondary }]}>
                마감 D-Day
              </ThemedText>
              {overdueCount > 0 ? (
                <View style={[styles.deltaChip, { backgroundColor: withAlpha('#FF5A5A', theme.isDark ? 0.18 : 0.1) }]}>
                  <ThemedText type="small" style={[styles.deltaText, { color: '#FF5A5A' }]}>
                    {overdueCount}개 지연
                  </ThemedText>
                </View>
              ) : null}
            </View>
            {dDayTasks.length === 0 ? (
              <View style={styles.sectionEmpty}>
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.textTertiary} />
                <ThemedText type="small" style={{ color: theme.textTertiary, fontWeight: '600' }}>
                  마감 예정 일정이 없어요
                </ThemedText>
              </View>
            ) : (
              dDayTasks.map((t, i) => {
                const color = dDayColor(t.dDiff);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => t.id != null && router.push(`/todo/${t.id}`)}
                    style={({ pressed }) => [
                      styles.dDayRow,
                      i > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <View style={[styles.dDayBadge, { backgroundColor: withAlpha(color, theme.isDark ? 0.2 : 0.12) }]}>
                      <ThemedText type="small" style={[styles.dDayBadgeText, { color }]}>
                        {dDayLabel(t.dDiff)}
                      </ThemedText>
                      <ThemedText style={[styles.dDayBadgeSub, { color }]}>마감</ThemedText>
                    </View>
                    <View style={styles.dDayBody}>
                      <ThemedText type="default" numberOfLines={1} style={styles.dDayTitle}>
                        {t.title ?? '할 일'}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textTertiary }}>
                        {formatDueKr(t.dueDate)}
                      </ThemedText>
                    </View>
                    <View style={[styles.priorityPill, { backgroundColor: withAlpha(priorityColor(theme, t.priority), theme.isDark ? 0.2 : 0.12) }]}>
                      <ThemedText type="small" style={[styles.priorityText, { color: priorityColor(theme, t.priority) }]}>
                        {getPriorityLabel(t.priority)}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* ── 멤버 현황 ── */}
          {memberStats.length > 0 ? (
            <View style={[styles.card, cardBase, !theme.isDark && shadow.card]}>
              <View style={styles.cardHead}>
                <ThemedText type="small" style={[styles.cardLabel, { color: theme.textSecondary }]}>
                  멤버 현황
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textTertiary }}>
                  이번 주
                </ThemedText>
              </View>

              {/* 팀 평균 — 웹 MemberAverageCard 미러 */}
              <View style={styles.avgBlock}>
                <View style={styles.avgNumRow}>
                  <ThemedText type="num" style={styles.avgNum}>
                    {avgRate}
                  </ThemedText>
                  <ThemedText type="default" style={styles.avgPct}>
                    %
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textTertiary }}>
                    팀 평균 완료율
                  </ThemedText>
                  <View style={styles.flexSpacer} />
                  <ThemedText type="small" style={{ color: theme.textTertiary }}>
                    {memberStats.length}명 · {memberDoneSum}개 합산
                  </ThemedText>
                </View>
                <View style={[styles.rateTrack, { backgroundColor: withAlpha(theme.primary, 0.1) }]}>
                  <View style={[styles.rateFill, { width: `${avgRate}%`, backgroundColor: theme.primary }]} />
                </View>
              </View>

              {/* 멤버별 행 — 웹 MemberCard 미러 (+온라인 프레즌스 점) */}
              {memberStats.map((m) => {
                const color = rateColor(m.rate);
                const online = presence?.[m.email]?.online === true;
                return (
                  <View key={m.email} style={[styles.memberRow, { borderTopColor: theme.divider }]}>
                    <View style={styles.memberAvatarBox}>
                      <Avatar person={{ name: m.name, email: m.email, profileImageUrl: m.profileImageUrl }} size={36} />
                      {online ? <View style={[styles.presenceDot, { backgroundColor: theme.green, borderColor: theme.surface }]} /> : null}
                    </View>
                    <View style={styles.memberBody}>
                      <View style={styles.memberNameRow}>
                        <ThemedText type="default" numberOfLines={1} style={styles.memberName}>
                          {m.name}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textTertiary }}>
                          {m.done}/{m.total}
                        </ThemedText>
                        <View style={styles.flexSpacer} />
                        <ThemedText type="small" style={[styles.memberRate, { color }]}>
                          {m.rate}%
                        </ThemedText>
                      </View>
                      <View style={[styles.rateTrack, { backgroundColor: withAlpha(color, 0.12) }]}>
                        <View style={[styles.rateFill, { width: `${m.rate}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* ── 활동 히트맵 (이번 달) ── */}
          <View style={[styles.card, cardBase, !theme.isDark && shadow.card]}>
            <View style={styles.cardHead}>
              <ThemedText type="small" style={[styles.cardLabel, { color: theme.textSecondary }]}>
                활동 히트맵
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textTertiary }}>
                {month + 1}월
              </ThemedText>
            </View>
            <View style={styles.heatRow}>
              <View>
                <View style={styles.heatGrid}>
                  <View style={styles.heatLabelCol}>
                    {HEAT_ROW_LABELS.map((lbl, i) => (
                      <ThemedText key={i} style={[styles.heatRowLabel, { color: theme.textTertiary }]}>
                        {lbl}
                      </ThemedText>
                    ))}
                  </View>
                  {heatCols.map((col, ci) => (
                    <View key={ci} style={styles.heatCol}>
                      {col.map((cell, ri) => {
                        const isToday = cell?.day === now.getDate();
                        return (
                          <View
                            key={ri}
                            style={[
                              styles.heatCell,
                              { backgroundColor: cell == null ? 'transparent' : heatColors[heatLevel(cell.count)] },
                              isToday && { borderWidth: 1.5, borderColor: theme.primary },
                            ]}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
                <View style={styles.heatLegend}>
                  <ThemedText style={[styles.heatLegendText, { color: theme.textTertiary }]}>적음</ThemedText>
                  {heatColors.map((c, i) => (
                    <View key={i} style={[styles.heatLegendDot, { backgroundColor: c }]} />
                  ))}
                  <ThemedText style={[styles.heatLegendText, { color: theme.textTertiary }]}>많음</ThemedText>
                </View>
              </View>
              <View style={styles.heatStats}>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                  이번 달 완료
                </ThemedText>
                <ThemedText type="num" style={styles.heatBigNum}>
                  {monthlyDone}개
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  활동한 날{' '}
                  <ThemedText type="small" style={{ color: theme.primary, fontWeight: '800' }}>
                    {activeDays}일
                  </ThemedText>
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  가장 활발한 요일{' '}
                  <ThemedText type="small" style={{ color: theme.text, fontWeight: '800' }}>
                    {bestDay ? `${bestDay}요일` : '-'}
                  </ThemedText>
                </ThemedText>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  // 스켈레톤 — 카드 스택 자리 잡기
  skeletonStack: { padding: 16, gap: 12 },
  skeletonHero: { height: 190, borderRadius: radius.card },
  skeletonCard: { height: 150, borderRadius: radius.card },
  skeletonMembers: { height: 220, borderRadius: radius.card },
  // 빈 상태
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '700' },
  // 카드 공통
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardLabel: { fontWeight: '700' },
  flexSpacer: { flex: 1 },
  // 히어로
  deltaChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  deltaText: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  heroNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 12 },
  heroNum: { fontSize: 26, lineHeight: 30 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 76 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barStack: { width: '100%', maxWidth: 22, borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-end' },
  barStub: { width: '100%', maxWidth: 22, height: 4, borderRadius: 5 },
  barDay: { fontSize: 10, lineHeight: 13 },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  // D-Day
  sectionEmpty: { alignItems: 'center', gap: 5, paddingVertical: 18 },
  dDayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  dDayBadge: { minWidth: 46, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  dDayBadgeText: { fontSize: 13, fontWeight: '800', lineHeight: 15 },
  dDayBadgeSub: { fontSize: 8, fontWeight: '700', marginTop: 2 },
  dDayBody: { flex: 1, gap: 2, minWidth: 0 },
  dDayTitle: { fontWeight: '600' },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  priorityText: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  // 멤버
  avgBlock: { gap: 7, paddingBottom: 12 },
  avgNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  avgNum: { fontSize: 26, lineHeight: 30 },
  avgPct: { fontWeight: '700' },
  rateTrack: { height: 5, borderRadius: radius.pill, overflow: 'hidden' },
  rateFill: { height: '100%', borderRadius: radius.pill },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  memberAvatarBox: { position: 'relative' },
  presenceDot: { position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  memberBody: { flex: 1, gap: 6, minWidth: 0 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontWeight: '700', flexShrink: 1 },
  memberRate: { fontWeight: '800' },
  // 히트맵
  heatRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  heatGrid: { flexDirection: 'row', gap: GAP },
  heatLabelCol: { gap: GAP },
  heatRowLabel: { fontSize: 8, lineHeight: CELL, width: 12, textAlign: 'right' },
  heatCol: { gap: GAP },
  heatCell: { width: CELL, height: CELL, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingLeft: 16 },
  heatLegendText: { fontSize: 9, lineHeight: 12 },
  heatLegendDot: { width: 8, height: 8, borderRadius: 2 },
  heatStats: { flex: 1, gap: 5, minWidth: 0 },
  heatBigNum: { fontSize: 30, lineHeight: 34 },
});
