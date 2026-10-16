import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useMe } from '@/features/auth/queries';
import { BottomSheet } from '@/features/todo/todoPickers';
import { useWorkspaceMembers } from '@/features/workspace/queries';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE_URL } from '@/shared/config/env';
import { Avatar } from '@/shared/ui/Avatar';
import { GlassButton } from '@/shared/ui/GlassButton';
import { toast } from '@/shared/ui/toast';
import { useStatusMap } from '@/features/status/queries';
import { statusColor } from '@/shared/ui/tone';

import { getPartnerProfile, inviteToGroup, type DmMessage, type DmRoom } from './api';
import { dmKeys } from './queries';

/** 상대 fileUrl(/uploads/dm/...)을 절대 URL로 */
const abs = (u?: string) => (u ? (/^https?:\/\//.test(u) ? u : `${API_BASE_URL}${u}`) : undefined);

/** 최근 활동 라벨 (웹 formatLastActive 미러 — 간단 버전) */
function lastActiveLabel(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 5) return '지금 활동 중';
  if (mins < 60) return `${mins}분 전 활동`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전 활동`;
  return `${Math.floor(hours / 24)}일 전 활동`;
}

/**
 * 방 정보 시트 — 헤더 pill 탭으로 진입 (웹 DmPartnerProfileModal/DmChatHeader 미러).
 * 상대 프로필(1:1) 또는 그룹 멤버 초대 + 공유 일정·공유 파일 모아보기.
 */
export function RoomInfoSheet({
  room,
  roomId,
  messages,
  onClose,
  onOpenTodo,
  onOpenImage,
}: {
  room?: DmRoom;
  roomId: number;
  messages: DmMessage[];
  onClose: () => void;
  onOpenTodo: (todoId: number) => void;
  onOpenImage: (url: string) => void;
}) {
  const theme = useTheme();
  const qc = useQueryClient();
  // 워크스페이스 커스텀 상태 — 없으면 공유 일정이 st_<uuid> + 빨강으로 표시된다
  const sm = useStatusMap();
  const isGroup = !!room?.isGroup;

  const name = isGroup ? (room?.groupName ?? '그룹') : (room?.partnerName ?? '대화');
  const image = isGroup ? room?.groupImageUrl : room?.partnerProfileImageUrl;

  // 파트너 프로필(1:1 표시용) + 공유 파일 서버 집계 — sharedFiles는 방 단위 DB 집계라
  // 그룹방에서도 유효하다. 로드된 메시지에서만 파생하면 옛 이미지가 그리드에 빠진다.
  const { data: profile } = useQuery({
    queryKey: ['dm', 'partner-profile', roomId],
    queryFn: () => getPartnerProfile(roomId),
    staleTime: 60_000,
  });
  const activity = !isGroup ? lastActiveLabel(profile?.lastActiveAt) : null;

  // 공유 일정 — 1:1은 서버 집계(전체 히스토리), 그룹은 로드된 메시지에서 파생
  const sharedTodos = useMemo(() => {
    if (!isGroup && profile?.sharedTodos?.length) {
      return profile.sharedTodos
        .filter((t): t is typeof t & { id: number } => t.id != null)
        .slice(0, 10)
        .map((t) => ({ id: t.id, title: t.title, status: t.status }));
    }
    const seen = new Set<number>();
    const out: { id: number; title?: string; status?: string }[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.linkedTodoId == null || seen.has(m.linkedTodoId)) continue;
      seen.add(m.linkedTodoId);
      out.push({ id: m.linkedTodoId, title: m.linkedTodoTitle, status: m.linkedTodoStatus });
      if (out.length >= 10) break;
    }
    return out;
  }, [messages, isGroup, profile]);

  // 공유 파일 — 1:1은 서버 집계, 그룹은 로드된 메시지에서 파생 (이미지 그리드 + 일반 파일, 최신순)
  const { images, files } = useMemo(() => {
    const imgs: string[] = [];
    const fls: { url: string; name: string }[] = [];
    const push = (fileUrl?: string, fileType?: string, fileName?: string) => {
      const url = abs(fileUrl);
      if (!url) return;
      if ((fileType ?? '').startsWith('image/')) {
        if (imgs.length < 12) imgs.push(url);
      } else if (fls.length < 8) {
        fls.push({ url, name: fileName ?? fileUrl!.split('/').pop() ?? '파일' });
      }
    };
    if (profile?.sharedFiles?.length) {
      // 서버 집계(전체 히스토리, 최신 20) — 그룹방 포함
      for (const f of profile.sharedFiles) push(f.fileUrl, f.fileType, f.fileName);
    } else {
      // 서버 응답 전/실패 시 로드된 메시지에서 파생 (폴백)
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        push(m.fileUrl, m.fileType, m.fileName);
      }
    }
    return { images: imgs, files: fls };
  }, [messages, profile]);

  // 그룹 멤버 초대
  const { data: me } = useMe();
  const { data: members } = useWorkspaceMembers();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [inviting, setInviting] = useState(false);
  const candidates = (members ?? []).filter((m) => m.email !== me?.email);

  const toggle = (userId: number) =>
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  const onInvite = async () => {
    if (!selected.length || inviting) return;
    setInviting(true);
    try {
      await inviteToGroup(roomId, selected);
      await qc.invalidateQueries({ queryKey: dmKeys.rooms });
      toast.success(`${selected.length}명을 초대했어요`);
      setSelected([]);
      setInviteOpen(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setInviting(false);
    }
  };

  return (
    <BottomSheet open onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기" style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt }]}>
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </Pressable>
        {/* 히어로 */}
        <View style={styles.hero}>
          <Avatar person={{ name, profileImageUrl: image }} size={68} />
          <ThemedText type="default" style={styles.heroName} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="small" style={styles.dim} numberOfLines={1}>
            {isGroup ? `멤버 ${room?.memberCount ?? 0}명` : (activity ?? room?.partnerEmail ?? '')}
          </ThemedText>
        </View>

        {/* 그룹 — 멤버 초대 */}
        {isGroup ? (
          <>
            <Pressable
              onPress={() => setInviteOpen((v) => !v)}
              style={[styles.group, styles.groupRow, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="person-add-outline" size={18} color={theme.primary} />
              <ThemedText type="default" style={styles.flex}>
                멤버 초대
              </ThemedText>
              <Ionicons name={inviteOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textTertiary} />
            </Pressable>
            {inviteOpen ? (
              <View style={[styles.group, { backgroundColor: theme.surfaceAlt }]}>
                {candidates.length === 0 ? (
                  <ThemedText type="small" style={styles.dim}>
                    초대할 수 있는 멤버가 없어요.
                  </ThemedText>
                ) : (
                  candidates.map((m) => {
                    const active = m.userId != null && selected.includes(m.userId);
                    return (
                      <Pressable
                        key={m.userId}
                        onPress={() => m.userId != null && toggle(m.userId)}
                        style={styles.memberRow}>
                        <Avatar person={{ name: m.name ?? m.email, profileImageUrl: m.profileImageUrl }} size={32} />
                        <View style={styles.flex}>
                          <ThemedText type="default" numberOfLines={1}>
                            {m.name ?? m.email}
                          </ThemedText>
                        </View>
                        <Ionicons
                          name={active ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={active ? theme.primary : theme.textTertiary}
                        />
                      </Pressable>
                    );
                  })
                )}
                {selected.length ? (
                  <GlassButton title={inviting ? '초대 중…' : `${selected.length}명 초대`} onPress={() => void onInvite()} style={styles.inviteBtn} />
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {/* 공유 일정 */}
        {sharedTodos.length ? (
          <>
            <ThemedText type="small" style={styles.section}>
              공유 일정
            </ThemedText>
            <View style={[styles.group, { backgroundColor: theme.surfaceAlt }]}>
              {sharedTodos.map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() => onOpenTodo(t.id)}
                  style={[styles.todoRow, i > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Ionicons name="checkbox-outline" size={17} color={theme.primary} />
                  <ThemedText type="default" style={styles.flex} numberOfLines={1}>
                    {t.title ?? '할 일'}
                  </ThemedText>
                  {t.status ? (
                    <ThemedText
                      type="small"
                      style={{ color: sm.color(t.status) ?? statusColor(theme, t.status, sm.category(t.status)), fontWeight: '700' }}>
                      {sm.label(t.status)}
                    </ThemedText>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* 공유 파일 */}
        {images.length || files.length ? (
          <>
            <ThemedText type="small" style={styles.section}>
              공유 파일
            </ThemedText>
            {images.length ? (
              <View style={styles.imageGrid}>
                {images.map((url) => (
                  <Pressable key={url} onPress={() => onOpenImage(url)} style={styles.imageCell}>
                    <Image source={{ uri: url }} style={styles.image} contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {files.length ? (
              <View style={[styles.group, { backgroundColor: theme.surfaceAlt }]}>
                {files.map((f, i) => (
                  <Pressable
                    key={`${f.url}-${i}`}
                    onPress={() => void Linking.openURL(f.url)}
                    style={[styles.todoRow, i > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <Ionicons name="document-outline" size={17} color={theme.textSecondary} />
                    <ThemedText type="default" style={styles.flex} numberOfLines={1}>
                      {f.name}
                    </ThemedText>
                    <Ionicons name="open-outline" size={15} color={theme.textTertiary} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {!isGroup && !sharedTodos.length && !images.length && !files.length ? (
          <ThemedText type="small" style={[styles.dim, styles.empty]}>
            아직 공유한 일정·파일이 없어요.
          </ThemedText>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  closeBtn: { position: 'absolute', right: 14, top: 2, zIndex: 5, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  heroName: { fontWeight: '700', marginTop: 4 },
  dim: { opacity: 0.6 },
  flex: { flex: 1 },
  section: { opacity: 0.6, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  group: { borderRadius: 14, overflow: 'hidden', marginTop: 8, padding: 12 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  inviteBtn: { marginTop: 8 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  imageCell: { width: '23.5%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  empty: { textAlign: 'center', paddingVertical: 20 },
});
