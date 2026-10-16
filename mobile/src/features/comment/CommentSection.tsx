import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { ThemedText } from '@/components/themed-text';
import { useMe } from '@/features/auth/queries';
import { useWorkspaceMembers } from '@/features/workspace/queries';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/shared/ui/Avatar';
import { relativeTime } from '@/shared/utils/datetime';
import { useComments, useCreateComment, useDeleteComment } from './queries';

/** "@이름" 토큰을 강조색으로 렌더 (백엔드 멘션 규칙 @[\w가-힣]+ 과 동일) */
function renderContent(content: string, color: string) {
  if (!content.includes('@')) return content;
  return content.split(/(@[\w가-힣]+)/g).map((part, i) =>
    /^@[\w가-힣]+$/.test(part) ? (
      <ThemedText key={i} type="default" style={{ color, fontWeight: '700' }}>
        {part}
      </ThemedText>
    ) : (
      part
    ),
  );
}

/** 댓글 — 아바타 + 이름·시간 + 본문(웹 CommentSection 레이아웃), 하단 입력바. */
export function CommentSection({ todoId }: { todoId: number }) {
  const theme = useTheme();
  const glass = isLiquidGlassAvailable();
  const { data: me } = useMe();
  const { data: comments, isLoading } = useComments(todoId);
  const create = useCreateComment(todoId);
  const remove = useDeleteComment(todoId);
  const { data: members } = useWorkspaceMembers();
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const listRef = useRef<ScrollView>(null);

  // 최초 로드·새 댓글 등록 시 최신 댓글로 스크롤 (웹 CommentSection bottomRef.scrollIntoView 미러)
  const count = comments?.length ?? 0;
  useEffect(() => {
    if (count === 0) return;
    // 레이아웃 완료 후 스크롤 — 첫 렌더 직후엔 콘텐츠 높이가 아직 0이라 한 프레임 늦춘다
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [count]);

  const onChange = (v: string) => {
    setText(v);
    const at = v.lastIndexOf('@');
    const after = at >= 0 ? v.slice(at + 1) : '';
    setMentionQuery(at >= 0 && !/\s/.test(after) ? after : null);
  };

  const mentionMatches =
    mentionQuery == null
      ? []
      : (members ?? [])
          .filter((m) => {
            const q = mentionQuery.toLowerCase();
            return (m.name ?? '').toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q);
          })
          .slice(0, 30);

  const selectMention = (name: string) => {
    const at = text.lastIndexOf('@');
    setText(`${text.slice(0, at)}@${name} `);
    setMentionQuery(null);
  };

  const onAdd = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    setMentionQuery(null);
    create.mutate(t);
  };

  return (
    <View style={styles.container}>
      <ScrollView ref={listRef} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : comments && comments.length > 0 ? (
          comments.map((c) => {
            const name = c.writerName ?? c.writerEmail ?? '익명';
            const mine = !!me?.email && c.writerEmail === me.email;
            // 작성자 프로필 사진 — 생성 스펙(CommentResponse)에 이미지 필드가 없어 멤버 목록에서 매칭
            const writerImage = members?.find((m) => m.email === c.writerEmail)?.profileImageUrl;
            return (
              <View key={c.id} style={styles.row}>
                <Avatar person={{ name, email: c.writerEmail, profileImageUrl: writerImage }} size={32} />
                <View style={styles.body}>
                  <View style={styles.head}>
                    <ThemedText type="small" style={styles.name}>
                      {name}
                    </ThemedText>
                    <ThemedText type="small" style={styles.time}>
                      {relativeTime(c.createdAt)}
                    </ThemedText>
                    {mine && c.id != null ? (
                      <Pressable
                        onPress={() =>
                          Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
                            { text: '취소', style: 'cancel' },
                            { text: '삭제', style: 'destructive', onPress: () => remove.mutate(c.id!) },
                          ])
                        }
                        accessibilityLabel="댓글 삭제"
                        hitSlop={6}>
                        <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                  <ThemedText type="default" style={styles.content}>
                    {renderContent(c.content ?? '', theme.primary)}
                  </ThemedText>
                </View>
              </View>
            );
          })
        ) : (
          <ThemedText type="small" style={styles.empty}>
            아직 댓글이 없어요.
          </ThemedText>
        )}
      </ScrollView>

      {mentionMatches.length > 0 ? (
        <ScrollView
          style={[styles.mentionBar, { backgroundColor: theme.background, borderTopColor: theme.divider }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {mentionMatches.map((m) => (
            <Pressable
              key={m.userId ?? m.email}
              onPress={() => selectMention(m.name || (m.email ?? '').split('@')[0])}
              style={({ pressed }) => [styles.mentionItem, pressed && { backgroundColor: theme.surfaceSelected }]}>
              <Avatar person={{ name: m.name, email: m.email, profileImageUrl: m.profileImageUrl }} size={26} />
              <ThemedText type="default" numberOfLines={1} style={styles.mentionName}>
                {m.name ?? m.email}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.composerWrap}>
        {glass ? (
          <GlassView style={styles.composer} glassEffectStyle="regular" isInteractive>
            <CommentComposerRow text={text} onChange={onChange} onAdd={onAdd} disabled={create.isPending} theme={theme} />
          </GlassView>
        ) : (
          <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
            <CommentComposerRow text={text} onChange={onChange} onAdd={onAdd} disabled={create.isPending} theme={theme} />
          </View>
        )}
      </View>
    </View>
  );
}

/** 챗봇/DM 컴포저와 동일한 댓글 입력 행 — multiline TextInput + 원형 arrow-up 전송. */
function CommentComposerRow({
  text,
  onChange,
  onAdd,
  disabled,
  theme,
}: {
  text: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  disabled: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const canSend = !!text.trim() && !disabled;
  return (
    <View style={styles.composerRow}>
      <TextInput
        value={text}
        onChangeText={onChange}
        placeholder="댓글 입력 (@로 멘션)"
        placeholderTextColor={theme.textSecondary}
        multiline
        style={[styles.composerInput, { color: theme.text }]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="댓글 보내기" onPress={onAdd} hitSlop={6} disabled={!canSend}>
        <Ionicons name="arrow-up-circle" size={32} color={canSend ? theme.primary : theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 18, flexGrow: 1 },
  loading: { marginVertical: 16, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  body: { flex: 1, gap: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontWeight: '700' },
  time: { opacity: 0.5, flex: 1 },
  content: { lineHeight: 21 },
  empty: { opacity: 0.5, textAlign: 'center', paddingVertical: 32 },
  mentionBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4, maxHeight: 220 },
  mentionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  mentionName: { flex: 1 },
  composerWrap: { paddingHorizontal: 12, paddingVertical: 8 },
  composer: { borderRadius: 22, paddingHorizontal: 14, paddingVertical: 6, overflow: 'visible' },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: { flex: 1, fontSize: 15, lineHeight: 21, maxHeight: 120, paddingVertical: 6 },
});
