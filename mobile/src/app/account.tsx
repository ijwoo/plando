import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { deleteAccount, forgotPassword } from '@/features/auth/api';
import { useMe } from '@/features/auth/queries';
import { exportTodosCsv, getMyAccountMeta, unlinkKakao } from '@/features/settings/api';
import { useSettings, useUpdateSettings, useUploadProfileImage } from '@/features/settings/queries';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/shared/store/authStore';
import { Avatar } from '@/shared/ui/Avatar';
import { ListGroup, ListRow, ListSectionHeader } from '@/shared/ui/List';
import { TextField } from '@/shared/ui/TextField';
import { toast } from '@/shared/ui/toast';
import { radius, shadow } from '@/shared/ui/tokens';
import { exceedsUploadLimit, MAX_UPLOAD_LABEL, toJpegUpload } from '@/shared/utils/upload';
import { readableOn } from '@/shared/ui/tone';

/** 백엔드 OAuthProvider 이름 → 한국어. 알 수 없으면 뭉뚱그려 '소셜'. */
function providerLabel(provider?: string | null): string {
  switch (provider) {
    case 'KAKAO':
      return '카카오';
    case 'GOOGLE':
      return '구글';
    case 'APPLE':
      return '애플';
    default:
      return '소셜';
  }
}

/** 내 정보 — 계정 프로필(이름·이메일)과 로그아웃/탈퇴만. 앱 환경설정은 /settings로 분리. */
export default function AccountScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: s, isLoading, isError, error, refetch } = useSettings();
  const { data: meta } = useQuery({ queryKey: ['users', 'me', 'meta'], queryFn: getMyAccountMeta });
  const update = useUpdateSettings();
  const uploadImage = useUploadProfileImage();
  const signOut = useAuthStore((st) => st.signOut);
  const [pwSending, setPwSending] = useState(false);
  const [exporting, setExporting] = useState(false);
  // 소셜(구글·카카오·애플)로만 가입해 비밀번호가 없는 계정 — 로딩 중(undefined)에는 평소대로 둔다
  const socialOnly = meta?.hasPassword === false;

  // 비밀번호 재설정 메일 — 내 이메일로 발송 (웹 설정의 handlePasswordReset 미러)
  const onPasswordReset = async () => {
    if (!me?.email || pwSending) return;
    setPwSending(true);
    try {
      await forgotPassword(me.email);
      toast.success('재설정 메일을 보냈어요. 메일함을 확인하세요.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setPwSending(false);
    }
  };

  // 카카오 연동 해제 — 이메일/비밀번호 로그인만 남는다
  const onUnlinkKakao = () => {
    Alert.alert('카카오 연동 해제', '해제하면 카카오로 로그인할 수 없어요. 이메일 로그인 비밀번호를 먼저 확인하세요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        style: 'destructive',
        onPress: async () => {
          try {
            await unlinkKakao();
            await qc.invalidateQueries({ queryKey: ['users', 'me', 'meta'] });
            toast.success('카카오 연동을 해제했어요');
          } catch (e) {
            toast.error(getApiErrorMessage(e));
          }
        },
      },
    ]);
  };

  // 내 할 일 전체를 CSV로 받아 공유 시트로 내보내기
  const onExportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const csv = await exportTodosCsv();
      const name = `plando-todos-${new Date().toISOString().slice(0, 10)}.csv`;
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.write(csv);
      // expo-sharing — RN Share의 url 필드는 iOS 전용이라 Android에서도 동작하도록.
      // 네이티브 모듈 없는 빌드(리빌드 전) 대비 호출 시점 로드
      const Sharing = await import('expo-sharing');
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: '할 일 내보내기' });
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
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
    const file = await toJpegUpload(a.uri, 'profile');
    uploadImage.mutate(file, {
      onSuccess: () => toast.success('프로필 사진을 변경했어요'),
      onError: () => toast.error('사진 변경에 실패했어요'),
    });
  };

  // 문구는 서버(UserService.deleteAccount)가 실제로 하는 일과 1:1로 맞춘다.
  // "모든 할 일이 삭제"라고 알렸지만 실제로는 남의 워크스페이스 할 일은 남고(작성자 표시만 해제),
  // 메시지·댓글도 상대 기록으로 남은 채 익명화된다 — 지워진 줄 알고 탈퇴하면 안 된다.
  const onDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '• 내가 소유자인 워크스페이스는 할 일까지 통째로 삭제돼요.\n' +
        '• 다른 워크스페이스에서는 자동으로 나가지고, 내가 만든 할 일은 남되 작성자 표시가 지워져요.\n' +
        '• 주고받은 메시지·댓글은 상대방 기록으로 남고 "탈퇴한 사용자"로 표시돼요.\n\n' +
        '되돌릴 수 없어요. 정말 탈퇴할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            // 예전엔 try/finally 로 감싸 실패해도 무조건 signOut 했다. 그래서 서버에서
            // 탈퇴가 실패해도(FK 위반으로 실제로 늘 실패했다) 사용자는 로그아웃만 보고
            // 탈퇴됐다고 믿었고, 계정은 그대로 남아 있었다.
            // 성공했을 때만 로그아웃하고, 실패는 그대로 알린다.
            try {
              await deleteAccount();
            } catch (e) {
              toast.error(getApiErrorMessage(e, '탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.'));
              return;
            }
            await signOut();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: true, title: '내 정보' }} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError || !s ? (
        <View style={styles.center}>
          <ThemedText type="default" style={[styles.err, { color: theme.danger }]}>
            {getApiErrorMessage(error)}
          </ThemedText>
          <Pressable onPress={() => refetch()}>
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* 헤더 — 프로필 사진(탭하면 변경) + 이메일 */}
          <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              onPress={onChangeImage}
              disabled={uploadImage.isPending}
              accessibilityRole="button"
              accessibilityLabel="프로필 사진 변경">
              <Avatar person={{ name: s.displayName ?? me?.email, profileImageUrl: s.profileImageUrl }} size={72} />
              <View style={[styles.editBadge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                <Ionicons name={uploadImage.isPending ? 'hourglass' : 'camera'} size={13} color={readableOn(theme.primary)} />
              </View>
            </Pressable>
            <ThemedText type="default" style={styles.heroName} numberOfLines={1}>
              {s.displayName || me?.email || '내 계정'}
            </ThemedText>
            {s.displayName ? (
              <ThemedText type="small" style={styles.dim} numberOfLines={1}>
                {me?.email}
              </ThemedText>
            ) : null}
          </View>

          <ListSectionHeader>프로필</ListSectionHeader>
          <ListGroup>
            <ListRow
              label="이름"
              desc="다른 멤버에게 보이는 이름"
              vertical
              right={
                <TextField defaultValue={s.displayName ?? ''} placeholder="이름" onEndEditing={(e) =>
                  update.mutate({ displayName: e.nativeEvent.text }, { onSuccess: () => toast.success('이름을 변경했어요') })
                } />
              }
            />
            <ListRow label="이메일" value={me?.email ?? '-'} last hideChevron />
          </ListGroup>

          <ListSectionHeader>보안</ListSectionHeader>
          <ListGroup>
            {socialOnly ? (
              // 비밀번호가 없는 소셜 전용 계정. 재설정 메일을 요청해도 서버는 조용히 무시하고
              // (계정 열거 방지), 비밀번호를 새로 만드는 API 자체가 없다. 누를 수 있게 두면
              // "메일을 보냈어요"만 뜨고 오지 않는 메일을 기다리게 되므로, 눌리지 않는 안내 행으로 바꾼다.
              <View style={styles.unavailable}>
                <ListRow
                  label="비밀번호 재설정"
                  desc={`${providerLabel(meta?.provider)} 로그인 전용 계정이라 비밀번호가 없어요. 재설정할 수 없어요.`}
                  hideChevron
                  last={!meta?.kakaoLinked}
                />
              </View>
            ) : (
              <ListRow
                label={pwSending ? '메일 보내는 중…' : '비밀번호 재설정'}
                desc="가입 이메일로 재설정 메일을 보내요"
                hideChevron={pwSending}
                last={!meta?.kakaoLinked}
                onPress={() => void onPasswordReset()}
              />
            )}
            {meta?.kakaoLinked ? (
              socialOnly ? (
                // 서버가 400으로 막는 조합(비밀번호 없는 계정의 연동 해제) — 해제되면 로그인 수단이 사라진다
                <View style={styles.unavailable}>
                  <ListRow
                    label="카카오 연동 해제"
                    desc="비밀번호가 없는 계정이라 해제할 수 없어요. 해제하면 로그인할 방법이 없어져요."
                    hideChevron
                    last
                  />
                </View>
              ) : (
                <ListRow label="카카오 연동 해제" desc="카카오 소셜 로그인 연결을 끊어요" hideChevron last onPress={onUnlinkKakao} />
              )
            ) : null}
          </ListGroup>

          <ListSectionHeader>데이터</ListSectionHeader>
          <ListGroup>
            <ListRow
              label={exporting ? '내보내는 중…' : '할 일 CSV 내보내기'}
              desc="내 할 일 전체를 CSV 파일로 저장·공유"
              hideChevron={exporting}
              last
              onPress={() => void onExportCsv()}
            />
          </ListGroup>

          <ListSectionHeader>계정</ListSectionHeader>
          <ListGroup>
            <ListRow label="로그아웃" hideChevron onPress={() => void signOut()} />
            <ListRow label="회원 탈퇴" destructive hideChevron last onPress={onDeleteAccount} />
          </ListGroup>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  err: {  },
  content: { padding: 16, paddingBottom: 32 },
  hero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.card,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontWeight: '700', marginTop: 4 },
  dim: { opacity: 0.6 },
  // 지금은 할 수 없는 동작 — 행을 지우지 않고 흐리게 남겨 "왜 안 되는지"를 설명한다
  unavailable: { opacity: 0.55 },
});
