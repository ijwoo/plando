import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { AI_FROM, ProgressRing } from '@/features/dashboard/BriefingCard';
import { getWeeklyWrap, getWrapHistory, saveWrapMemo, type WrapPersona, type WrapResponse } from '@/features/wrap/api';
import { useStatusMap } from '@/features/status/queries';
import { BottomSheet } from '@/features/todo/todoPickers';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/shared/ui/Avatar';
import { shadow } from '@/shared/ui/tokens';
import { tickHaptic } from '@/shared/ui/haptics';
import { readableOn } from '@/shared/ui/tone';
import { toast } from '@/shared/ui/toast';
import { toDateString } from '@/shared/utils/datetime';

const PERSONAS: { id: WrapPersona; label: string }[] = [
  { id: 'analyst', label: '분석' },
  { id: 'cheer', label: '응원' },
  { id: 'cynical', label: '조언' },
  { id: 'brutal', label: '직설' },
];
const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

type WeekTodo = NonNullable<WrapResponse['weekTodos']>[number];

/** 이번 주 일요일 (주 시작) */
function thisWeekSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return toDateString(d);
}
function addDays(iso: string, days: number): string {
  const [y, m, dd] = iso.split('-').map(Number);
  return toDateString(new Date(y, m - 1, dd + days));
}

/** 주간 회고 — 웹 WrapPage 핵심 섹션의 네이티브 이식 (완료율·AI 한마디·리듬·요일 차트·분포·키워드·메모) */
export default function WrapScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<string>(thisWeekSunday());
  const [persona, setPersona] = useState<WrapPersona | undefined>(undefined);
  const isThisWeek = weekStart === thisWeekSunday();
  // 섹션 자세히보기 — weekTodos를 필터해 요일별로 묶어 보여주는 시트 (웹 WrapDetailSheet 미러)
  const [detail, setDetail] = useState<{ title: string; subtitle?: string; filter: (t: WeekTodo) => boolean } | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching, isFetching } = useQuery({
    queryKey: ['wrap', 'weekly', weekStart, persona ?? 'default'],
    queryFn: () => getWeeklyWrap(weekStart, { persona }),
    staleTime: 60_000,
  });

  // 셀프 메모 — 로컬 편집 후 저장 (null = 서버값 표시)
  const [memo, setMemo] = useState<string | null>(null);
  const memoValue = memo ?? data?.selfMemo ?? '';
  const [savingMemo, setSavingMemo] = useState(false);
  const onSaveMemo = async () => {
    if (savingMemo) return;
    setSavingMemo(true);
    try {
      await saveWrapMemo(memoValue.trim(), weekStart);
      toast.success('한 줄 회고를 저장했어요');
      setMemo(null);
      qc.invalidateQueries({ queryKey: ['wrap', 'weekly', weekStart] });
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingMemo(false);
    }
  };

  const maxWeekday = useMemo(() => Math.max(1, ...(data?.weekdayCounts ?? [0])), [data?.weekdayCounts]);

  // 최근 12주 완료율 추이
  const { data: history } = useQuery({ queryKey: ['wrap', 'history'], queryFn: () => getWrapHistory(12), staleTime: 300_000 });

  const goWeek = (dir: -1 | 1) => {
    if (dir === 1 && isThisWeek) return;
    tickHaptic();
    setMemo(null);
    setWeekStart((w) => addDays(w, dir * 7));
  };

  // 주 이동 — 좌우 스와이프 (캘린더와 동일 제스처 문법)
  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationX <= -60) runOnJS(goWeek)(1);
      else if (e.translationX >= 60) runOnJS(goWeek)(-1);
    });

  // 네이티브 공유 시트 — 텍스트 요약
  const onShare = async () => {
    if (!data) return;
    tickHaptic();
    const lines = [
      `📊 플랜두 주간 회고 · ${data.rangeLabel ?? ''}`,
      `완료율 ${data.pastCompletionRate ?? 0}% (${data.doneCount ?? 0}/${data.totalCount ?? 0}건)`,
      data.busiestDay?.label ? `가장 바빴던 날: ${data.busiestDay.label}` : null,
      data.aiComment ? `
🤖 ${data.aiComment}` : null,
      memoValue.trim() ? `
✍️ ${memoValue.trim()}` : null,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // 사용자가 취소 — 무시
    }
  };

  // AI 한마디 재생성 (refresh=true)
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const onRefreshAi = async () => {
    if (aiRefreshing) return;
    tickHaptic();
    setAiRefreshing(true);
    try {
      const fresh = await getWeeklyWrap(weekStart, { refresh: true, persona });
      qc.setQueryData(['wrap', 'weekly', weekStart, persona ?? 'default'], fresh);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setAiRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '주간 회고',
          headerRight: () => (
            <Pressable onPress={onShare} hitSlop={8} accessibilityLabel="공유" accessibilityRole="button">
              <Ionicons name="share-outline" size={21} color={theme.text} />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <ThemedText type="default" style={{ color: theme.danger }}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : data ? (
        <GestureDetector gesture={swipe}>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
          {/* 주 네비게이션 */}
          <View style={styles.weekNav}>
            <Pressable onPress={() => goWeek(-1)} hitSlop={10} accessibilityLabel="이전 주" accessibilityRole="button">
              <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
            </Pressable>
            <ThemedText type="default" style={styles.weekLabel}>
              {data.rangeLabel ?? ''}
              {isThisWeek ? '  ·  이번 주' : ''}
            </ThemedText>
            <Pressable onPress={() => goWeek(1)} hitSlop={10} disabled={isThisWeek} accessibilityLabel="다음 주" accessibilityRole="button">
              <Ionicons name="chevron-forward" size={20} color={isThisWeek ? theme.textDisabled : theme.textSecondary} />
            </Pressable>
          </View>

          {/* 완료율 히어로 */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <View style={styles.heroRow}>
              <View style={styles.heroLeft}>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                  지난 일정 완료율
                </ThemedText>
                <View style={styles.heroNumRow}>
                  <ThemedText style={styles.heroNum}>{data.pastCompletionRate ?? 0}%</ThemedText>
                  <TrendChip now={data.pastCompletionRate ?? 0} prev={data.prevWeekCompletionRate ?? 0} theme={theme} />
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  이번 주 {data.totalCount ?? 0}건 중 {data.doneCount ?? 0}건 완료
                </ThemedText>
              </View>
              <View style={styles.heroRing}>
                <ProgressRing
                  size={74}
                  stroke={7}
                  progress={(data.pastCompletionRate ?? 0) / 100}
                  color={theme.green}
                  track={theme.divider}
                />
                <View style={styles.ringCenter} pointerEvents="none">
                  <ThemedText type="small" style={styles.ringText}>
                    {data.doneCount ?? 0}/{data.totalCount ?? 0}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* AI 한마디 */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <View style={styles.aiHead}>
              <Ionicons name="sparkles" size={14} color={AI_FROM} />
              <ThemedText type="small" style={{ color: AI_FROM, fontWeight: '800' }}>
                AI 한마디
              </ThemedText>
              {isFetching || aiRefreshing ? <ActivityIndicator size="small" style={styles.aiSpin} /> : null}
              <View style={styles.flex1} />
              <Pressable onPress={onRefreshAi} hitSlop={8} accessibilityLabel="AI 한마디 새로고침" accessibilityRole="button">
                <Ionicons name="refresh" size={15} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ThemedText type="default" style={styles.aiText}>
              {data.aiComment ?? '이번 주 데이터를 모으는 중이에요.'}
            </ThemedText>
            <View style={styles.personaRow}>
              {PERSONAS.map((p) => {
                const active = (persona ?? data.aiPersona ?? 'analyst') === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => { tickHaptic(); setPersona(p.id); }}
                    accessibilityLabel={`${p.label} 페르소나`}
                    style={[
                      styles.personaChip,
                      { backgroundColor: active ? AI_FROM + '1A' : theme.surfaceAlt, borderColor: active ? AI_FROM : 'transparent' },
                    ]}>
                    <ThemedText type="small" style={{ color: active ? AI_FROM : theme.textSecondary, fontWeight: '700' }}>
                      {p.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 퀵 통계 */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <SectionTitle>이번 주 리듬</SectionTitle>
            <View style={styles.grid}>
              <Stat label="하루 평균" value={`${data.quickStats?.dailyAverage ?? 0}건`} theme={theme} />
              <Stat label="가장 바쁜 날" value={data.busiestDay?.label ?? '—'} theme={theme} />
              <Stat
                label="가장 이른 시작"
                value={data.quickStats?.earliestStart ? `${data.quickStats.earliestStart.dayLabel} ${data.quickStats.earliestStart.timeLabel}` : '—'}
                theme={theme}
              />
              <Stat
                label="가장 늦은 마무리"
                value={data.quickStats?.latestEnd ? `${data.quickStats.latestEnd.dayLabel} ${data.quickStats.latestEnd.timeLabel}` : '—'}
                theme={theme}
              />
              <Stat label="회의 시간" value={data.meetingMinutes ? `${Math.round(((data.meetingMinutes ?? 0) / 60) * 10) / 10}시간` : '—'} theme={theme} />
              <Stat
                label="가장 긴 일정"
                value={data.quickStats?.longestTodo ? `${Math.round(((data.quickStats.longestTodo.minutes ?? 0) / 60) * 10) / 10}시간` : '—'}
                theme={theme}
              />
            </View>
          </View>

          {/* 요일 차트 */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <SectionTitle
              onDetail={
                data.busiestDay?.dayIndex != null
                  ? () =>
                      setDetail({
                        title: `${data.busiestDay?.label ?? ''} 일정`,
                        subtitle: `${data.busiestDay?.count ?? 0}개`,
                        filter: (t) => t.dayIndex === data.busiestDay?.dayIndex,
                      })
                  : undefined
              }>
              요일별 일정
            </SectionTitle>
            <View style={styles.bars}>
              {(data.weekdayCounts ?? [0, 0, 0, 0, 0, 0, 0]).map((c, i) => {
                const busiest = data.busiestDay?.dayIndex === i && c > 0;
                return (
                  <View key={i} style={styles.barCol}>
                    <ThemedText type="small" style={[styles.barCount, { color: busiest ? theme.primary : theme.textTertiary }]}>
                      {c > 0 ? c : ''}
                    </ThemedText>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(4, (c / maxWeekday) * 84),
                          backgroundColor: busiest ? theme.primary : theme.primary + '3D',
                        },
                      ]}
                    />
                    <ThemedText
                      type="small"
                      style={{ color: busiest ? theme.primary : theme.textSecondary, fontWeight: busiest ? '800' : '500' }}>
                      {KO_DAYS[i]}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 활동 히트맵 — 오전/오후/저녁 × 일~토 */}
          {data.activityHeatmap?.length ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>활동 히트맵</SectionTitle>
              <Heatmap grid={data.activityHeatmap} theme={theme} />
            </View>
          ) : null}

          {/* 시간대 리듬 */}
          {data.timeBuckets ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>시간대</SectionTitle>
              <View style={styles.bucketRow}>
                {[
                  { label: '새벽', icon: 'moon-outline' as const, v: data.timeBuckets.dawn ?? 0 },
                  { label: '오전', icon: 'sunny-outline' as const, v: data.timeBuckets.morning ?? 0 },
                  { label: '오후', icon: 'partly-sunny-outline' as const, v: data.timeBuckets.afternoon ?? 0 },
                  { label: '저녁', icon: 'cloudy-night-outline' as const, v: data.timeBuckets.evening ?? 0 },
                ].map((b) => (
                  <View key={b.label} style={[styles.bucket, { backgroundColor: theme.surfaceAlt }]}>
                    <Ionicons name={b.icon} size={16} color={theme.textSecondary} />
                    <ThemedText type="default" style={styles.bucketNum}>
                      {b.v}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {b.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 상태 · 우선순위 분포 */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <SectionTitle onDetail={() => setDetail({ title: '이번 주 일정 전체', subtitle: `${data.totalCount ?? 0}개`, filter: () => true })}>분포</SectionTitle>
            <BreakdownBar
              label="상태"
              parts={[
                { label: '완료', value: data.statusBreakdown?.done ?? 0, color: theme.green },
                { label: '진행 중', value: data.statusBreakdown?.inProgress ?? 0, color: theme.orange },
                { label: '할 일', value: data.statusBreakdown?.todo ?? 0, color: theme.textTertiary },
              ]}
              theme={theme}
            />
            <BreakdownBar
              label="우선순위"
              parts={[
                { label: '높음', value: data.priorityBreakdown?.high ?? 0, color: theme.danger },
                { label: '보통', value: data.priorityBreakdown?.medium ?? 0, color: theme.primary },
                { label: '낮음', value: data.priorityBreakdown?.low ?? 0, color: theme.textTertiary },
              ]}
              theme={theme}
            />
          </View>

          {/* 일하는 방식 — 협업/시간 비율 */}
          {data.collabRatio || data.timedRatio ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>일하는 방식</SectionTitle>
              {data.collabRatio ? <RatioRow info={data.collabRatio} theme={theme} /> : null}
              {data.timedRatio ? <RatioRow info={data.timedRatio} theme={theme} /> : null}
              {data.averageTodoMinutes ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  평균 일정 길이 {Math.round(((data.averageTodoMinutes ?? 0) / 60) * 10) / 10}시간
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {/* 마일스톤 */}
          {data.milestones?.length ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>이번 주 마일스톤</SectionTitle>
              <View style={styles.milestoneWrap}>
                {data.milestones.map((m, i) => (
                  <View key={m.id ?? i} style={[styles.milestone, { backgroundColor: theme.surfaceAlt }]}>
                    <ThemedText type="default">{m.emoji ?? '🏁'}</ThemedText>
                    <ThemedText type="small" style={styles.milestoneLabel}>
                      {m.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 함께한 사람 */}
          {data.topPeople?.length ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>함께한 사람</SectionTitle>
              {data.topPeople.slice(0, 5).map((p, i) => (
                <View key={`${p.name}-${i}`} style={styles.personRow}>
                  <Avatar person={{ name: p.name, profileImageUrl: p.profileImageUrl }} size={28} />
                  <ThemedText type="default" style={styles.personName} numberOfLines={1}>
                    {p.name}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {p.count}회
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {/* 자주 간 곳 */}
          {data.topPlaces?.length ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>자주 간 곳</SectionTitle>
              {data.topPlaces.slice(0, 5).map((pl, i) => (
                <View key={`${pl.name}-${i}`} style={styles.personRow}>
                  <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                  <ThemedText type="default" style={styles.personName} numberOfLines={1}>
                    {pl.name}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {pl.count}회
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {/* 주목할 일정 */}
          {data.notableTodos && (data.notableTodos.firstOfWeek || data.notableTodos.lastOfWeek || data.notableTodos.longest) ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>주목할 일정</SectionTitle>
              {data.notableTodos.firstOfWeek ? <NotableRow icon="play-outline" label="한 주의 시작" todo={data.notableTodos.firstOfWeek} theme={theme} /> : null}
              {data.notableTodos.longest ? <NotableRow icon="hourglass-outline" label="가장 긴 일정" todo={data.notableTodos.longest} theme={theme} /> : null}
              {data.notableTodos.lastOfWeek ? <NotableRow icon="flag-outline" label="한 주의 마무리" todo={data.notableTodos.lastOfWeek} theme={theme} /> : null}
            </View>
          ) : null}

          {/* 12주 추이 */}
          {history?.length ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>12주 완료율 추이</SectionTitle>
              <View style={styles.historyBars}>
                {history.map((h, i) => {
                  const active = h.weekStart === weekStart;
                  return (
                    <Pressable
                      key={h.weekStart ?? i}
                      style={styles.historyCol}
                      accessibilityLabel={`${h.rangeLabel ?? ''} 완료율 ${h.pastCompletionRate ?? 0}%`}
                      onPress={() => {
                        if (h.weekStart && h.weekStart !== weekStart) {
                          tickHaptic();
                          setMemo(null);
                          setWeekStart(h.weekStart);
                        }
                      }}>
                      <View
                        style={[
                          styles.historyBar,
                          {
                            height: Math.max(4, ((h.pastCompletionRate ?? 0) / 100) * 64),
                            backgroundColor: active ? theme.primary : h.current ? theme.primary + '66' : theme.primary + '2E',
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText type="small" style={{ color: theme.textTertiary }}>
                막대를 탭하면 그 주로 이동해요
              </ThemedText>
            </View>
          ) : null}

          {/* 다음 주 미리보기 */}
          {data.nextWeekPreview && (data.nextWeekPreview.totalCount ?? 0) > 0 ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>다음 주 미리보기</SectionTitle>
              <ThemedText type="default" style={styles.nextWeekText}>
                {data.nextWeekPreview.rangeLabel} · 일정 {data.nextWeekPreview.totalCount}건
                {data.nextWeekPreview.busiestDay?.label ? ` · ${data.nextWeekPreview.busiestDay.label}이 가장 바빠요` : ''}
              </ThemedText>
              {data.nextWeekPreview.topPlace?.name ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  📍 {data.nextWeekPreview.topPlace.name}에서의 일정이 있어요
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {/* 키워드 */}
          {data.keywords?.length ? (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <SectionTitle>이번 주 키워드</SectionTitle>
              <View style={styles.keywordWrap}>
                {data.keywords.slice(0, 10).map((k, i) => (
                  <View key={`${k.word}-${i}`} style={[styles.keyword, { backgroundColor: theme.surfaceAlt }]}>
                    <ThemedText type="small" style={styles.keywordText}>
                      {k.word}{' '}
                      <ThemedText type="small" style={{ color: theme.textTertiary }}>
                        {k.count}
                      </ThemedText>
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 한 줄 회고 */}
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <SectionTitle>한 줄 회고</SectionTitle>
            <TextInput
              value={memoValue}
              onChangeText={setMemo}
              placeholder="이번 주를 한 줄로 남겨보세요"
              placeholderTextColor={theme.textTertiary}
              maxLength={120}
              style={[styles.memoInput, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
            />
            <Pressable
              onPress={onSaveMemo}
              disabled={savingMemo || memo == null}
              accessibilityLabel="회고 저장"
              accessibilityRole="button"
              style={[styles.memoSave, { backgroundColor: memo != null ? theme.primary : theme.surfaceSelected }]}>
              <ThemedText type="small" style={{ color: memo != null ? readableOn(theme.primary) : theme.textTertiary, fontWeight: '700' }}>
                {savingMemo ? '저장 중…' : '저장'}
              </ThemedText>
            </Pressable>
          </View>

          {/* 다음 액션 — 계획/알림 (웹 WrapNextActions 미러) */}
          <WrapNextActions
            onPlan={() => router.push('/todo?tab=today&my=0')}
            onNotify={() => router.push('/settings/notifications')}
          />
        </ScrollView>
        </GestureDetector>
      ) : null}

      {/* 섹션 자세히보기 시트 */}
      <WrapDetailSheet
        open={detail != null}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        subtitle={detail?.subtitle}
        todos={detail ? (data?.weekTodos ?? []).filter(detail.filter) : []}
      />
    </SafeAreaView>
  );
}

function SectionTitle({ children, onDetail }: { children: React.ReactNode; onDetail?: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <ThemedText type="default" style={styles.sectionTitle}>
        {children}
      </ThemedText>
      {onDetail ? (
        <Pressable onPress={onDetail} hitSlop={8} style={styles.detailBtn} accessibilityLabel="자세히 보기">
          <ThemedText type="small" style={{ color: theme.textTertiary, fontWeight: '600' }}>
            자세히
          </ThemedText>
          <Ionicons name="chevron-forward" size={12} color={theme.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 회고 다음 액션 카드 — 웹 WrapNextActions 미러(네이티브는 히스토리가 인라인이라 계획/알림 두 줄) */
function WrapNextActions({ onPlan, onNotify }: { onPlan: () => void; onNotify: () => void }) {
  const theme = useTheme();
  const rows: { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string; label: string; sub: string; onPress: () => void }[] = [
    { icon: 'flag-outline', bg: '#E7F8F1', color: '#10B981', label: '다음 주 계획하기', sub: '이번 주 인사이트로 다음 주를', onPress: onPlan },
    { icon: 'notifications-outline', bg: theme.primarySoft, color: theme.primary, label: '회고 알림 설정', sub: '주말에 회고를 챙겨드릴게요', onPress: onNotify },
  ];
  return (
    <View style={[styles.nextCard, { backgroundColor: theme.surface }]}>
      {rows.map((r, i) => (
        <Pressable
          key={r.label}
          onPress={r.onPress}
          style={[styles.nextRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
          <View style={[styles.nextIcon, { backgroundColor: r.bg }]}>
            <Ionicons name={r.icon} size={18} color={r.color} />
          </View>
          <View style={styles.flex1}>
            <ThemedText type="default" style={{ fontWeight: '700' }}>
              {r.label}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {r.sub}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </Pressable>
      ))}
    </View>
  );
}

/** 섹션 자세히보기 시트 — weekTodos를 요일별로 묶은 회고 타임테이블 */
function WrapDetailSheet({
  open,
  onClose,
  title,
  subtitle,
  todos,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  todos: WeekTodo[];
}) {
  const theme = useTheme();
  // TodoBrief엔 doneAt이 없어 상태 key의 카테고리로 완료 판정 (커스텀 완료 상태 대응)
  const { category } = useStatusMap();
  const groups = useMemo(() => {
    const m = new Map<number, { dayLabel: string; dateLabel: string; items: WeekTodo[] }>();
    for (const t of todos) {
      const di = t.dayIndex ?? 0;
      if (!m.has(di)) m.set(di, { dayLabel: t.dayLabel ?? KO_DAYS[di] ?? '', dateLabel: t.dateLabel ?? '', items: [] });
      m.get(di)!.items.push(t);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [todos]);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={styles.detailSheet}>
        <ThemedText type="small" style={[styles.detailKicker, { color: theme.primary }]}>
          REWIND
        </ThemedText>
        <ThemedText type="subtitle">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>
            {subtitle}
          </ThemedText>
        ) : null}
        {groups.length === 0 ? (
          <ThemedText type="small" style={styles.detailEmpty}>
            해당 조건의 일정이 없어요
          </ThemedText>
        ) : (
          <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
            {groups.map((g, gi) => (
              <View key={gi} style={styles.detailGroup}>
                <View style={styles.detailDayHead}>
                  <ThemedText type="small" style={[styles.detailDay, { color: theme.text }]}>
                    {g.dayLabel}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textTertiary }}>
                    {g.dateLabel}
                  </ThemedText>
                </View>
                {g.items.map((t) => {
                  const done = category(t.status) === 'DONE';
                  return (
                    <View key={t.id} style={styles.detailItem}>
                      <View
                        style={[
                          styles.detailCheck,
                          done ? { backgroundColor: theme.green } : { borderWidth: 1.5, borderColor: theme.divider },
                        ]}>
                        {done ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
                      </View>
                      <ThemedText
                        type="small"
                        numberOfLines={1}
                        style={[styles.flex1, done && { color: theme.textTertiary, textDecorationLine: 'line-through' }]}>
                        {t.title}
                      </ThemedText>
                      {t.startTime ? (
                        <ThemedText type="small" style={{ color: theme.textTertiary }}>
                          {String(t.startTime).slice(0, 5)}
                        </ThemedText>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  );
}

function TrendChip({ now, prev, theme }: { now: number; prev: number; theme: ReturnType<typeof useTheme> }) {
  const diff = now - prev;
  if (!prev && !now) return null;
  const up = diff >= 0;
  const color = up ? theme.green : theme.danger;
  return (
    <View style={[styles.trend, { backgroundColor: color + '1A' }]}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={11} color={color} />
      <ThemedText type="small" style={{ color, fontWeight: '800' }}>
        {Math.abs(diff)}%p
      </ThemedText>
    </View>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={styles.statValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function BreakdownBar({
  label,
  parts,
  theme,
}: {
  label: string;
  parts: { label: string; value: number; color: string }[];
  theme: ReturnType<typeof useTheme>;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <View style={styles.breakdown}>
      <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
        {label}
      </ThemedText>
      <View style={[styles.breakTrack, { backgroundColor: theme.divider }]}>
        {total > 0
          ? parts.filter((p) => p.value > 0).map((p, i) => <View key={i} style={{ flex: p.value, backgroundColor: p.color }} />)
          : null}
      </View>
      <View style={styles.breakLegend}>
        {parts.map((p, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: p.color }]} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {p.label} {p.value}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function Heatmap({ grid, theme }: { grid: number[][]; theme: ReturnType<typeof useTheme> }) {
  const flat = grid.flat();
  const max = Math.max(1, ...flat);
  const rows = ['오전', '오후', '저녁'];
  return (
    <View style={hstyles.wrap}>
      {grid.slice(0, 3).map((row, r) => (
        <View key={r} style={hstyles.row}>
          <ThemedText type="small" style={[hstyles.rowLabel, { color: theme.textSecondary }]}>
            {rows[r]}
          </ThemedText>
          {row.map((v, c) => (
            <View
              key={c}
              style={[
                hstyles.cell,
                { backgroundColor: v > 0 ? theme.primary + Math.round(30 + (v / max) * 190).toString(16).padStart(2, '0') : theme.surfaceAlt },
              ]}
            />
          ))}
        </View>
      ))}
      <View style={hstyles.row}>
        <View style={hstyles.rowLabel} />
        {KO_DAYS.map((d) => (
          <ThemedText key={d} type="small" style={[hstyles.dayLabel, { color: theme.textTertiary }]}>
            {d}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

function RatioRow({ info, theme }: { info: { primary?: number; secondary?: number; primaryLabel?: string; secondaryLabel?: string }; theme: ReturnType<typeof useTheme> }) {
  const a = info.primary ?? 0;
  const b = info.secondary ?? 0;
  if (a + b === 0) return null;
  return (
    <View style={hstyles.ratio}>
      <View style={[hstyles.ratioTrack, { backgroundColor: theme.divider }]}>
        {a > 0 ? <View style={{ flex: a, backgroundColor: theme.primary }} /> : null}
        {b > 0 ? <View style={{ flex: b, backgroundColor: theme.divider }} /> : null}
      </View>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        {info.primaryLabel} {a} · {info.secondaryLabel} {b}
      </ThemedText>
    </View>
  );
}

function NotableRow({
  icon,
  label,
  todo,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  todo: { title?: string; dayLabel?: string; dateLabel?: string; timeLabel?: string };
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={hstyles.notable}>
      <Ionicons name={icon} size={16} color={theme.textSecondary} />
      <View style={hstyles.notableBody}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {label} · {todo.dayLabel} {todo.dateLabel} {todo.timeLabel ?? ''}
        </ThemedText>
        <ThemedText type="default" style={hstyles.notableTitle} numberOfLines={1}>
          {todo.title}
        </ThemedText>
      </View>
    </View>
  );
}

const hstyles = StyleSheet.create({
  wrap: { gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowLabel: { width: 30 },
  cell: { flex: 1, height: 22, borderRadius: 5 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11 },
  ratio: { gap: 5, marginBottom: 12 },
  ratioTrack: { height: 10, borderRadius: 999, overflow: 'hidden', flexDirection: 'row' },
  notable: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  notableBody: { flex: 1, gap: 1 },
  notableTitle: { fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  body: { paddingBottom: 40 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 12 },
  weekLabel: { fontWeight: '800' },
  section: { paddingHorizontal: 16, paddingVertical: 16, marginBottom: 10 },
  sectionTitle: { fontWeight: '800', fontSize: 17, letterSpacing: -0.2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingLeft: 8 },
  // 다음 액션 카드
  nextCard: { marginHorizontal: 16, marginTop: 4, borderRadius: 16, overflow: 'hidden', ...shadow.card },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  nextIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  // 자세히보기 시트
  detailSheet: { paddingHorizontal: 20, paddingBottom: 12, gap: 3, maxHeight: 460 },
  detailKicker: { fontWeight: '800', fontSize: 11, letterSpacing: 1.5 },
  detailScroll: { marginTop: 8 },
  detailEmpty: { textAlign: 'center', opacity: 0.5, paddingVertical: 32 },
  detailGroup: { marginBottom: 14 },
  detailDayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  detailDay: { fontWeight: '800', fontSize: 14 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  detailCheck: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroLeft: { flex: 1, gap: 4 },
  heroNumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroNum: { fontSize: 40, fontWeight: '900', letterSpacing: -1, lineHeight: 46 },
  heroRing: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontWeight: '800', fontSize: 12 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  aiSpin: { marginLeft: 4 },
  aiText: { lineHeight: 22 },
  personaRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  personaChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  stat: { width: '50%', gap: 2 },
  statValue: { fontWeight: '700' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 },
  barCol: { alignItems: 'center', gap: 5, flex: 1 },
  barCount: { fontWeight: '700', fontSize: 11 },
  bar: { width: 18, borderRadius: 6 },
  breakdown: { gap: 7, marginBottom: 14 },
  breakTrack: { height: 10, borderRadius: 999, overflow: 'hidden', flexDirection: 'row' },
  breakLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  personName: { flex: 1, fontWeight: '600' },
  keywordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  keyword: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  keywordText: { fontWeight: '600' },
  memoInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  memoSave: { alignSelf: 'flex-end', marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  bucketRow: { flexDirection: 'row', gap: 8 },
  bucket: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 12, borderRadius: 12 },
  bucketNum: { fontWeight: '800', fontSize: 18 },
  milestoneWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, maxWidth: '100%' },
  milestoneLabel: { fontWeight: '600', flexShrink: 1 },
  historyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 68, marginBottom: 8 },
  historyCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  historyBar: { width: '100%', borderRadius: 4 },
  nextWeekText: { fontWeight: '600', marginBottom: 4 },
});
