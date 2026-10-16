import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { AuthBackground } from '@/features/auth/AuthBackground';
import { AUTH, AuthButton } from '@/features/auth/AuthUi';
import { BrandMark } from '@/features/auth/BrandMark';
import { verifyEmail } from '@/features/auth/api';
import { useAuthStore } from '@/shared/store/authStore';

/**
 * 이메일 인증 딥링크 — 인증 메일 링크(https://plando.imjaewoo.dev/#/verify-email?token=…)가
 * 유니버설 링크로 앱에서 열릴 때 처리한다(UniversalLinkBridge가 해시를 이 라우트로 변환).
 * 웹 페이지가 1차 인증 화면이고, 이 화면은 링크가 앱으로 열렸을 때 막다른 길이 되지 않게 하는 미러다.
 * 백엔드가 permitAll이라 비로그인 상태에서도 인증이 완료된다(join과 같이 Protected 밖 라우트).
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const token = (tokenParam ?? '').trim();
  const isAuthed = useAuthStore((s) => s.status) === 'authenticated';

  // 토큰 없이 진입한 잘못된 링크는 마운트 시점에 바로 판정
  const [error, setError] = useState<string | null>(token ? null : '인증 링크가 올바르지 않아요. 메일의 링크를 다시 눌러주세요.');
  const [done, setDone] = useState(false);
  // 가입 때 넣은 초대코드의 합류 결과. 예전엔 인증 성공만 알리고 팀에 들어갔는지는
  // 말해 주지 않아, 사용자가 확인할 방법이 없었다.
  const [joinInfo, setJoinInfo] = useState<{ name?: string | null; error?: string | null }>({});
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !token) return;
    ran.current = true;
    (async () => {
      try {
        const result = await verifyEmail(token);
        setJoinInfo({ name: result.joinedWorkspaceName, error: result.joinError });
        // 인증 배너가 바로 사라지도록 me를 다시 읽는다 (useMe는 staleTime: Infinity)
        await qc.invalidateQueries({ queryKey: ['me'] });
        setDone(true);
      } catch (e) {
        setError(getApiErrorMessage(e, '이메일 인증에 실패했어요.'));
      }
    })();
  }, [token, qc]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* 라이트 고정 auth 배경 — 상태바도 어두운 아이콘으로 */}
      <AuthBackground />
      <StatusBar style="dark" />
      <View style={styles.body}>
        <BrandMark size="large" />
        {error ? (
          <>
            <View style={styles.errorBadge}>
              <Ionicons name="alert-circle" size={18} color={AUTH.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <AuthButton
              title={isAuthed ? '홈으로' : '로그인하러 가기'}
              onPress={() => router.replace(isAuthed ? '/(tabs)' : '/(auth)/login')}
              style={styles.actionBtn}
            />
          </>
        ) : done ? (
          <>
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#0F9D58" />
              <Text style={styles.doneText}>이메일 인증이 완료되었어요</Text>
            </View>
            {joinInfo.name ? (
              <Text style={styles.joinNote}>{joinInfo.name} 워크스페이스에 합류했어요.</Text>
            ) : joinInfo.error ? (
              <Text style={styles.joinWarn}>
                {joinInfo.error} 로그인 후 더보기 → 워크스페이스에서 초대코드를 다시 입력해 주세요.
              </Text>
            ) : null}
            <AuthButton
              title={isAuthed ? '홈으로' : '로그인하러 가기'}
              onPress={() => router.replace(isAuthed ? '/(tabs)' : '/(auth)/login')}
              style={styles.actionBtn}
            />
          </>
        ) : (
          <>
            <ActivityIndicator style={styles.spinner} color={AUTH.sub} />
            <Text style={styles.dim}>이메일을 인증하는 중…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AUTH.bgTop },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  spinner: { marginTop: 10 },
  dim: { fontSize: 13, color: AUTH.sub },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#FDEDED',
  },
  errorText: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: '#B91C1C' },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#E7F6EC',
  },
  doneText: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: '#0B6B3A' },
  joinNote: { marginTop: 10, fontSize: 13, lineHeight: 19, color: AUTH.sub, textAlign: 'center' },
  joinWarn: { marginTop: 10, fontSize: 13, lineHeight: 19, color: AUTH.danger, textAlign: 'center' },
  actionBtn: { marginTop: 4, alignSelf: 'stretch' },
});
