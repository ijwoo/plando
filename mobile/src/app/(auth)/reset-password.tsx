import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { resetPassword } from '@/features/auth/api';
import { useTheme } from '@/hooks/use-theme';
import { GlassButton } from '@/shared/ui/GlassButton';
import { TextField } from '@/shared/ui/TextField';
import { toast } from '@/shared/ui/toast';

/**
 * 비밀번호 재설정 — 이메일 링크 딥링크(plando://reset-password?token=…) 진입용.
 * 토큰이 파라미터로 오면 자동 입력되고, 없으면 수동 입력(웹 ResetPasswordPage 미러).
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(tokenParam ?? '');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onReset = async () => {
    if (!token.trim()) {
      setError('재설정 코드를 입력해주세요.');
      return;
    }
    if (newPw.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('비밀번호가 일치하지 않아요.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token.trim(), newPw);
      toast.success('비밀번호가 재설정되었어요. 새 비밀번호로 로그인하세요.');
      router.replace('/(auth)/login');
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: '비밀번호 재설정' }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <ThemedText type="default" style={styles.hint}>
              새로 사용할 비밀번호를 입력해주세요.
            </ThemedText>
            {!tokenParam ? (
              <TextField
                placeholder="재설정 코드"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}
            <TextField
              placeholder="새 비밀번호 (6자 이상)"
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              textContentType="newPassword"
            />
            <TextField
              placeholder="새 비밀번호 확인"
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              textContentType="newPassword"
              onSubmitEditing={onReset}
            />
            {error && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            )}
            <GlassButton title={busy ? '재설정 중…' : '비밀번호 재설정'} onPress={onReset} style={styles.primary} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  form: { gap: 12 },
  hint: { opacity: 0.7 },
  primary: { marginTop: 4 },
});
