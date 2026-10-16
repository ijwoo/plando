import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

/**
 * Auth 화면 전용 라이트 고정 프리미티브 — 웹 LoginPageMobile/RegisterPageMobile 미러.
 * Auth 배경(밝은 그라데이션)은 다크 대응이 없는 자체 완결 색이므로, 테마 훅 대신
 * 웹에서 추출한 고정 hex를 쓴다 (온보딩 WelcomeFlow와 같은 접근).
 */
export const AUTH = {
  bgTop: '#F4F7FC', // 페이지 그라데이션 시작
  bgBottom: '#EAF1FB', // 페이지 그라데이션 끝
  card: '#FFFFFF', // 흰 카드 / 인풋 배경
  text: '#0F172A', // 타이틀·본문
  sub: '#64748B', // 보조 텍스트
  faint: '#94A3B8', // 흐린 텍스트 (divider 라벨 등)
  divider: '#E2E8F0', // 라인·보더
  inputBorder: '#CBD5E1', // 인풋 아웃라인
  primary: '#1B6FF5', // 브랜드 블루 (CTA)
  danger: '#DC2626',
  backCircle: '#F1F5F9', // 뒤로가기 원형 버튼
} as const;

/** 흰 박스 인풋 — 웹 inputSxWhite(흰 배경 + 아웃라인) 미러. label 상단 고정 + 인라인 error/hint. */
export function AuthField({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={AUTH.faint}
        {...props}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** 브랜드 블루 CTA — 웹 primary 버튼(#1B6FF5, radius 14, h 50) 미러. */
export function AuthButton({
  title,
  onPress,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        (disabled || loading) && styles.buttonDim,
        pressed && styles.buttonPressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonLabel}>{title}</Text>
      )}
    </Pressable>
  );
}

/** 원형 뒤로가기 — 웹 카드 헤더의 36px 원형 back 버튼 미러. */
export function AuthBackButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      style={({ pressed }) => [styles.back, pressed && styles.buttonDim]}>
      <Ionicons name="arrow-back" size={20} color={AUTH.text} />
    </Pressable>
  );
}

/** 에러 배너 — 웹 MUI Alert(severity=error) 톤 미러. */
export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginLeft: 2 },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AUTH.inputBorder,
    backgroundColor: AUTH.card,
    paddingHorizontal: 16,
    fontSize: 15,
    color: AUTH.text,
  },
  inputError: { borderColor: AUTH.danger, borderWidth: 1.5 },
  fieldError: { fontSize: 12, color: AUTH.danger, marginLeft: 2 },
  fieldHint: { fontSize: 12, color: AUTH.faint, marginLeft: 2 },
  button: {
    height: 50,
    borderRadius: 14,
    backgroundColor: AUTH.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonDim: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { fontSize: 15, fontWeight: '800', letterSpacing: -0.15, color: '#FFFFFF' },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AUTH.backCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: '#FDEDED',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  errorText: { fontSize: 13, lineHeight: 18, color: '#B91C1C' },
});
