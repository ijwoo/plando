import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type SocialBrand } from './BrandIcon';

type Brand = SocialBrand;

/**
 * 소셜 로그인 버튼 — 웹 LoginPageMobile의 버튼 스펙 미러
 * (h 50 / radius 14 / 14.5pt·700). Google은 웹에 없는 네이티브 전용이라
 * 웹 '이메일로 로그인' 버튼과 같은 흰 배경 + #E2E8F0 보더 계열로 맞춘다.
 */
const BRAND: Record<Brand, { bg: string; fg: string; border?: string; label: string }> = {
  apple: { bg: '#000000', fg: '#FFFFFF', label: 'Apple로 로그인' },
  kakao: { bg: '#FEE500', fg: '#181600', label: '카카오로 로그인' },
  google: { bg: '#FFFFFF', fg: '#1F1F1F', border: '#E2E8F0', label: 'Google로 로그인' },
};

export function SocialButton({
  brand,
  onPress,
  loading,
  disabled,
  note,
}: {
  brand: Brand;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  note?: string;
}) {
  const c = BRAND[brand];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        c.border ? styles.bordered : null,
        { backgroundColor: c.bg, borderColor: c.border ?? c.bg },
        (pressed || disabled || loading) && styles.dim,
      ]}>
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={styles.row}>
          <BrandIcon brand={brand} size={18} />
          <Text style={[styles.label, { color: c.fg }]}>{note ?? c.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bordered: { borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dim: { opacity: 0.6 },
  label: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.15 },
});
