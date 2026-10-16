import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useCreateTodo } from '@/features/todo/queries';
import { toast } from '@/shared/ui/toast';
import { priorityColor, PRIORITY_LABEL, readableOn, type TodoPriority, type TodoStatus } from '@/shared/ui/tone';
import { radius } from '@/shared/ui/tokens';
import { extractChatTasks, resultKind, sendChat, type ChatTask } from './api';
import { setTodoTags } from '@/features/tag/api';

/** "YYYY-MM-DD" → "M/D" */
function mdLabel(d?: string): string {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

/**
 * 홈 "AI로 빠르게 추가" 카드 — 웹 AiCaptureHero 미러.
 * 입력 → AI 파싱(TASK_CREATED) → 즉시 생성 → 생성 결과를 잠깐 보여준 뒤 초기화.
 */
export function AiCaptureCard({ compact }: { compact?: boolean }) {
  const theme = useTheme();
  const createTodo = useCreateTodo();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ChatTask | null>(null);
  const [error, setError] = useState('');

  const hasValue = value.trim().length > 0;

  const onSubmit = async () => {
    const text = value.trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setParsed(null);
    try {
      const res = await sendChat(text, {});
      const created = resultKind(res.actions) === 'created' ? extractChatTasks(res.actions) : [];
      const task = created[0];
      if (task) {
        /* 다건 생성("~까지 매일 …")은 항목별로 성패가 갈린다. 예전엔 루프 전체가 하나의 try 안에
           있어서 3번째 항목이 실패하면 앞의 2개는 이미 만들어졌는데도 "요청 중 오류"만 떴고,
           태그 부착 실패(할 일은 이미 생성됨)까지 전체 실패로 보고됐다. 건별로 집계한다. */
        let okCount = 0;
        let failCount = 0;
        let tagFailCount = 0;
        for (const item of created) {
          try {
            const made = await createTodo.mutateAsync({
              title: item.title ?? '',
              content: item.description || undefined,
              priority: (item.priority?.toUpperCase() as TodoPriority) || 'MEDIUM',
              // AI가 상태를 지정했으면 그대로, 아니면 워크스페이스 기본 상태(훅이 채움)
              status: (item.status as TodoStatus) || undefined,
              startAt: item.startAt || undefined,
              dueDate: item.dueDate || undefined,
              startTime: item.startTime || undefined,
              endTime: item.endTime || undefined,
              assignees: item.assigneeId ? item.assigneeId.split(',').map((e) => e.trim()).filter(Boolean) : [],
              projectId: item.projectId && !Number.isNaN(Number(item.projectId)) ? Number(item.projectId) : undefined,
              locationName: item.locationName || undefined,
            });
            okCount += 1;
            // AI 인식 태그 부착(서버가 실존 태그로 매핑한 것만) — 실패해도 할 일 자체는 살아 있다
            if (made?.id != null && item.tags?.length) {
              try {
                await setTodoTags(made.id, item.tags.map((t) => t.id));
              } catch {
                tagFailCount += 1;
              }
            }
          } catch {
            failCount += 1;
          }
        }

        if (okCount === 0) {
          // 하나도 못 만들었으면 입력을 지우지 않는다 — 그대로 다시 시도할 수 있게
          if (compact) toast.error('일정을 추가하지 못했어요. 다시 시도해주세요');
          else setError('일정을 추가하지 못했어요. 다시 시도해주세요.');
          return;
        }

        setValue('');
        if (failCount > 0) {
          // 부분 성공을 성공/실패 어느 쪽으로도 뭉개지 않는다
          toast.error(`${okCount}개는 추가했고 ${failCount}개는 실패했어요`);
        } else if (created.length > 1) {
          toast.success(`일정 ${created.length}개를 추가했어요`);
        }
        if (tagFailCount > 0) toast.error(`${tagFailCount}개는 태그를 붙이지 못했어요`);
        // compact(고정 바)는 인라인 결과 없이 useCreateTodo 성공 토스트로만 피드백
        if (!compact) {
          setParsed(task);
          setTimeout(() => setParsed(null), 2200);
        }
      } else if (compact) {
        toast.error('할 일을 인식하지 못했어요');
      } else {
        setError('할 일을 인식하지 못했어요. 다시 입력해주세요.');
      }
    } catch {
      if (compact) toast.error('요청 중 오류가 발생했어요');
      else setError('요청 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const pColor = parsed ? priorityColor(theme, parsed.priority) : theme.primary;

  return (
    <View>
      <View
        style={[
          styles.inputRow,
          // 회색 캔버스 위 흰 입력 카드 — 반투명 inputBg는 캔버스와 섞여 탁해 보인다
          { backgroundColor: theme.surface, borderColor: focused ? theme.primary : theme.inputBorder },
        ]}>
        <Ionicons name="sparkles" size={17} color={theme.primary} />
        <TextInput
          value={value}
          onChangeText={setValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          placeholder="AI로 빠르게 추가 — 예: 내일까지 보고서"
          placeholderTextColor={theme.textTertiary}
          editable={!loading}
          returnKeyType="done"
          maxLength={100}
          style={[styles.input, { color: theme.text }]}
        />
        <Pressable
          onPress={onSubmit}
          disabled={!hasValue || loading}
          hitSlop={8}
          style={[styles.send, { backgroundColor: hasValue && !loading ? theme.primary : theme.surfaceSelected }]}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-up" size={16} color={hasValue ? '#fff' : theme.textTertiary} />
          )}
        </Pressable>
      </View>

      {compact ? null : parsed ? (
        <View style={[styles.result, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.resultHead}>
            <Ionicons name="checkmark-circle" size={15} color={theme.green} />
            <ThemedText type="small" style={{ color: theme.green, fontWeight: '700' }}>
              할 일이 생성됐어요
            </ThemedText>
          </View>
          <ThemedText type="default" style={styles.resultTitle} numberOfLines={2}>
            {parsed.title}
          </ThemedText>
          <View style={styles.resultMeta}>
            {parsed.dueDate ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {mdLabel(parsed.dueDate)}
                  {parsed.startTime ? ` ${parsed.startTime}` : ''}
                  {parsed.endTime ? `–${parsed.endTime}` : ''}
                </ThemedText>
              </View>
            ) : null}
            {parsed.locationName ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {parsed.locationName}
                </ThemedText>
              </View>
            ) : null}
            {parsed.priority ? (
              <View style={[styles.pill, { backgroundColor: pColor }]}>
                <ThemedText type="small" style={[styles.pillText, { color: readableOn(pColor) }]}>
                  {PRIORITY_LABEL[(parsed.priority.toUpperCase() as TodoPriority) ?? 'MEDIUM']}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      ) : error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      ) : !loading ? (
        <ThemedText type="small" style={[styles.hint, { color: theme.textTertiary }]}>
          날짜·장소·우선순위를 AI가 알아서 정리해드려요
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 14, paddingRight: 5, paddingVertical: 5 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: 7 },
  send: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  result: { marginTop: 12, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resultTitle: { fontWeight: '700' },
  resultMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillText: { color: '#fff', fontWeight: '700' },
  error: { marginTop: 10 },
  hint: { marginTop: 10 },
});
