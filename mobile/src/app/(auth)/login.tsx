import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { guestLogin, login } from '@/features/auth/api';
import { AuthBackground } from '@/features/auth/AuthBackground';
import { AUTH, AuthBackButton, AuthButton, AuthErrorBanner, AuthField } from '@/features/auth/AuthUi';
import { BrandMark } from '@/features/auth/BrandMark';
import { SocialButton } from '@/features/auth/SocialButton';
import { startAppleLogin, startSocialLogin, type OAuthProvider } from '@/features/auth/oauth';
import { useAuthStore } from '@/shared/store/authStore';

type Busy = null | 'login' | 'guest' | 'apple' | OAuthProvider;
type Step = 'method' | 'email';

/** method step 하단 가치 제안 — 웹 LoginPageMobile FEATURES 미러 */
const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  { icon: 'people', title: '협업', desc: '함께 작업을 공유하고 진행 상황을 파악해요' },
  { icon: 'person-add', title: '팀 모집', desc: '새 프로젝트의 동료를 찾고 바로 합류해요' },
  { icon: 'sparkles', title: 'AI 어시스턴트', desc: '자연어로 일정을 만들고 빠르게 처리해요' },
];

export default function LoginScreen() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const [step, setStep] = useState<Step>('method');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  // dev 전용 자동 로그인 — 시뮬레이터 스크린샷/E2E용. 프로덕션 번들에선 env 미설정 + __DEV__ false.
  useEffect(() => {
    const autoEmail = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_EMAIL;
    const autoPw = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_PASSWORD;
    if (!__DEV__ || !autoEmail || !autoPw) return;
    void (async () => {
      try {
        const res = await login(autoEmail, autoPw);
        if (res.accessToken) await signIn(res.accessToken, { id: res.id, name: res.name, email: res.email });
      } catch {
        // 자동 로그인 실패는 조용히 — 수동 로그인 화면 그대로
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (key: Busy, fn: () => Promise<void>) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onLogin = () =>
    run('login', async () => {
      if (!email.trim() || !password) {
        setError('이메일과 비밀번호를 입력해주세요.');
        return;
      }
      const res = await login(email.trim(), password);
      if (!res.accessToken) throw new Error('로그인에 실패했습니다.');
      await signIn(res.accessToken, { id: res.id, name: res.name, email: res.email });
    });

  const onSocial = (provider: OAuthProvider) =>
    run(provider, async () => {
      const result = await startSocialLogin(provider);
      if (result) await signIn(result.token);
    });

  const onApple = () =>
    run('apple', async () => {
      const res = await startAppleLogin();
      if (res?.accessToken) {
        await signIn(res.accessToken, { id: res.id, name: res.name, email: res.email });
      }
    });

  const onGuest = () =>
    run('guest', async () => {
      const res = await guestLogin();
      if (res.accessToken) {
        await signIn(res.accessToken, { id: res.id, name: res.name, email: res.email });
      }
    });

  return (
    <View style={styles.container}>
      {/* 웹 auth 그라데이션(라이트 고정) — 밝은 배경이므로 다크 모드에서도 어두운 상태바 */}
      <AuthBackground />
      <StatusBar style="dark" />

      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {step === 'method' ? (
              <View style={styles.flex}>
                {/* 히어로 — 큰 브랜드 마크 (카드 없이 그라데이션 위에 직접) */}
                <View style={styles.hero}>
                  <BrandMark size="large" />
                </View>

                {/* 로그인 방법 — 세로 중앙. Apple 최상단(App Store 4.8 / HIG) → 카카오 → Google */}
                <View style={styles.methodCenter}>
                  {error ? <AuthErrorBanner message={error} /> : null}

                  <View style={styles.methods}>
                    {Platform.OS === 'ios' ? (
                      <SocialButton brand="apple" onPress={onApple} loading={busy === 'apple'} />
                    ) : null}
                    <SocialButton brand="kakao" onPress={() => onSocial('kakao')} loading={busy === 'kakao'} />
                    <SocialButton brand="google" onPress={() => onSocial('google')} loading={busy === 'google'} />

                    <View style={styles.divider}>
                      <View style={styles.line} />
                      <Text style={styles.dividerText}>또는</Text>
                      <View style={styles.line} />
                    </View>

                    <Pressable
                      onPress={() => {
                        setError(null);
                        setStep('email');
                      }}
                      style={({ pressed }) => [styles.emailBtn, pressed && styles.pressed]}>
                      <Ionicons name="mail-outline" size={18} color={AUTH.sub} />
                      <Text style={styles.emailBtnText}>이메일로 로그인</Text>
                    </Pressable>
                  </View>
                </View>

                {/* 가치 제안 3줄 — 웹 FEATURES 블록 */}
                <View style={styles.features}>
                  {FEATURES.map((f) => (
                    <View key={f.title} style={styles.featureRow}>
                      <View style={styles.featureIcon}>
                        <Ionicons name={f.icon} size={16} color={AUTH.primary} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.featureTitle}>{f.title}</Text>
                        <Text style={styles.featureDesc}>{f.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* 푸터 — 회원가입 · 둘러보기 */}
                <View style={styles.footer}>
                  <Link href="/(auth)/signup" asChild>
                    <Pressable hitSlop={8}>
                      <Text style={styles.signupLink}>회원가입</Text>
                    </Pressable>
                  </Link>
                  <Text style={styles.footerDot}>·</Text>
                  <Pressable onPress={onGuest} disabled={busy === 'guest'} hitSlop={8}>
                    {busy === 'guest' ? (
                      <ActivityIndicator size="small" color={AUTH.sub} />
                    ) : (
                      <Text style={styles.guestLink}>둘러보기</Text>
                    )}
                  </Pressable>
                </View>

                {/* 개인정보처리방침 동의 안내 — 웹 LoginPageMobile 미러 */}
                <Text style={styles.consent}>
                  서비스 이용 시{' '}
                  <Text style={styles.consentLink} onPress={() => router.push('/legal?doc=privacy')}>
                    개인정보처리방침
                  </Text>
                  에 동의하게 됩니다.
                </Text>
              </View>
            ) : (
              /* 이메일 로그인 — 흰 카드 위 폼 (웹 email step 미러) */
              <View style={styles.card}>
                <AuthBackButton
                  onPress={() => {
                    setError(null);
                    setStep('method');
                  }}
                />
                <Text style={styles.title}>로그인</Text>
                <Text style={styles.subtitle}>이메일과 비밀번호를 입력해주세요</Text>

                {error ? <AuthErrorBanner message={error} /> : null}

                <View style={styles.form}>
                  <AuthField
                    label="이메일"
                    placeholder="example@email.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                  <AuthField
                    label="비밀번호"
                    placeholder="비밀번호"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="password"
                    textContentType="password"
                    onSubmitEditing={onLogin}
                  />
                </View>

                <Pressable
                  onPress={() => router.push('/(auth)/forgot-password')}
                  hitSlop={8}
                  style={styles.forgot}>
                  <Text style={styles.forgotText}>비밀번호 찾기</Text>
                </Pressable>

                <AuthButton title="로그인" loading={busy === 'login'} onPress={onLogin} />
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AUTH.bgTop },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 },
  pressed: { opacity: 0.7 },

  // ── method step ──
  hero: { alignItems: 'center', paddingTop: 12, marginBottom: 8 },
  methodCenter: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  methods: { gap: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: AUTH.divider },
  dividerText: { fontSize: 11, fontWeight: '500', color: AUTH.faint },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: AUTH.card,
    borderWidth: 1.5,
    borderColor: AUTH.divider,
  },
  emailBtnText: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.15, color: AUTH.text },
  features: { alignSelf: 'center', width: '100%', maxWidth: 260, gap: 12, marginTop: 24, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(27,111,245,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  featureTitle: { fontSize: 13.5, fontWeight: '700', color: AUTH.text, marginBottom: 2 },
  featureDesc: { fontSize: 11.5, lineHeight: 17, color: AUTH.sub },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: AUTH.divider,
  },
  signupLink: { fontSize: 13, fontWeight: '700', color: AUTH.primary },
  footerDot: { fontSize: 12, color: AUTH.faint },
  guestLink: { fontSize: 13, fontWeight: '500', color: AUTH.sub },
  consent: { fontSize: 11, lineHeight: 16.5, color: AUTH.faint, textAlign: 'center', marginTop: 14 },
  consentLink: { fontWeight: '600', color: AUTH.sub, textDecorationLine: 'underline' },

  // ── email step (흰 카드) ──
  card: {
    flex: 1,
    backgroundColor: AUTH.card,
    borderRadius: 22,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.44, color: AUTH.text, marginTop: 14 },
  subtitle: { fontSize: 13, lineHeight: 19, color: AUTH.sub, marginTop: 4, marginBottom: 22 },
  form: { gap: 12 },
  forgot: { alignSelf: 'flex-end', marginTop: 8, marginBottom: 18 },
  forgotText: { fontSize: 12.5, fontWeight: '600', color: AUTH.sub },
});
