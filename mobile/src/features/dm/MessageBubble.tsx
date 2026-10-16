import { Fragment, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Linking, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { API_BASE_URL } from '@/shared/config/env';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/shared/ui/Avatar';
import { tickHaptic } from '@/shared/ui/haptics';
import { useStatusMap } from '@/features/status/queries';
import { readableOn, statusColor } from '@/shared/ui/tone';
import { getLinkPreview, type DmMessage } from './api';

/** 상대 fileUrl(/uploads/dm/...)을 절대 URL로 */
/** @멘션 하이라이트 — 댓글 renderContent와 동일 토큰 규칙(@이름). 내 말풍선(primary 배경)은 색 대신 굵기+밑줄로 구분 */
function renderMentions(content: string | undefined, mine: boolean, color: string) {
  if (!content) return content;
  if (!content.includes('@')) return content;
  return content.split(/(@[\w가-힣]+)/g).map((part, i) =>
    /^@[\w가-힣]+$/.test(part) ? (
      <ThemedText
        key={i}
        type="default"
        style={mine ? { color, fontWeight: '800', textDecorationLine: 'underline' } : { color, fontWeight: '700' }}>
        {part}
      </ThemedText>
    ) : (
      part
    ),
  );
}

/**
 * 인라인 마크다운 + @멘션 렌더 — 웹 renderMarkdown 미러(외부 라이브러리 없음).
 * `**굵게**`·`*굵게*`(컴포저 굵게 버튼이 `*` 삽입) → 굵은 글씨, `` `코드` `` → 모노스페이스+옅은 배경.
 * 마크다운 밖의 일반 구간에만 멘션 하이라이트를 적용하고, 닫히지 않은 마커는 리터럴로 남는다.
 */
function renderRichText(
  content: string | undefined,
  mine: boolean,
  textColor: string,
  mentionColor: string,
  codeBg: string,
): ReactNode {
  if (!content) return content;
  if (!/[*`]/.test(content)) return renderMentions(content, mine, mentionColor);
  // 순서 중요(웹 renderMarkdown과 동일): **굵게** 먼저, 그 다음 *굵게*, 마지막 `코드`
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/gs;
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  const pushPlain = (str: string) => {
    if (str) parts.push(<Fragment key={key++}>{renderMentions(str, mine, mentionColor)}</Fragment>);
  };
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) pushPlain(content.slice(last, m.index));
    if (m[1] || m[3]) {
      parts.push(
        <ThemedText key={key++} type="default" style={{ color: textColor, fontWeight: '700' }}>
          {m[1] ? m[2] : m[4]}
        </ThemedText>,
      );
    } else if (m[5]) {
      parts.push(
        <ThemedText key={key++} type="default" style={[styles.codeSpan, { color: textColor, backgroundColor: codeBg }]}>
          {m[6]}
        </ThemedText>,
      );
    }
    last = m.index + m[0].length;
  }
  pushPlain(content.slice(last));
  return parts;
}

function resolveUrl(fileUrl?: string): string | undefined {
  if (!fileUrl) return undefined;
  // 낙관적(전송 중) 버블은 로컬 uri(file:// 등) — 그대로 사용
  if (/^(https?|file|content|ph|assets-library):/.test(fileUrl)) return fileUrl;
  return `${API_BASE_URL}${fileUrl}`;
}

/** 본문 속 첫 URL — 링크 미리보기 대상 */
function firstUrl(content?: string): string | undefined {
  return content?.match(/https?:\/\/[^\s<>"')\]]+/)?.[0];
}

/** URL 언퍼링 카드 — 백엔드 /api/link-preview 사용 (웹 LinkPreviewCard 미러). 메타가 없으면 렌더 안 함. */
function LinkPreviewCard({ url }: { url: string }) {
  const theme = useTheme();
  const { data } = useQuery({
    queryKey: ['link-preview', url],
    queryFn: () => getLinkPreview(url),
    staleTime: Infinity, // URL의 OG 메타는 사실상 불변 — 방 재진입 시 재요청 안 함
    retry: false,
  });
  if (!data?.title && !data?.description && !data?.image) return null;
  return (
    <Pressable
      onPress={() => void Linking.openURL(data.url ?? url)}
      style={[styles.linkCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {data.image ? <Image source={{ uri: data.image }} style={styles.linkImage} contentFit="cover" /> : null}
      <View style={styles.linkBody}>
        {data.siteName ? (
          <ThemedText type="small" style={[styles.linkSite, { color: theme.textSecondary }]} numberOfLines={1}>
            {data.siteName}
          </ThemedText>
        ) : null}
        {data.title ? (
          <ThemedText type="default" style={styles.linkTitle} numberOfLines={2}>
            {data.title}
          </ThemedText>
        ) : null}
        {data.description ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={2}>
            {data.description}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** sentAt → "오후 3:24" */
function hm(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${mm}`;
}

export function MessageBubble({
  message,
  mine,
  grouped,
  onLongPress,
  onImagePress,
  linkedTitle,
  linkedStatus,
  highlighted,
  showTime = true,
  showRead,
  pending,
  failed,
  onRetry,
  onToggleReaction,
  onReplyPress,
}: {
  message: DmMessage;
  mine: boolean;
  /** 직전 메시지와 같은 발신자 → 아바타·이름 생략하고 위 메시지에 붙여 쌓는다 */
  grouped?: boolean;
  onLongPress?: () => void;
  onImagePress?: (url: string) => void;
  linkedTitle?: string;
  linkedStatus?: string;
  /** 검색에서 이동해 온 메시지 — 잠시 강조 */
  highlighted?: boolean;
  /** 연속 그룹의 마지막 버블에만 시간 표시 (기본 true) */
  showTime?: boolean;
  /** 내 마지막 읽힌 메시지 — 시간 위에 '읽음' 캡션 (웹 lastReadIdx 미러) */
  showRead?: boolean;
  /** 전송 중(낙관적) — 반투명 + '전송 중…' */
  pending?: boolean;
  /** 전송 실패 — 탭해서 재시도 */
  failed?: boolean;
  onRetry?: () => void;
  /** 리액션 칩 탭 → 해당 이모지 토글 (웹 toggleReaction과 동일 의미) */
  onToggleReaction?: (emoji: string) => void;
  /** 답장 인용 탭 → 원본 메시지로 점프 */
  onReplyPress?: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  // 첨부된 일정 카드의 상태 — 커스텀 상태(st_<uuid>)를 원시 키·빨강으로 보여주던 걸 상태 맵으로 해결
  const sm = useStatusMap();
  const onPrimary = readableOn(theme.primary); // 내 버블(primary 배경) 위 텍스트 — 다크모드 밝은 primary 대응
  const fileUrl = resolveUrl(message.fileUrl);
  const isImage = !!fileUrl && (message.fileType ?? '').startsWith('image/');
  const reactions = Object.entries(message.reactionCounts ?? {}).filter(([, n]) => (n as number) > 0);
  const linkUrl = !fileUrl ? firstUrl(message.content) : undefined;

  return (
    <View
      style={[
        styles.outer,
        mine ? styles.outerRight : styles.outerLeft,
        grouped ? styles.grouped : null,
        highlighted ? [styles.highlight, { backgroundColor: theme.primary + '22' }] : null,
      ]}>
      {!mine ? (
        grouped ? (
          <View style={styles.avatarSpacer} />
        ) : (
          <Avatar person={{ name: message.senderName, profileImageUrl: message.senderProfileImageUrl }} size={28} />
        )
      ) : null}

      <View style={[styles.col, mine ? styles.alignRight : styles.alignLeft, pending ? styles.pendingCol : null]}>
        {!mine && message.senderName && !grouped ? (
          <ThemedText type="small" style={styles.sender}>
            {message.senderName}
          </ThemedText>
        ) : null}

        {isImage ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={onLongPress}
            onPress={() => fileUrl && (onImagePress ? onImagePress(fileUrl) : Linking.openURL(fileUrl))}>
            <Image source={{ uri: fileUrl }} style={styles.image} contentFit="cover" />
          </TouchableOpacity>
        ) : fileUrl ? (
          <TouchableOpacity
            onLongPress={onLongPress}
            onPress={() => Linking.openURL(fileUrl)}
            style={[styles.file, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="document-outline" size={20} color={theme.text} />
            <ThemedText type="default" numberOfLines={1} style={styles.fileName}>
              {message.fileName ?? '파일'}
            </ThemedText>
          </TouchableOpacity>
        ) : null}

        {message.content ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={onLongPress}
            style={[
              styles.bubble,
              { backgroundColor: mine ? theme.primary : theme.surfaceAlt },
              mine ? styles.bubbleMine : styles.bubbleOther,
              fileUrl ? styles.bubbleAfterFile : null,
            ]}>
            {message.replyToId ? (
              <Pressable
                onPress={onReplyPress}
                onLongPress={onLongPress}
                disabled={!onReplyPress}
                accessibilityLabel="원본 메시지로 이동"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.reply,
                  { borderLeftColor: mine ? onPrimary : theme.textSecondary },
                  pressed && styles.replyPressed,
                ]}>
                <ThemedText type="small" style={{ color: mine ? onPrimary : theme.textSecondary }} numberOfLines={1}>
                  {message.replyToSenderName ?? ''} · {message.replyToContent ?? ''}
                </ThemedText>
              </Pressable>
            ) : null}
            <ThemedText type="default" style={{ color: mine ? onPrimary : theme.text }}>
              {renderRichText(
                message.content,
                mine,
                mine ? onPrimary : theme.text,
                mine ? onPrimary : theme.primary,
                mine ? 'rgba(0,0,0,0.16)' : theme.surfaceSelected,
              )}
            </ThemedText>
            {message.editedAt ? (
              <ThemedText type="small" style={[styles.edited, { color: mine ? onPrimary : theme.textSecondary }]}>
                편집됨
              </ThemedText>
            ) : null}
          </TouchableOpacity>
        ) : null}

        {linkUrl ? <LinkPreviewCard url={linkUrl} /> : null}

        {message.linkedTodoId
          ? (() => {
              const st = (message.linkedTodoStatus || linkedStatus) as string | undefined;
              const sc = sm.color(st) ?? statusColor(theme, st, sm.category(st));
              return (
                <Pressable
                  onPress={() => router.push(`/todo/${message.linkedTodoId}`)}
                  style={[styles.todoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.todoIcon, { backgroundColor: sc + '1A' }]}>
                    <Ionicons name="checkbox-outline" size={20} color={sc} />
                  </View>
                  <View style={styles.todoBody}>
                    <ThemedText type="small" style={[styles.todoKicker, { color: theme.textSecondary }]}>
                      할 일
                    </ThemedText>
                    <ThemedText type="default" style={styles.todoTitle} numberOfLines={2}>
                      {message.linkedTodoTitle || linkedTitle || '할 일'}
                    </ThemedText>
                    {st ? (
                      <View style={[styles.todoStatus, { backgroundColor: sc + '1A' }]}>
                        <View style={[styles.todoDot, { backgroundColor: sc }]} />
                        <ThemedText type="small" style={{ color: sc, fontWeight: '700' }}>
                          {sm.label(st)}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </Pressable>
              );
            })()
          : null}

        {reactions.length > 0 ? (
          <View style={styles.reactions}>
            {reactions.map(([emoji, n]) => {
              // 내가 남긴 리액션은 primary 틴트로 강조 (웹 DmMessageList 칩과 동일)
              const mineReact = (message.myReactions ?? []).includes(emoji);
              return (
                <Pressable
                  key={emoji}
                  disabled={!onToggleReaction}
                  onPress={() => {
                    tickHaptic();
                    onToggleReaction?.(emoji);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${emoji} 리액션 ${n as number}개${mineReact ? ', 내 리액션 — 탭해서 취소' : ', 탭해서 추가'}`}
                  style={({ pressed }) => [
                    styles.reaction,
                    mineReact
                      ? { backgroundColor: theme.primary + '1A', borderColor: theme.primary }
                      : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    pressed && styles.reactionPressed,
                  ]}>
                  <ThemedText type="small" style={mineReact ? { color: theme.primary, fontWeight: '700' } : undefined}>
                    {emoji} {n as number}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {pending ? (
          <View style={styles.sendState}>
            <Ionicons name="time-outline" size={11} color={theme.textTertiary} />
            <ThemedText type="small" style={[styles.time, styles.sendStateText]}>
              전송 중…
            </ThemedText>
          </View>
        ) : failed ? (
          <Pressable onPress={onRetry} hitSlop={8} accessibilityLabel="재시도" style={styles.sendState}>
            <Ionicons name="refresh" size={11} color={theme.danger} />
            <ThemedText type="small" style={[styles.sendStateText, { color: theme.danger, fontWeight: '700' }]}>
              전송 실패 · 탭해서 재시도
            </ThemedText>
          </Pressable>
        ) : showTime ? (
          <>
            {showRead ? (
              <ThemedText type="small" style={[styles.read, { color: theme.primary }]}>
                읽음
              </ThemedText>
            ) : null}
            <ThemedText type="small" style={styles.time}>
              {hm(message.sentAt)}
            </ThemedText>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { maxWidth: '85%', flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  outerRight: { alignSelf: 'flex-end' },
  outerLeft: { alignSelf: 'flex-start' },
  grouped: { marginTop: 2 },
  highlight: { borderRadius: 16, paddingVertical: 4, marginHorizontal: -4, paddingHorizontal: 4 },
  avatarSpacer: { width: 28 },
  col: { flexShrink: 1 },
  alignRight: { alignItems: 'flex-end' },
  alignLeft: { alignItems: 'flex-start' },
  sender: { opacity: 0.6, marginBottom: 2, marginLeft: 6 },
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 18 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubbleAfterFile: { marginTop: 4 },
  image: { width: 200, height: 200, borderRadius: 14 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, maxWidth: 240 },
  fileName: { flex: 1 },
  edited: { marginTop: 2 },
  reply: { borderLeftWidth: 2, paddingLeft: 8, marginBottom: 4, opacity: 0.9 },
  replyPressed: { opacity: 0.5 },
  codeSpan: { fontFamily: Fonts.mono, fontSize: 13.5 },
  todoCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 6, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, minWidth: 230, maxWidth: 290 },
  todoIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  todoBody: { flex: 1, gap: 3 },
  todoKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, opacity: 0.8 },
  todoTitle: { fontWeight: '700' },
  todoStatus: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7, marginTop: 1 },
  todoDot: { width: 6, height: 6, borderRadius: 3 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  linkCard: { marginTop: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', minWidth: 230, maxWidth: 290 },
  linkImage: { width: '100%', height: 130 },
  linkBody: { padding: 11, gap: 2 },
  linkSite: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  linkTitle: { fontWeight: '700' },
  reaction: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  reactionPressed: { opacity: 0.6 },
  time: { opacity: 0.4, marginTop: 3, marginHorizontal: 4, fontSize: 11 },
  read: { marginTop: 3, marginHorizontal: 4, fontSize: 10, fontWeight: '600' },
  pendingCol: { opacity: 0.55 },
  sendState: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, marginHorizontal: 4 },
  sendStateText: { fontSize: 11 },
});
