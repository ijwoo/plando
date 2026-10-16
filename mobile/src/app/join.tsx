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
import { joinWorkspace } from '@/features/workspace/api';
import { pendingInvite } from '@/features/workspace/inviteStore';
import { useAuthStore } from '@/shared/store/authStore';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toast } from '@/shared/ui/toast';

/**
 * 워크스페이스 초대 딥링크 — plando://join?code=ABC123 (웹 /join 미러).
 * 로그인 상태면 자동 참여 후 홈으로, 비로그인이면 코드를 보관하고 로그인으로 보낸다
 * (로그인 완료 시 _layout이 보관된 코드로 자동 참여).
 */
export default function JoinScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const code = (codeParam ?? '').trim();
  const status = useAuthStore((s) => s.status);
  const setActive = useWorkspaceStore((s) => s.setActive);

  // 코드 없이 진입한 잘못된 링크는 마운트 시점에 바로 판정 (effect에서 setState 불필요)
  const [error, setError] = useState<string | null>(code ? null : '초대 코드가 없어요. 링크를 다시 확인해주세요.');
  const [attempt, setAttempt] = useState(0);
  const ran = useRef(false);

  const retry = () => {
    ran.current = false;
    setError(null);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (ran.current || status === 'loading' || !code) return;
    ran.current = true;

    if (status !== 'authenticated') {
      // 로그인 후 자동 참여 — _layout에서 pendingInvite 소비
      pendingInvite.set(code);
      router.replace('/(auth)/login');
      return;
    }

    (async () => {
      try {
        const res = await joinWorkspace(code);
        if (res.workspaceId != null) setActive(res.workspaceId);
        await qc.invalidateQueries();
        toast.success(`"${res.workspaceName ?? '워크스페이스'}"에 참여했어요`);
        router.replace('/(tabs)');
      } catch (e) {
        setError(getApiErrorMessage(e));
      }
    })();
  }, [status, code, router, qc, setActive, attempt]);

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
            {code ? <AuthButton title="다시 시도" onPress={retry} style={styles.homeBtn} /> : null}
            <AuthButton title="홈으로" onPress={() => router.replace('/(tabs)')} style={styles.homeBtn} />
          </>
        ) : (
          <>
            <ActivityIndicator style={styles.spinner} color={AUTH.sub} />
            <Text style={styles.dim}>워크스페이스에 참여하는 중…</Text>
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
  homeBtn: { marginTop: 4, alignSelf: 'stretch' },
});
