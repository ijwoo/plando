import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { createAgent, deleteAgent, updateAgent, type ChatAgent } from '@/features/chat/api';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { TextField } from '@/shared/ui/TextField';

/**
 * 역할 만들기·수정.
 *
 * 예전엔 "역할 만들기·수정은 웹에서" 라고 링크만 걸어 두었다. 그런데 폰에서 그 링크를
 * 열면 좁은 화면용 웹이 뜨고, 거기엔 역할 목록 사이드바가 아예 없다 — **폰만 쓰는
 * 사람에게는 역할을 만들 길이 한 군데도 없었다.** 막다른 길을 링크로 가려 둔 셈이라
 * 앱에서 직접 되게 옮겼다.
 *
 * 이 화면의 핵심은 이름이나 지침이 아니라 **어떤 도구를 줄지**다.
 * "무엇을 할 수 있는가" 가 곧 "무엇을 망칠 수 있는가" 이므로, 고르는 즉시 결과를 말해준다.
 */

const TOOLS = [
  { id: 'search_tasks', label: '조회', desc: '할 일을 찾아봐요', mutating: false },
  { id: 'create_task', label: '생성', desc: '새 할 일을 만들어요', mutating: true },
  { id: 'update_task', label: '수정', desc: '기존 할 일을 바꿔요', mutating: true },
  { id: 'delete_task', label: '삭제', desc: '할 일을 지워요', mutating: true },
];

const EMOJIS = ['🤖', '📝', '🧭', '🎯', '📊', '🗂️', '🔔', '💡'];
const MAX_INSTRUCTIONS = 1200;

/**
 * 열려 있을 때만 마운트된다(호출부가 조건부로 그린다). 그래서 초기값을 useState 로 바로
 * 넣을 수 있다 — 이펙트에서 폼을 되돌리면 열 때마다 한 프레임 동안 옛 값이 비친다.
 */
export function AgentEditSheet({
  agent,
  onClose,
  onSaved,
}: {
  /** null 이면 새로 만들기 */
  agent: ChatAgent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const editing = !!agent?.id;

  const [name, setName] = useState(agent?.name ?? '');
  const [emoji, setEmoji] = useState(agent?.emoji || '🤖');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [instructions, setInstructions] = useState(agent?.instructions ?? '');
  const [tools, setTools] = useState<string[]>(Array.isArray(agent?.tools) ? [...agent.tools] : []);
  const [summarize, setSummarize] = useState(!!agent?.summarize);
  const [voice, setVoice] = useState(!!agent?.voice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 서버 판정과 같은 규칙으로 여기서 바로 계산한다 — 화면이 거짓말하지 않게
  const unrestricted = tools.length === 0;
  const readOnly = !unrestricted && tools.every((t) => !TOOLS.find((o) => o.id === t)?.mutating);

  const save = async () => {
    if (!name.trim()) {
      setError('역할 이름을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), emoji, description, instructions, tools, summarize, voice };
      if (editing && agent) await updateAgent(agent.id, body);
      else await createAgent(body);
      onSaved();
      onClose();
    } catch (e) {
      // 실패했는데 닫히면 저장된 줄 안다 — 열어둔 채 이유를 보여준다
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!agent) return;
    Alert.alert(`"${agent.name}" 역할을 지울까요?`, '되돌릴 수 없어요. 같은 워크스페이스 모두에게서 사라집니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteAgent(agent.id);
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

  const noticeColor = unrestricted ? theme.orange : readOnly ? theme.green : theme.primary;
  const noticeText = unrestricted
    ? '아무것도 고르지 않으면 제한 없이 모든 일을 할 수 있어요.'
    : readOnly
      ? '이 역할은 아무것도 바꾸지 않아요. 조회만 합니다.'
      : '이 역할은 데이터를 바꿀 수 있어요.';

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
            {editing ? '역할 수정' : '역할 만들기'}
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

        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={[styles.error, { backgroundColor: theme.danger + '1F' }]}>
                <Ionicons name="alert-circle" size={15} color={theme.danger} />
                <ThemedText type="small" style={{ flex: 1, color: theme.danger }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}

            <TextField label="이름" value={name} onChangeText={setName} placeholder="예: 회고 도우미" maxLength={40} />

            <View style={styles.emojiRow}>
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => {
                    tickHaptic();
                    setEmoji(e);
                  }}
                  style={[
                    styles.emoji,
                    { backgroundColor: e === emoji ? theme.primary + '24' : theme.surfaceAlt },
                  ]}>
                  <ThemedText type="default">{e}</ThemedText>
                </Pressable>
              ))}
            </View>

            <TextField
              label="설명"
              value={description}
              onChangeText={setDescription}
              placeholder="목록에서 무엇을 하는 역할인지 알 수 있게"
              maxLength={120}
            />

            <View>
              <TextField
                label="지침"
                value={instructions}
                onChangeText={(t) => setInstructions(t.slice(0, MAX_INSTRUCTIONS))}
                placeholder={'AI 가 어떻게 행동할지 적어주세요.\n예: 조회한 내용을 바탕으로 질문을 던져라.'}
                multiline
                style={styles.instructions}
              />
              <ThemedText type="small" style={{ marginTop: 4, color: theme.textTertiary }}>
                {instructions.length} / {MAX_INSTRUCTIONS}자 · 길수록 매 대화의 비용이 늘어요
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                할 수 있는 일
              </ThemedText>
              {TOOLS.map((t) => {
                const on = tools.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      tickHaptic();
                      setTools((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]));
                    }}
                    style={[
                      styles.tool,
                      {
                        backgroundColor: on ? (t.mutating ? theme.orange : theme.primary) + '14' : theme.surfaceAlt,
                        borderColor: theme.border,
                      },
                    ]}>
                    <View style={styles.toolBody}>
                      <View style={styles.toolTitle}>
                        <ThemedText type="default" style={{ fontWeight: on ? '800' : '600' }}>
                          {t.label}
                        </ThemedText>
                        {t.mutating ? (
                          <ThemedText type="small" style={{ color: theme.orange }}>
                            데이터 변경
                          </ThemedText>
                        ) : null}
                      </View>
                      <ThemedText type="small" style={{ color: theme.textTertiary }}>
                        {t.desc}
                      </ThemedText>
                    </View>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={on ? theme.primary : theme.textTertiary}
                    />
                  </Pressable>
                );
              })}

              {/* 조회마다 AI 를 한 번 더 부른다 — 비용을 문구에 그대로 적는다.
                  "좋은 기능" 처럼만 적어두면 하루 한도가 왜 빨리 닳는지 알 수 없다. */}
              <Pressable
                onPress={() => {
                  tickHaptic();
                  setSummarize((v) => !v);
                }}
                style={[
                  styles.tool,
                  { backgroundColor: summarize ? theme.primary + '14' : theme.surfaceAlt, borderColor: theme.border },
                ]}>
                <View style={styles.toolBody}>
                  <ThemedText type="default" style={{ fontWeight: summarize ? '800' : '600' }}>
                    무엇부터 할지 한 줄로 알려주기
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textTertiary }}>
                    조회할 때마다 AI 를 한 번 더 써요 (하루 사용량 2배)
                  </ThemedText>
                </View>
                <Ionicons
                  name={summarize ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={summarize ? theme.primary : theme.textTertiary}
                />
              </Pressable>

              {/* 말투 — 이 앱의 답변은 서버가 만든 고정 문구라, 지침을 아무리 써도 말투가
                  안 바뀌었다. 이걸 켠 역할만 답변을 지침대로 다시 쓴다.
                  둘 다 켜면 위의 한 줄 요약은 건너뛴다(서버가 그렇게 처리한다). */}
              <Pressable
                onPress={() => {
                  tickHaptic();
                  setVoice((v) => !v);
                }}
                style={[
                  styles.tool,
                  { backgroundColor: voice ? theme.primary + '14' : theme.surfaceAlt, borderColor: theme.border },
                ]}>
                <View style={styles.toolBody}>
                  <ThemedText type="default" style={{ fontWeight: voice ? '800' : '600' }}>
                    지침대로 말하게 하기
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textTertiary }}>
                    {voice
                      ? '위 지침의 말투로 답변을 다시 써요. 켜면 한 줄 요약은 건너뜁니다'
                      : '끄면 지침은 도구 선택에만 쓰이고 답변 말투는 안 바뀌어요'}
                  </ThemedText>
                </View>
                <Ionicons
                  name={voice ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={voice ? theme.primary : theme.textTertiary}
                />
              </Pressable>

              {/* 고른 결과를 즉시 말해준다 — 저장하고 나서 알면 늦다 */}
              <View style={[styles.notice, { backgroundColor: noticeColor + '14' }]}>
                <Ionicons name="information-circle" size={15} color={noticeColor} />
                <ThemedText type="small" style={{ flex: 1, color: noticeColor }}>
                  {noticeText}
                </ThemedText>
              </View>
            </View>

            {editing ? (
              <Pressable onPress={confirmDelete} disabled={saving} style={styles.delete}>
                <ThemedText type="default" style={{ color: theme.danger }}>
                  이 역할 삭제
                </ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
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
  body: { padding: 16, gap: 16 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emoji: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  // TextField 의 input 에 height:48 이 박혀 있다 — minHeight 로는 안 늘어나고 글자만 넘쳐 겹친다
  instructions: { height: 120, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  section: { gap: 8 },
  sectionLabel: { fontWeight: '700' },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toolBody: { flex: 1, gap: 2 },
  toolTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, marginTop: 2 },
  delete: { alignItems: 'center', paddingVertical: 14 },
});
