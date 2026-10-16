import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { hasRecruitments as checkHasRecruitments, type WorkspaceSummary } from '@/features/workspace/api';
import { KakaoInviteRow } from '@/features/workspace/KakaoInviteSheet';
import {
  useChangeMemberRole,
  useCreateWorkspace,
  useDeleteWorkspace,
  useJoinWorkspace,
  useLeaveWorkspace,
  useMyWorkspaces,
  useRemoveMember,
  useTransferOwner,
  useUpdateWorkspace,
  useUploadWorkspaceIcon,
  useWorkspaceMembers,
} from '@/features/workspace/queries';
import { roleLabel, useWorkspacePermissions, type WorkspaceRole } from '@/features/workspace/permissions';
import { Avatar } from '@/shared/ui/Avatar';
import { WEB_APP_URL } from '@/shared/config/env';
import { exceedsUploadLimit, MAX_UPLOAD_LABEL, toJpegUpload } from '@/shared/utils/upload';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { tickHaptic } from '@/shared/ui/haptics';
import { ListGroup, ListRow } from '@/shared/ui/List';
import { ToastHost } from '@/shared/ui/ToastHost';
import { radius, shadow } from '@/shared/ui/tokens';
import { BottomSheet } from '@/features/todo/todoPickers';
import { readableOn } from '@/shared/ui/tone';

export default function WorkspacesScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { data: workspaces, isLoading, isError, error, refetch, isRefetching } = useMyWorkspaces();
  const activeId = useWorkspaceStore((s) => s.activeId);
  const setActive = useWorkspaceStore((s) => s.setActive);

  const create = useCreateWorkspace();
  const join = useJoinWorkspace();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [managing, setManaging] = useState<WorkspaceSummary | null>(null);

  // 햅틱은 ListRow onPress가 담당
  const onSwitch = (id: number) => {
    setActive(id);
    qc.invalidateQueries();
  };

  const onCreate = async () => {
    if (!name.trim()) return;
    setErr(null);
    try {
      await create.mutateAsync(name.trim());
      tickHaptic();
      setName('');
      setShowAdd(false);
    } catch (e) {
      setErr(getApiErrorMessage(e));
    }
  };

  const onJoin = async () => {
    if (!code.trim()) return;
    setErr(null);
    try {
      await join.mutateAsync(code.trim());
      tickHaptic();
      setCode('');
      setShowAdd(false);
    } catch (e) {
      setErr(getApiErrorMessage(e));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '워크스페이스',
          headerRight: () => (
            <Pressable onPress={() => setShowAdd((v) => !v)} hitSlop={8}>
              <Ionicons name={showAdd ? 'close' : 'add'} size={26} color={theme.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        {/* 추가 — 헤더 +로 펼침 */}
        {showAdd ? (
          <View style={[styles.addCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText type="label" style={styles.addTitle}>
              새 워크스페이스 만들기
            </ThemedText>
            <InlineField icon="add-circle-outline" placeholder="워크스페이스 이름" value={name} onChangeText={setName} actionLabel="만들기" onAction={onCreate} />
            <View style={[styles.addDivider, { backgroundColor: theme.divider }]} />
            <ThemedText type="label" style={styles.addTitle}>
              초대 코드로 참여
            </ThemedText>
            <InlineField icon="key-outline" placeholder="초대 코드" value={code} onChangeText={setCode} autoCapitalize="characters" actionLabel="참여" onAction={onJoin} />
            {err ? (
              <ThemedText type="small" style={[styles.err, { color: theme.danger }]}>
                {err}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {/* 로딩/에러 — 실패가 빈 화면으로 위장되지 않게 */}
        {isLoading ? (
          <ActivityIndicator style={styles.stateBox} />
        ) : isError ? (
          <View style={styles.stateBox}>
            <ThemedText type="default" style={{ color: theme.danger }}>
              {getApiErrorMessage(error)}
            </ThemedText>
            <Pressable onPress={() => refetch()}>
              <ThemedText type="link">다시 시도</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* 워크스페이스 — 플랫 행: 탭하면 전환, 체크 = 사용 중, ⋯로 관리 */}
        {workspaces?.length ? (
          <ListGroup>
            {workspaces.map((w, i) => {
              const active = w.workspaceId === activeId;
              return (
                <ListRow
                  key={w.workspaceId}
                  left={<Avatar person={{ name: w.workspaceName, profileImageUrl: w.iconImageUrl }} size={40} />}
                  label={w.workspaceName ?? '워크스페이스'}
                  desc={`${roleLabel(w.role)} · 멤버 ${w.memberCount ?? 1}명`}
                  last={i === workspaces.length - 1}
                  onPress={() => w.workspaceId != null && onSwitch(w.workspaceId)}
                  right={
                    <View style={styles.rowRight}>
                      {active ? <Ionicons name="checkmark" size={22} color={theme.primary} /> : null}
                      <Pressable
                        onPress={() => setManaging(w)}
                        style={styles.manageBtn}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`${w.workspaceName ?? '워크스페이스'} 관리`}>
                        <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  }
                />
              );
            })}
          </ListGroup>
        ) : null}
      </ScrollView>

      {managing ? (
        <ManageModal workspace={managing} onClose={() => setManaging(null)} />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * 소프트 필드 + 인라인 텍스트 액션 — 태그/상태 피커의 생성 행과 동일 패턴.
 * 값이 있을 때만 우측에 텍스트 버튼(만들기/참여/저장)이 나타나 블록 버튼 없이 조용히 어울린다.
 */
function InlineField({
  icon,
  placeholder,
  value,
  onChangeText,
  actionLabel,
  onAction,
  loading,
  disabled,
  autoCapitalize,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
  disabled?: boolean;
  autoCapitalize?: 'none' | 'characters' | 'sentences' | 'words';
}) {
  const theme = useTheme();
  const showAction = value.trim().length > 0 && !disabled;
  return (
    <View style={[styles.inlineField, { backgroundColor: theme.surfaceAlt }]}>
      <Ionicons name={icon} size={17} color={theme.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        style={[styles.inlineInput, { color: theme.text }]}
        onSubmitEditing={showAction ? onAction : undefined}
        returnKeyType="done"
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator size="small" />
      ) : showAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function ManageModal({ workspace, onClose }: { workspace: WorkspaceSummary; onClose: () => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const id = workspace.workspaceId as number;
  const isOwner = workspace.role === 'OWNER';
  const perms = useWorkspacePermissions();
  // 유일 워크스페이스 나가기/삭제 차단용 (웹 useWorkspaceActions 가드 미러)
  const { data: allWorkspaces } = useMyWorkspaces();
  const isOnlyWorkspace = (allWorkspaces?.length ?? 1) <= 1;

  const { data: members } = useWorkspaceMembers(id);
  const update = useUpdateWorkspace();
  const del = useDeleteWorkspace();
  const leave = useLeaveWorkspace();
  const transfer = useTransferOwner();
  const changeRole = useChangeMemberRole();
  const removeMember = useRemoveMember();
  const uploadIcon = useUploadWorkspaceIcon();

  // 멤버 관리 액션 시트 — 역할 변경(관리자/멤버/뷰어) · 소유권 이전 · 내보내기.
  const onManageMember = (m: { userId?: number | null; name?: string | null; email?: string | null; role?: string | null }) => {
    if (m.userId == null) return;
    const userId = m.userId;
    const label = m.name ?? m.email ?? '이 멤버';
    const targetRole = (m.role ?? 'MEMBER') as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    const opts: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (targetRole !== 'ADMIN') opts.push({ text: '관리자로 변경', onPress: () => changeRole.mutate({ id, userId, role: 'ADMIN' }) });
    if (targetRole !== 'MEMBER') opts.push({ text: '멤버로 변경', onPress: () => changeRole.mutate({ id, userId, role: 'MEMBER' }) });
    if (targetRole !== 'VIEWER') opts.push({ text: '뷰어로 변경', onPress: () => changeRole.mutate({ id, userId, role: 'VIEWER' }) });
    if (isOwner) opts.push({ text: '소유권 이전', onPress: () => onTransfer(userId, label) });
    opts.push({ text: '워크스페이스에서 내보내기', style: 'destructive', onPress: () => confirmKick(userId, label) });
    opts.push({ text: '취소', style: 'cancel' });
    Alert.alert(label, '역할을 변경하거나 내보낼 수 있어요.', opts);
  };
  const confirmKick = (userId: number, label: string) =>
    Alert.alert('내보내기', `${label}님을 워크스페이스에서 내보낼까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '내보내기', style: 'destructive', onPress: () => removeMember.mutate({ id, userId }) },
    ]);

  const [newName, setNewName] = useState(workspace.workspaceName ?? '');
  // 아이콘은 스냅샷 prop이라 업로드 후 이 시트에서 안 바뀜 → 응답 URL로 즉시 반영
  const [iconUrl, setIconUrl] = useState<string | undefined>(workspace.iconImageUrl ?? undefined);
  // 변경 없음/공백이면 저장이 무반응이 되므로 버튼 자체를 비활성화. 이름 변경은 ADMIN 이상만.
  const renameDisabled = !perms.canManageWorkspace || !newName.trim() || newName.trim() === workspace.workspaceName;

  const onRename = async () => {
    if (renameDisabled) return;
    await update.mutateAsync({ id, workspaceName: newName.trim() });
  };

  const onChangeImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진 접근 권한을 허용해주세요.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (exceedsUploadLimit(a.fileSize)) {
      Alert.alert('파일이 너무 큽니다', `${MAX_UPLOAD_LABEL} 이하만 올릴 수 있어요.`);
      return;
    }
    // HEIC(아이폰 기본)는 서버가 못 읽으므로 JPEG로 변환 후 업로드
    const file = await toJpegUpload(a.uri, 'icon');
    uploadIcon.mutate({ id, file }, { onSuccess: (data) => setIconUrl(data?.iconImageUrl ?? iconUrl) });
  };

  const onShareInvite = () => {
    const code = workspace.inviteCode;
    if (!code) return;
    void Share.share({
      message: `Plan Do! 워크스페이스 "${workspace.workspaceName ?? ''}" 초대 코드: ${code}\n참여하기: ${WEB_APP_URL}/#/join?code=${code}`,
    });
  };

  const onDelete = async () => {
    if (isOnlyWorkspace) {
      Alert.alert('삭제할 수 없어요', '워크스페이스는 최소 1개 이상 있어야 해요. 새 워크스페이스를 만든 후 삭제해 주세요.');
      return;
    }
    // 삭제 전 팀모집글 존재 확인 — 있으면 경고 문구 강화(웹 미러)
    const hasRecruit = await checkHasRecruitments(id);
    const msg = hasRecruit
      ? '이 워크스페이스에 등록된 팀모집글도 함께 삭제됩니다. 모든 할 일·데이터가 사라져요. 삭제할까요?'
      : '모든 할 일·데이터가 사라집니다. 삭제할까요?';
    Alert.alert('워크스페이스 삭제', msg, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          del.mutate(id, {
            onSuccess: () => {
              qc.invalidateQueries();
              onClose();
            },
          }),
      },
    ]);
  };

  const onLeave = () => {
    if (isOnlyWorkspace) {
      Alert.alert('나갈 수 없어요', '유일한 워크스페이스예요. 나가려면 먼저 새 워크스페이스를 만들어 주세요.');
      return;
    }
    Alert.alert('워크스페이스 나가기', '이 워크스페이스에서 나갈까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: () =>
          leave.mutate(id, {
            onSuccess: () => {
              qc.invalidateQueries();
              onClose();
            },
          }),
      },
    ]);
  };

  const onTransfer = (targetUserId?: number, memberName?: string) => {
    if (targetUserId == null) return;
    Alert.alert('소유권 이전', `${memberName ?? '이 멤버'}에게 소유권을 넘길까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '이전',
        style: 'destructive',
        onPress: () => transfer.mutate({ id, targetUserId }, { onSuccess: onClose }),
      },
    ]);
  };

  return (
    <BottomSheet open onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기" style={[styles.sheetClose, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </Pressable>
            {/* 히어로 — 아바타(이미지 변경) + 이름 */}
            <View style={styles.hero}>
              <Pressable
                onPress={perms.canManageWorkspace ? onChangeImage : undefined}
                disabled={!perms.canManageWorkspace || uploadIcon.isPending}
                accessibilityRole="button"
                accessibilityLabel="워크스페이스 사진 변경">
                <Avatar person={{ name: workspace.workspaceName, profileImageUrl: iconUrl }} size={68} />
                {isOwner ? (
                  <View style={[styles.editBadge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                    <Ionicons name={uploadIcon.isPending ? 'hourglass' : 'camera'} size={12} color={readableOn(theme.primary)} />
                  </View>
                ) : null}
              </Pressable>
              <ThemedText type="default" style={styles.heroName} numberOfLines={1}>
                {workspace.workspaceName ?? '워크스페이스'}
              </ThemedText>
              <ThemedText type="small" style={styles.dim}>
                {roleLabel(workspace.role)} · 멤버 {members?.length ?? workspace.memberCount ?? 1}명
              </ThemedText>
            </View>

            {/* 이름 변경(관리자 이상) */}
            {perms.canManageWorkspace ? (
              <View style={styles.renameRow}>
                <InlineField
                  icon="pencil-outline"
                  placeholder="이름 변경"
                  value={newName}
                  onChangeText={setNewName}
                  actionLabel="저장"
                  onAction={onRename}
                  disabled={renameDisabled}
                  loading={update.isPending}
                />
              </View>
            ) : null}

            {/* 초대 코드 공유 */}
            {workspace.inviteCode ? (
              <Pressable accessibilityRole="button" accessibilityLabel="초대 링크 공유" onPress={onShareInvite} style={[styles.group, styles.groupRow, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="share-outline" size={18} color={theme.primary} />
                <ThemedText type="default" style={styles.flex}>
                  초대 코드 공유
                </ThemedText>
                <ThemedText type="small" style={[styles.code, { color: theme.textSecondary }]}>
                  {workspace.inviteCode}
                </ThemedText>
                <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
              </Pressable>
            ) : null}

            {/* 카카오톡으로 초대 — 웹 KakaoInviteDialog와 동일한 피드 템플릿 공유 */}
            {workspace.inviteCode ? (
              <KakaoInviteRow workspace={workspace} onFallbackShare={onShareInvite} />
            ) : null}

            {/* 멤버 */}
            <ThemedText type="small" style={styles.section}>
              멤버 {members?.length ?? 0}명
            </ThemedText>
            <View style={[styles.group, { backgroundColor: theme.surfaceAlt }]}>
              {members?.map((m, i) => (
                <View
                  key={m.userId}
                  style={[styles.memberRow, i < (members.length - 1) && { borderBottomColor: theme.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                  <Avatar person={{ name: m.name ?? m.email, profileImageUrl: m.profileImageUrl }} size={34} />
                  <View style={styles.flex}>
                    <ThemedText type="default" numberOfLines={1}>
                      {m.name ?? m.email}
                    </ThemedText>
                    <ThemedText type="small" style={styles.dim} numberOfLines={1}>
                      {roleLabel(m.role)} · {m.email}
                    </ThemedText>
                  </View>
                  {perms.canManageMembers && perms.canManageMember((m.role ?? 'MEMBER') as WorkspaceRole) ? (
                    <Pressable onPress={() => onManageMember(m)} hitSlop={8} accessibilityLabel="멤버 관리">
                      <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            {/* 위험 작업 — 소유자는 나가기가 서버에서 막혀 있어(403) 아예 내놓지 않고,
                대신 할 수 있는 일(소유권 이전·삭제)을 아래 안내로 알려준다. */}
            <View style={[styles.group, { backgroundColor: theme.surfaceAlt }]}>
              {isOwner ? (
                <Pressable onPress={() => void onDelete()} style={styles.dangerRow}>
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                  <ThemedText type="default" style={[styles.danger, { color: theme.danger }]}>
                    워크스페이스 삭제
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="워크스페이스 나가기" onPress={onLeave} style={styles.dangerRow}>
                  <Ionicons name="exit-outline" size={18} color={theme.danger} />
                  <ThemedText type="default" style={[styles.danger, { color: theme.danger }]}>
                    워크스페이스 나가기
                  </ThemedText>
                </Pressable>
              )}
            </View>
            {isOwner ? (
              <ThemedText type="small" style={[styles.ownerNote, { color: theme.textSecondary }]}>
                소유자는 워크스페이스를 나갈 수 없어요. 멤버 목록에서 다른 멤버에게 소유권을 넘기면 나갈 수 있어요.
              </ThemedText>
            ) : null}
          </ScrollView>
      {/* BottomSheet(Modal)는 별도 네이티브 레이어라 루트 ToastHost가 가려진다 → 여기서도 렌더 */}
      <ToastHost />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  section: { opacity: 0.6, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  // 소프트 필드 + 인라인 액션(태그 피커 생성 행과 동일 톤) — 블록 버튼 없음
  inlineField: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 46, borderRadius: 12, paddingHorizontal: 13 },
  inlineInput: { flex: 1, fontSize: 15, height: '100%' },
  renameRow: { marginTop: 8, marginBottom: 2 },
  err: { marginTop: 6 },
  // 목록 카드
  addCard: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10, ...shadow.card },
  addTitle: { opacity: 0.8 },
  addDivider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  // 플랫 행 우측 — 사용 중 체크 + 관리 버튼
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dim: { opacity: 0.6 },
  manageBtn: { padding: 6 },
  // 관리 시트 (공용 BottomSheet 내부 — 핸들/드래그/백드롭은 BottomSheet 제공)
  sheetContent: { paddingHorizontal: 16, paddingBottom: 12 },
  sheetClose: { position: 'absolute', right: 14, top: 2, zIndex: 5, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  editBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontWeight: '700', marginTop: 4 },
  // 가로 패딩만 — 세로 여백은 각 행(row)이 정의(다중 행 그룹에서 padding 이중 적용 방지)
  group: { borderRadius: radius.card, overflow: 'hidden', marginTop: 8, paddingHorizontal: 12 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  code: { fontWeight: '700', letterSpacing: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  danger: { fontWeight: '600' },
  ownerNote: { marginTop: 8, marginHorizontal: 6, lineHeight: 18, textAlign: 'center' },
});
