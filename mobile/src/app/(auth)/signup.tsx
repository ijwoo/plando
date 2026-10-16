import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { signup } from '@/features/auth/api';
import { AuthBackground } from '@/features/auth/AuthBackground';
import { AUTH, AuthBackButton, AuthButton, AuthErrorBanner, AuthField } from '@/features/auth/AuthUi';
import { startAppleLogin, startSocialLogin } from '@/features/auth/oauth';
import { SocialButton } from '@/features/auth/SocialButton';
import { useAuthStore } from '@/shared/store/authStore';

/** 웹 RegisterPageMobile의 3단계 흐름 미러: 가입 방법 → 계정 정보 → 워크스페이스 */
type Step = 'method' | 'account' | 'workspace';
type JoinMode = 'create' | 'invite' | 'later';
type Busy = null | 'apple' | 'kakao' | 'submit';

/** 웹 shared/utils/validators.js EMAIL_REGEX 미러 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 진행 표시 n/3 — 웹 StepProgress 미러 (4px 세그먼트, active #1B6FF5 / inactive #CBD5E1) */
function StepProgress({ current }: { current: number }) {
  return (
    <View style={styles.progressRow}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.progressSeg, i < current && styles.progressSegActive]} />
      ))}
    </View>
  );
}

/** 워크스페이스 옵션 카드 — 웹 WorkspaceOption 미러 (아이콘 박스 + 제목/설명 + 선택 보더) */
function WorkspaceOption({
  active,
  accent,
  icon,
  title,
  desc,
  onPress,
}: {
  active: boolean;
  accent?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}>
      <View style={[styles.optionIcon, accent && styles.optionIconAccent]}>
        <Ionicons name={icon} size={20} color={accent ? '#FFFFFF' : AUTH.sub} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>
    </Pressable>
  );
}

export default function SignupScreen() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const [step, setStep] = useState<Step>('method');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [joinMode, setJoinMode] = useState<JoinMode>('create');
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  // 필드별 인라인 검증 — blur 시점에 그 필드만 (제출 시 전체)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const mark = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const nameErr = touched.name
    ? !name.trim()
      ? '이름을 입력해주세요.'
      : name.trim().length > 20
        ? '이름은 20자 이하로 입력해주세요.'
        : null
    : null;
  const emailErr = touched.email
    ? !email.trim()
      ? '이메일을 입력해주세요.'
      : !EMAIL_REGEX.test(email.trim())
        ? '올바른 이메일 형식이 아닙니다.'
        : null
    : null;
  const pwErr = touched.password && password.length > 0 && password.length < 8 ? '비밀번호는 8자 이상이어야 해요.' : null;
  const confirmErr = touched.confirm && confirm.length > 0 && password !== confirm ? '비밀번호가 일치하지 않습니다.' : null;
  const wsErr =
    touched.workspaceName && joinMode === 'create' && !workspaceName.trim() ? '워크스페이스 이름을 입력해주세요.' : null;
  const inviteErr = touched.inviteCode && joinMode === 'invite' && !inviteCode.trim() ? '초대코드를 입력해주세요.' : null;

  const accountValid =
    !!name.trim() &&
    name.trim().length <= 20 &&
    EMAIL_REGEX.test(email.trim()) &&
    password.length >= 8 &&
    password === confirm;

  const stepIndex = step === 'method' ? 1 : step === 'account' ? 2 : 3;

  /** back 규칙 — 웹과 동일: method→로그인, account→method, workspace→account */
  const onBack = () => {
    setError(null);
    if (step === 'method') {
      if (router.canGoBack()) router.back();
      else router.replace('/(auth)/login');
      return;
    }
    else if (step === 'account') setStep('method');
    else setStep('account');
  };

  const goStep = (next: Step) => {
    setError(null);
    setStep(next);
  };

  /** 마지막 필드 blur — touched 처리만. 자동 진행은 완료 키/다음 버튼에서만
   *  (모바일 blur는 다른 필드 탭만으로도 발생 → 편집 중 화면이 튀는 것 방지) */
  const onConfirmBlur = () => {
    mark('confirm');
  };

  /** 다음 버튼/완료 키 — 전체 touched 처리 후 진행 (웹 goAccountNext 미러) */
  const advanceToWorkspace = () => {
    setTouched((t) => ({ ...t, name: true, email: true, password: true, confirm: true }));
    if (accountValid) goStep('workspace');
  };

  /** 소셜 가입 — Apple Sign In은 첫 로그인 시 자동 가입이라 로그인과 동일 흐름 재사용 */
  const onApple = async () => {
    setError(null);
    setBusy('apple');
    try {
      const res = await startAppleLogin();
      if (res?.accessToken) {
        await signIn(res.accessToken, { id: res.id, name: res.name, email: res.email });
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onKakao = async () => {
    setError(null);
    setBusy('kakao');
    try {
      const result = await startSocialLogin('kakao');
      if (result) await signIn(result.token);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = async () => {
    if (joinMode === 'create' && !workspaceName.trim()) {
      mark('workspaceName');
      setError('워크스페이스 이름을 입력해주세요.');
      return;
    }
    if (joinMode === 'invite' && !inviteCode.trim()) {
      mark('inviteCode');
      setError('초대코드를 입력해주세요.');
      return;
    }
    setError(null);
    setBusy('submit');
    try {
      const res = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        // 나중에 하기 → 둘 다 생략 (백엔드가 기본 워크스페이스 처리)
        ...(joinMode === 'create'
          ? { workspaceName: workspaceName.trim() }
          : joinMode === 'invite'
            ? { inviteCode: inviteCode.trim() }
            : {}),
      });
      if (!res.accessToken) throw new Error('회원가입에 실패했습니다.');
      await signIn(res.accessToken, { id: res.id, name: res.name, email: res.email });
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* 로그인과 동일한 웹 auth 그라데이션(라이트 고정) + 흰 카드 */}
      <AuthBackground />
      <StatusBar style="dark" />

      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <AuthBackButton onPress={onBack} />
              <StepProgress current={stepIndex} />

              {/* 단계별 제목 — 웹 문구 미러 */}
              {step === 'method' ? (
                <>
                  <Text style={styles.title}>시작해볼까요?</Text>
                  <Text style={styles.subtitle}>가입 방법을 선택해주세요</Text>
                </>
              ) : step === 'account' ? (
                <>
                  <Text style={styles.title}>계정 정보</Text>
                  <Text style={styles.subtitle}>이름, 이메일, 비밀번호를 입력해주세요</Text>
                </>
              ) : (
                <>
                  <Text style={styles.title}>환영해요{name.trim() ? `, ${name.trim()}님` : ''}!</Text>
                  <Text style={styles.subtitle}>마지막으로 워크스페이스를 설정해볼까요?</Text>
                </>
              )}

              {error ? <AuthErrorBanner message={error} /> : null}

              {/* ── Step 1: 가입 방법 — Apple 최상단(App Store 4.8) → 카카오 → 이메일 ── */}
              {step === 'method' ? (
                <View style={styles.methods}>
                  {Platform.OS === 'ios' ? (
                    <SocialButton brand="apple" note="Apple로 시작하기" onPress={onApple} loading={busy === 'apple'} />
                  ) : null}
                  <SocialButton brand="kakao" note="카카오로 시작하기" onPress={onKakao} loading={busy === 'kakao'} />

                  <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.dividerText}>또는</Text>
                    <View style={styles.line} />
                  </View>

                  <Pressable
                    onPress={() => goStep('account')}
                    style={({ pressed }) => [styles.emailBtn, pressed && styles.pressed]}>
                    <Ionicons name="mail-outline" size={18} color={AUTH.sub} />
                    <Text style={styles.emailBtnText}>이메일로 가입하기</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* ── Step 2: 계정 정보 ── */}
              {step === 'account' ? (
                <View style={styles.form}>
                  <AuthField
                    label="이름"
                    placeholder="다른 멤버에게 보이는 이름"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="none"
                    hint="표시될 이름이에요"
                    error={nameErr}
                    onBlur={() => mark('name')}
                  />
                  <AuthField
                    label="이메일"
                    placeholder="example@email.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    error={emailErr}
                    onBlur={() => mark('email')}
                  />
                  <AuthField
                    label="비밀번호"
                    placeholder="8자 이상"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="newPassword"
                    hint="8자 이상 입력해주세요"
                    error={pwErr}
                    onBlur={() => mark('password')}
                  />
                  <AuthField
                    label="비밀번호 확인"
                    placeholder="한 번 더 입력"
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry
                    textContentType="newPassword"
                    error={confirmErr}
                    // 마지막 필드 — 검증 전체 통과 시 자동으로 다음 단계 (웹 미러)
                    onBlur={onConfirmBlur}
                    onSubmitEditing={advanceToWorkspace}
                  />

                  <AuthButton title="다음" disabled={!accountValid} onPress={advanceToWorkspace} style={styles.cta} />
                </View>
              ) : null}

              {/* ── Step 3: 워크스페이스 옵션 (만들기 / 초대코드 / 나중에) ── */}
              {step === 'workspace' ? (
                <View style={styles.options}>
                  <WorkspaceOption
                    active={joinMode === 'create'}
                    accent
                    icon="person-add"
                    title="새 워크스페이스 만들기"
                    desc="나와 팀의 공간을 새로 만들어요"
                    onPress={() => setJoinMode('create')}
                  />
                  {joinMode === 'create' ? (
                    <AuthField
                      label="워크스페이스 이름"
                      placeholder="팀 이름을 입력하세요"
                      value={workspaceName}
                      onChangeText={setWorkspaceName}
                      hint="추후 변경 가능합니다"
                      error={wsErr}
                      onBlur={() => mark('workspaceName')}
                    />
                  ) : null}

                  <WorkspaceOption
                    active={joinMode === 'invite'}
                    icon="mail-unread-outline"
                    title="초대코드로 참여"
                    desc="기존 팀에 합류해요"
                    onPress={() => setJoinMode('invite')}
                  />
                  {joinMode === 'invite' ? (
                    <AuthField
                      label="초대코드"
                      placeholder="예: ABCD2345"
                      value={inviteCode}
                      onChangeText={setInviteCode}
                      autoCapitalize="characters"
                      hint="팀원에게 받은 초대코드를 입력하세요"
                      error={inviteErr}
                      onBlur={() => mark('inviteCode')}
                    />
                  ) : null}

                  <WorkspaceOption
                    active={joinMode === 'later'}
                    icon="time-outline"
                    title="나중에 설정할게요"
                    desc="건너뛰면 자동으로 워크스페이스가 생성되며, 추후 이름을 변경할 수 있어요"
                    onPress={() => setJoinMode('later')}
                  />

                  <AuthButton title="가입하기" loading={busy === 'submit'} onPress={onSubmit} style={styles.cta} />
                </View>
              ) : null}

              {/* 푸터 — 웹 register '이미 계정이 있나요? 로그인' 미러 (method 단계에서만) */}
              {step === 'method' ? (
                <View style={styles.footer}>
                  <Text style={styles.footerText}>이미 계정이 있나요?</Text>
                  <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))} hitSlop={8}>
                    <Text style={styles.footerLink}>로그인</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
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
  card: {
    flexGrow: 1,
    backgroundColor: AUTH.card,
    borderRadius: 22,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  // ── progress ──
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 20 },
  progressSeg: { flex: 1, height: 4, borderRadius: 999, backgroundColor: '#CBD5E1' },
  progressSegActive: { backgroundColor: AUTH.primary },

  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.44, color: AUTH.text },
  subtitle: { fontSize: 13, lineHeight: 19, color: AUTH.sub, marginTop: 4, marginBottom: 20 },

  // ── method step ──
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

  // ── account step ──
  form: { gap: 12 },
  cta: { marginTop: 8 },

  // ── workspace step ──
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: AUTH.divider,
    backgroundColor: AUTH.card,
  },
  optionActive: { borderColor: AUTH.primary, backgroundColor: 'rgba(27,111,245,0.05)' },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: AUTH.backCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconAccent: { backgroundColor: AUTH.primary },
  optionTitle: { fontSize: 14, fontWeight: '700', color: AUTH.text, marginBottom: 2 },
  optionDesc: { fontSize: 11.5, lineHeight: 16, color: AUTH.sub },

  // ── footer ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 'auto',
    paddingTop: 20,
  },
  footerText: { fontSize: 12.5, color: AUTH.sub },
  footerLink: { fontSize: 12.5, fontWeight: '700', color: AUTH.primary },
});
