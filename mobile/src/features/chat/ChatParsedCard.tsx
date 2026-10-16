import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { AssigneeSection } from '@/features/todo/AssigneeSection';
import { CompactDate, CompactTime, SelectChip, type Option } from '@/features/todo/todoPickers';
import { useTheme } from '@/hooks/use-theme';
import { TextField } from '@/shared/ui/TextField';
import {
  priorityColor,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  readableOn,
  type TodoPriority,
} from '@/shared/ui/tone';
import { radius } from '@/shared/ui/tokens';
import type { ParsedDraft } from './api';
import type { ParsedHints } from './parseKoreanTask';

/** 테마 색은 #RRGGBB 라 알파를 직접 붙인다. 보간에는 rgba 문자열이 안전하다. */
function hexToRgba(hex: string, a: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const HINT_TO_PRIORITY: Record<'high' | 'low', string> = { high: 'HIGH', low: 'LOW' };

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * 미리보기 태그 칩.
 *
 * flash 가 켜지면 배경을 잠깐 밝혔다 되돌린다. 입력창 위 프리뷰에서 내가 본 추측과
 * 서버가 실제로 읽은 값이 **다를 때**만 켠다 — "아까 그거랑 다른데" 를 눈으로 잡아주지
 * 않으면, 사용자는 프리뷰에서 본 값이 저장된 줄 알고 넘어간다.
 */
function Tag({
  icon,
  label,
  color,
  flash,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  flash?: boolean;
}) {
  const on = useSharedValue(0);
  useEffect(() => {
    if (!flash) return;
    // 200ms 밝혔다가 같은 시간에 걸쳐 되돌린다. 깜빡임이 아니라 한 번의 강조여야 한다.
    on.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 200 }));
  }, [flash, on]);

  /* 배경색을 오가게 한다.
     처음엔 opacity 로 만들었다가 되돌렸다 — 시퀀스가 0 으로 끝나므로 강조가 지난 뒤
     태그가 **영구히 흐려진 채로** 남는다. 잠깐 강조하려다 평생 흐릿해지면 안 된다.

     색 문자열은 **여기(JS 스레드)에서 미리 만든다.** useAnimatedStyle 안은 UI 스레드
     워클릿이라 일반 함수를 부르면 "Tried to synchronously call a non-worklet function"
     으로 앱이 죽는다. 계산해 둔 값은 워클릿에 그대로 실려 들어간다. */
  const dim = hexToRgba(color, 0.12);
  const bright = hexToRgba(color, 0.45);
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [dim, bright]),
  }));

  return (
    <Animated.View style={[styles.tag, { backgroundColor: color + '1F' }, flash ? animated : null]}>
      <Ionicons name={icon} size={11} color={color} />
      <ThemedText type="small" style={[styles.tagText, { color }]}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

/**
 * AI 파싱 초안 편집 카드 — 웹 ChatParsedCard 1:1.
 * "AI 자동 생성" 미리보기 + 편집 토글. 확정(태스크 추가) 시 onConfirm으로 실제 생성.
 */
export function ChatParsedCard({
  draft,
  hints,
  onConfirm,
  onDismiss,
  onRetry,
}: {
  draft: ParsedDraft;
  /** 보낼 때 입력창 위에 띄웠던 로컬 추측. 서버 결과와 다른 칸만 강조한다. */
  hints?: ParsedHints;
  /** 실제 생성까지 기다려야 중복 생성을 막을 수 있으므로 Promise를 반환한다 */
  onConfirm: (d: ParsedDraft) => void | Promise<void>;
  onDismiss: () => void;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState<ParsedDraft>(draft);
  const [submitting, setSubmitting] = useState(false);
  const set = (patch: Partial<ParsedDraft>) => setD((p) => ({ ...p, ...patch }));

  // 예전엔 onConfirm 결과를 버리고 버튼도 계속 눌리게 둬서, 연타하면 같은 할 일이 여러 개 생겼다
  const confirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(d);
    } finally {
      setSubmitting(false);
    }
  };

  /* 로컬 추측과 서버 결과가 다른 칸.
     추측이 없던 칸은 비교하지 않는다 — 안 띄웠던 칩이 갑자기 번쩍이면 무슨 뜻인지 모른다. */
  const corrected = {
    dueDate: !!hints?.datetime && !!draft.dueDate && toYmd(hints.datetime) !== draft.dueDate,
    startTime:
      !!hints?.datetime && !!hints.hasTime && !!draft.startTime && toHm(hints.datetime) !== draft.startTime,
    location: !!hints?.location && !!draft.locationName && hints.location !== draft.locationName,
    priority: !!hints?.priority && HINT_TO_PRIORITY[hints.priority] !== draft.priority.toUpperCase(),
  };

  const prio = (d.priority.toUpperCase() as TodoPriority) || 'MEDIUM';
  const pColor = priorityColor(theme, prio);
  const prioOpts: Option<TodoPriority>[] = PRIORITY_OPTIONS.map((o) => ({ ...o, icon: 'flag', color: priorityColor(theme, o.value) }));

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.primary + '40' }]}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: theme.primary + '14' }]}>
        <Ionicons name="sparkles" size={14} color={theme.primary} />
        <ThemedText type="small" style={[styles.headerText, { color: theme.primary }]}>
          AI 자동 생성
        </ThemedText>
        <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8} style={styles.headerEdit}>
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
            {editing ? '완료' : '편집'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.body}>
        {editing ? (
          <>
            <TextField placeholder="제목" value={d.title} onChangeText={(t) => set({ title: t })} />
            <TextField placeholder="설명 (선택)" value={d.description} onChangeText={(t) => set({ description: t })} multiline style={styles.desc} />
            <SelectChip
              icon="flag"
              title="우선순위"
              value={prio}
              options={prioOpts}
              onChange={(v) => set({ priority: v })}
              color={pColor}
              active
            />
            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <ThemedText type="small" style={styles.fieldLabel}>시작일</ThemedText>
                <CompactDate value={d.startAt} onChange={(v) => set({ startAt: v })} onClear={() => set({ startAt: undefined })} />
              </View>
              <View style={styles.dateCol}>
                <ThemedText type="small" style={styles.fieldLabel}>마감일</ThemedText>
                <CompactDate value={d.dueDate} onChange={(v) => set({ dueDate: v })} onClear={() => set({ dueDate: undefined })} />
              </View>
            </View>
            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <ThemedText type="small" style={styles.fieldLabel}>시작 시간</ThemedText>
                <CompactTime value={d.startTime} onChange={(t) => set({ startTime: t })} onClear={() => set({ startTime: undefined })} />
              </View>
              <View style={styles.dateCol}>
                <ThemedText type="small" style={styles.fieldLabel}>종료 시간</ThemedText>
                <CompactTime value={d.endTime} onChange={(t) => set({ endTime: t })} onClear={() => set({ endTime: undefined })} />
              </View>
            </View>
            <View>
              <ThemedText type="small" style={styles.fieldLabel}>장소</ThemedText>
              <TextField placeholder="장소 (선택)" value={d.locationName ?? ''} onChangeText={(t) => set({ locationName: t || undefined })} />
            </View>
            <View>
              <ThemedText type="small" style={styles.fieldLabel}>담당자</ThemedText>
              <AssigneeSection value={d.assigneeEmails} onChange={(v) => set({ assigneeEmails: v })} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="default" style={styles.title} numberOfLines={3}>
              {d.title || '제목 없음'}
            </ThemedText>
            {d.description ? (
              <ThemedText type="small" style={styles.previewDesc} numberOfLines={3}>
                {d.description}
              </ThemedText>
            ) : null}
            <View style={styles.tags}>
              <Tag icon="flag" label={PRIORITY_LABEL[prio]} color={pColor} flash={corrected.priority} />
              {d.dueDate ? (
                <Tag icon="calendar-outline" label={d.dueDate.slice(5, 10)} color={theme.textSecondary} flash={corrected.dueDate} />
              ) : null}
              {d.startTime ? (
                <Tag
                  icon="time-outline"
                  label={d.endTime ? `${d.startTime}–${d.endTime}` : d.startTime}
                  color={theme.textSecondary}
                  flash={corrected.startTime}
                />
              ) : null}
              {d.locationName ? (
                <Tag icon="location-outline" label={d.locationName} color={theme.textSecondary} flash={corrected.location} />
              ) : null}
              {d.assigneeEmails.length ? <Tag icon="person-outline" label={`${d.assigneeEmails.length}명`} color={theme.textSecondary} /> : null}
            </View>
          </>
        )}
      </View>

      {/* 액션 */}
      <View style={[styles.actions, { borderTopColor: theme.divider }]}>
        {onRetry ? (
          <Pressable accessibilityRole="button" accessibilityLabel="다시 만들기" onPress={onRetry} disabled={submitting} hitSlop={6} style={[styles.actionBtn, submitting && styles.dimmed]}>
            <Ionicons name="refresh" size={15} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>
              재생성
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable onPress={onDismiss} disabled={submitting} hitSlop={6} style={[styles.actionBtn, submitting && styles.dimmed]}>
          <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>
            취소
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={confirm}
          disabled={submitting}
          style={[styles.confirmBtn, { backgroundColor: theme.primary }, submitting && styles.dimmed]}>
          {submitting ? (
            <ActivityIndicator size="small" color={readableOn(theme.primary)} />
          ) : (
            <Ionicons name="add" size={16} color={readableOn(theme.primary)} />
          )}
          <ThemedText type="small" style={[styles.confirmText, { color: readableOn(theme.primary) }]}>
            {submitting ? '추가 중…' : '태스크 추가'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9 },
  headerText: { fontWeight: '800', letterSpacing: 0.3 },
  headerEdit: { marginLeft: 'auto' },
  body: { padding: 14, gap: 10 },
  title: { fontWeight: '800', lineHeight: 22 },
  previewDesc: { opacity: 0.7, lineHeight: 19 },
  desc: { height: 72, paddingTop: 10, textAlignVertical: 'top' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  tagText: { fontWeight: '700' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateCol: { flex: 1, gap: 4 },
  fieldLabel: { opacity: 0.6, marginBottom: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  confirmText: { fontWeight: '700' },
  dimmed: { opacity: 0.55 },
});
