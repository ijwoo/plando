import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { radius } from '@/shared/ui/tokens';

export type ButtonVariant = 'primary' | 'glass' | 'tonal' | 'plain' | 'destructive';

/**
 * 공용 버튼. variant: primary(채움)·glass(Liquid Glass)·tonal(은은한 배경)·plain(텍스트)·destructive(빨강).
 * 폼 CTA·링크·삭제 등 앱 전반의 버튼을 이걸로 통일.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  leftIcon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  disabled?: boolean;
  /** 진행 중 — 스피너 표시 + 터치 비활성 ("…중" 텍스트 패턴 대체) */
  loading?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const fill = size === 'sm' ? styles.fillSm : styles.fill;

  // glass: iOS Liquid Glass (가능할 때만), 그 외 tonal로 폴백
  if (variant === 'glass' && isLiquidGlassAvailable()) {
    return (
      <GlassView style={[styles.base, styles.glassMorph, style]} glassEffectStyle="regular" isInteractive>
        <Pressable onPress={onPress} disabled={disabled || loading} style={fill}>
          <Content title={title} color={theme.text} leftIcon={leftIcon} loading={loading} />
        </Pressable>
      </GlassView>
    );
  }

  const bg =
    variant === 'primary' ? theme.primary : variant === 'tonal' ? theme.backgroundElement : 'transparent';
  const fg =
    variant === 'primary' ? '#FFFFFF' : variant === 'destructive' ? theme.danger : variant === 'plain' ? theme.primary : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        fill,
        { backgroundColor: bg },
        (pressed || disabled || loading) && styles.pressed,
        style,
      ]}>
      <Content title={title} color={fg} leftIcon={leftIcon} loading={loading} />
    </Pressable>
  );
}

function Content({ title, color, leftIcon, loading }: { title: string; color: string; leftIcon?: keyof typeof Ionicons.glyphMap; loading?: boolean }) {
  return (
    <View style={styles.content}>
      {loading ? <ActivityIndicator size="small" color={color} /> : null}
      {!loading && leftIcon ? <Ionicons name={leftIcon} size={18} color={color} /> : null}
      <ThemedText type="body" style={[styles.label, { color }]}>
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, overflow: 'hidden' },
  glassMorph: { overflow: 'visible' },
  fill: { paddingVertical: 15, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  fillSm: { paddingVertical: 9, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.85 },
  label: { fontWeight: '600' },
});
