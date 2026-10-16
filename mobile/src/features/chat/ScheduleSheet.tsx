import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  updateSchedule,
  type AiSchedule,
  type ChatAgent,
} from '@/features/chat/api';
import { agentLook } from '@/features/chat/agentLook';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { TextField } from '@/shared/ui/TextField';

/**
 * 예약 실행 — 역할을 시간에 걸어둔다.
 *
 * 역할은 지금까지 "도구"였다. 앱을 열고 직접 쳐야 무언가 일어난다. 시간에 걸리면 아침에
 * 알아서 알림이 온다.
 *
 * **조회만 하는 역할만 걸 수 있다.** 사람이 없는 사이 데이터가 바뀌면, 아침에 열었을 때
 * 마감이 옮겨져 있고 누가 한 건지 알 수 없다. 서버도 같은 규칙으로 막지만, 고를 수 없게
 * 하는 편이 낫다 — 저장을 눌렀다가 거절당하고 나서야 아는 것보다.
 */

const DAY_TOKENS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const DAY_LABELS: Record<string, string> = {
  MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일',
};
const DAILY = 'DAILY';

/** "MON,WED" → "월·수" · "DAILY" → "매일" */
export function daysLabel(days: string): string {
  if (!days || days === DAILY) return '매일';
  const picked = days.split(',').map((d) => d.trim()).filter((d) => DAY_LABELS[d]);
  if (picked.length === 0) return '매일';
  if (picked.length === 5 && !picked.includes('SAT') && !picked.includes('SUN')) return '평일';
  return picked.map((d) => DAY_LABELS[d]).join('·');
}

export function timeLabel(hour: number, minute: number): string {
  const ampm = hour < 12 ? '오전' : '오후';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${ampm} ${h12}:${String(minute).padStart(2, '0')}`;
}

/** 예약 줄·역할 줄의 앞머리. 역할 고르기 목록과 같은 규칙(내장=단색 심볼, 커스텀=이모지). */
function RoleGlyph({ agent, theme }: { agent: ChatAgent | undefined; theme: ReturnType<typeof useTheme> }) {
  const look = agentLook(agent, theme.textSecondary);
  return look.icon ? (
    <Ionicons name={look.icon} size={17} color={look.color} />
  ) : (
    <ThemedText type="default">{look.emoji}</ThemedText>
  );
}

export function ScheduleSheet({
  agents,
  agentsLoaded,
  onClose,
}: {
  agents: ChatAgent[];
  /** 역할 목록을 실제로 받아왔는가. 못 받은 걸 "역할이 없다" 로 그리지 않기 위해 필요하다. */
  agentsLoaded: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<AiSchedule[] | null>(null);
  /* 못 불러온 것과 없는 것은 다르다. 이걸 구분하지 않아 429 한 번에 "예약이 다 사라졌다" 로
     보였다 — 목록이 비어 보이는 게 곧 삭제된 것으로 읽히기 때문이다. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** undefined = 편집 안 함 · null = 새로 만들기 */
  const [editing, setEditing] = useState<AiSchedule | null | undefined>(undefined);

  // 조회만 하는 역할만 예약할 수 있다. 서버 판정(readOnly)을 그대로 쓴다.
  const schedulable = agents.filter((a) => a.readOnly);

  const load = () =>
    void fetchSchedules()
      .then((list) => {
        setItems(list);
        setLoadError(null);
      })
      .catch((e) => {
        setItems(null);
        setLoadError(getApiErrorMessage(e));
      });
  /* 첫 로드는 load 를 그대로 쓴다 — 상태 초기화는 이미 되어 있고, 효과 안에서 동기로
     setState 하면(=reload) 렌더 중 갱신이라 린트가 잡는다. */
  useEffect(load, []);
  const reload = () => {
    setLoadError(null);
    load();
  };

  const byId = (id: string) => agents.find((a) => a.id === id);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <View style={[styles.bar, { borderBottomColor: theme.divider }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <ThemedText type="default" style={{ color: theme.textSecondary }}>
              닫기
            </ThemedText>
          </Pressable>
          <ThemedText type="default" style={styles.barTitle}>
            예약
          </ThemedText>
          {/* 걸 수 있는 역할이 없으면 추가 버튼을 그리지 않는다 — 눌러봐야 막다른 길이다 */}
          {agentsLoaded && schedulable.length > 0 ? (
            <Pressable onPress={() => { tickHaptic(); setEditing(null); }} hitSlop={8}>
              <Ionicons name="add" size={24} color={theme.primary} />
            </Pressable>
          ) : (
            <View style={styles.barSpacer} />
          )}
        </View>

        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            정해둔 시각에 역할이 알아서 돌고, 결과를 알림으로 보내드려요. 앱을 열어두지 않아도 됩니다.
          </ThemedText>

          {!agentsLoaded ? (
            /* 역할을 못 받았다. "역할이 없다" 로 그리면 사용자는 있는 역할을 없다고 믿게 된다. */
            <View style={[styles.notice, { backgroundColor: theme.danger + '1F' }]}>
              <Ionicons name="alert-circle" size={15} color={theme.danger} />
              <ThemedText type="small" style={{ flex: 1, color: theme.danger }}>
                역할 목록을 불러오지 못했어요. AI 화면을 다시 열어주세요.
              </ThemedText>
            </View>
          ) : schedulable.length === 0 ? (
            /* 조용히 빈 목록만 보여주면 "기능이 고장났나" 로 읽힌다 — 왜 못 만드는지 말한다 */
            <View style={[styles.notice, { backgroundColor: theme.orange + '14' }]}>
              <Ionicons name="information-circle" size={15} color={theme.orange} />
              <ThemedText type="small" style={{ flex: 1, color: theme.orange }}>
                예약할 수 있는 역할이 없어요. 조회만 하는 역할(예: 점검 도우미)이 있어야 걸 수 있어요.
              </ThemedText>
            </View>
          ) : null}

          {loadError ? (
            /* 빈 목록으로 그리면 "지워졌다" 로 읽힌다. 못 불러왔다고 말하고 길을 준다. */
            <View style={[styles.notice, { backgroundColor: theme.danger + '1F' }]}>
              <Ionicons name="alert-circle" size={15} color={theme.danger} />
              <View style={{ flex: 1, gap: 6 }}>
                <ThemedText type="small" style={{ color: theme.danger }}>
                  예약을 불러오지 못했어요. {loadError}
                </ThemedText>
                <Pressable onPress={() => { tickHaptic(); reload(); }} hitSlop={8}>
                  <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                    다시 시도
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : items === null ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : items.length === 0 ? (
            <ThemedText type="small" style={{ color: theme.textTertiary, marginTop: 8 }}>
              아직 예약이 없어요.
            </ThemedText>
          ) : (
            items.map((s) => {
              const agent = byId(s.agentId);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => { tickHaptic(); setEditing(s); }}
                  style={[styles.row, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <RoleGlyph agent={agent} theme={theme} />
                  <View style={styles.rowBody}>
                    <View style={styles.rowTitle}>
                      <ThemedText type="default" style={{ fontWeight: '700' }}>
                        {timeLabel(s.hour, s.minute)}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {daysLabel(s.days)}
                      </ThemedText>
                      {/* 꺼진 예약을 목록에서 지우면 "사라졌다" 로 읽힌다. 남기고 상태를 적는다. */}
                      {!s.enabled ? (
                        <ThemedText type="small" style={{ color: theme.textTertiary }}>
                          꺼짐
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText type="small" style={{ color: theme.textTertiary }} numberOfLines={1}>
                      {agent ? `${agent.name} · ` : ''}
                      {s.prompt}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* 열려 있을 때만 마운트 + 대상이 바뀌면 새로 만든다(key) — 초기값을 그대로 들고 시작하게 */}
        {editing !== undefined ? (
          <ScheduleEditSheet
            key={editing?.id ?? 'new'}
            schedule={editing}
            agents={schedulable}
            onClose={() => setEditing(undefined)}
            onSaved={reload}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function ScheduleEditSheet({
  schedule,
  agents,
  onClose,
  onSaved,
}: {
  schedule: AiSchedule | null;
  agents: ChatAgent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const insets = useSafeAreaInsets();
  const editing = !!schedule?.id;

  const [agentId, setAgentId] = useState(schedule?.agentId ?? agents[0]?.id ?? '');
  const [prompt, setPrompt] = useState(schedule?.prompt ?? '오늘 뭐부터 하면 좋을까?');
  const [hour, setHour] = useState(schedule?.hour ?? 8);
  const [minute, setMinute] = useState(schedule?.minute ?? 0);
  const [days, setDays] = useState(schedule?.days ?? DAILY);
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = days === DAILY ? [...DAY_TOKENS] : days.split(',').map((d) => d.trim());

  const toggleDay = (d: string) => {
    tickHaptic();
    const next = picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d];
    // 하나도 안 고르면 영원히 안 도는 예약이 된다 — 매일로 되돌린다(서버도 같은 규칙)
    if (next.length === 0 || next.length === 7) return setDays(DAILY);
    setDays(DAY_TOKENS.filter((t) => next.includes(t)).join(','));
  };

  const timeValue = (() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  })();

  const save = async () => {
    if (!agentId) return setError('역할을 고르세요.');
    if (!prompt.trim()) return setError('무엇을 물어볼지 적어주세요.');
    setSaving(true);
    setError(null);
    try {
      const body = { agentId, prompt: prompt.trim(), hour, minute, days, enabled };
      if (editing && schedule) await updateSchedule(schedule.id, body);
      else await createSchedule(body);
      onSaved();
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!schedule) return;
    Alert.alert('이 예약을 지울까요?', '되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteSchedule(schedule.id);
            onSaved();
            onClose();
          } catch (e) {
            setError(getApiErrorMessage(e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <View style={[styles.bar, { borderBottomColor: theme.divider }]}>
          <Pressable onPress={onClose} hitSlop={8} disabled={saving}>
            <ThemedText type="default" style={{ color: theme.textSecondary }}>
              취소
            </ThemedText>
          </Pressable>
          <ThemedText type="default" style={styles.barTitle}>
            {editing ? '예약 수정' : '예약 추가'}
          </ThemedText>
          <Pressable onPress={save} hitSlop={8} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" />
            ) : (
              <ThemedText type="default" style={{ fontWeight: '800', color: theme.primary }}>
                저장
              </ThemedText>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={[styles.notice, { backgroundColor: theme.danger + '1F' }]}>
              <Ionicons name="alert-circle" size={15} color={theme.danger} />
              <ThemedText type="small" style={{ flex: 1, color: theme.danger }}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              역할
            </ThemedText>
            {agents.map((a) => {
              const on = a.id === agentId;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => { tickHaptic(); setAgentId(a.id); }}
                  style={[
                    styles.row,
                    { backgroundColor: on ? theme.primary + '14' : theme.surfaceAlt, borderColor: theme.border },
                  ]}>
                  <RoleGlyph agent={a} theme={theme} />
                  <View style={styles.rowBody}>
                    <ThemedText type="default" style={{ fontWeight: on ? '800' : '600' }}>
                      {a.name}
                    </ThemedText>
                    {a.description ? (
                      <ThemedText type="small" style={{ color: theme.textTertiary }} numberOfLines={1}>
                        {a.description}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={on ? theme.primary : theme.textTertiary}
                  />
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="물어볼 내용"
            value={prompt}
            onChangeText={(t) => setPrompt(t.slice(0, 300))}
            placeholder="예: 오늘 뭐부터 하면 좋을까?"
            maxLength={300}
          />

          <View style={[styles.section, styles.timeRow]}>
            <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              시각
            </ThemedText>
            <DateTimePicker
              value={timeValue}
              mode="time"
              display="compact"
              locale="ko-KR"
              themeVariant={scheme}
              accentColor={theme.primary}
              onChange={(e, d) => {
                if (e.type === 'set' && d) {
                  setHour(d.getHours());
                  setMinute(d.getMinutes());
                }
              }}
            />
          </View>

          <View style={styles.section}>
            <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              요일 · {daysLabel(days)}
            </ThemedText>
            <View style={styles.dayRow}>
              {DAY_TOKENS.map((d) => {
                const on = picked.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggleDay(d)}
                    style={[
                      styles.day,
                      { backgroundColor: on ? theme.primary : theme.surfaceAlt, borderColor: theme.border },
                    ]}>
                    <ThemedText type="small" style={{ fontWeight: '700', color: on ? '#fff' : theme.textSecondary }}>
                      {DAY_LABELS[d]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.row, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <View style={styles.rowBody}>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                예약 켜기
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textTertiary }}>
                꺼두면 지우지 않고 잠시 멈출 수 있어요
              </ThemedText>
            </View>
            <Switch value={enabled} onValueChange={setEnabled} />
          </View>

          {/* 비용을 문구로 적는다 — 하루 한도가 왜 닳는지 모르면 기능을 의심하게 된다 */}
          <ThemedText type="small" style={{ color: theme.textTertiary }}>
            예약이 한 번 돌 때마다 하루 AI 사용량을 씁니다. 남은 양이 없으면 그날은 건너뛰어요.
          </ThemedText>

          {editing ? (
            <Pressable onPress={confirmDelete} disabled={saving} style={styles.delete}>
              <ThemedText type="default" style={{ color: theme.danger }}>
                이 예약 삭제
              </ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barTitle: { fontWeight: '800' },
  barSpacer: { width: 24 },
  body: { padding: 16, gap: 16 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10 },
  section: { gap: 8 },
  sectionLabel: { fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayRow: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  delete: { alignItems: 'center', paddingVertical: 14 },
});
