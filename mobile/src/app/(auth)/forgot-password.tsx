import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { forgotPassword, resetPassword } from '@/features/auth/api';
import { toast } from '@/shared/ui/toast';
import { GlassButton } from '@/shared/ui/GlassButton';
import { TextField } from '@/shared/ui/TextField';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // 재설정 단계 — 이메일로 받은 토큰 + 새 비밀번호
  const [token, setToken] = useState('');
  const [newPw, setNewPw] = useState('');
  // 재발송 전용 상태 — busy는 재설정 버튼과 공유라 문구 구분용
  const [resending, setResending] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (busy) return;
    setResending(true);
    try {
      await onSubmit();
    } finally {
      setResending(false);
    }
  };

  const onReset = async () => {
    if (!token.trim() || !newPw.trim()) {
      setError('재설정 코드와 새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPw.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token.trim(), newPw);
      toast.success('비밀번호가 재설정되었어요. 새 비밀번호로 로그인하세요.');
      router.back();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: '비밀번호 찾기' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {sent ? (
            <View style={styles.form}>
              <ThemedText type="default" style={styles.hint}>
                이메일로 받은 재설정 코드와 새 비밀번호를 입력하세요.
              </ThemedText>
              <TextField
                placeholder="재설정 코드"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextField
                placeholder="새 비밀번호 (6자 이상)"
                value={newPw}
                onChangeText={setNewPw}
                secureTextEntry
                textContentType="newPassword"
                onSubmitEditing={onReset}
              />
              {error && (
                <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
                  {error}
                </ThemedText>
              )}
              <GlassButton title={busy ? '재설정 중…' : '비밀번호 재설정'} onPress={onReset} style={styles.primary} />
              <Pressable
                onPress={() => void onResend()}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="재설정 코드 다시 보내기"
                style={styles.resend}>
                <ThemedText type="small" style={[styles.hint, busy && styles.dimmed]}>
                  {resending ? '보내는 중…' : '코드를 못 받았나요? 다시 보내기'}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <ThemedText type="default" style={styles.hint}>
                가입한 이메일로 비밀번호 재설정 링크를 보내드려요.
              </ThemedText>
              <TextField
                placeholder="이메일"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                onSubmitEditing={onSubmit}
              />

              {error && (
                <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
                  {error}
                </ThemedText>
              )}

              <GlassButton
                title={busy ? '전송 중…' : '재설정 링크 보내기'}
                onPress={onSubmit}
                style={styles.primary}
              />
            </View>
          )}
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
  error: {  },
  primary: { marginTop: 4 },
  resend: { alignSelf: 'flex-start', paddingVertical: 4 },
  dimmed: { opacity: 0.4 },
});
