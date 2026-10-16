import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { radius } from '@/shared/ui/tokens';

/**
 * 입력 필드 — plando input 토큰(은은한 배경 + 테두리)으로 surface 위에서도 또렷하게.
 * label: 값이 들어와도 맥락이 사라지지 않는 상단 고정 라벨.
 * error: 필드별 인라인 검증 메시지(빨간 테두리 + 한 줄) — 폼 상단 몰아넣기 대신 필드 옆에서 바로.
 */
export function TextField({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  const theme = useTheme();
  const input = (
    <TextInput
      placeholderTextColor={theme.textTertiary}
      {...props}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.inputBg, borderColor: error ? theme.danger : theme.inputBorder },
        error ? styles.errorBorder : null,
        props.style,
      ]}
    />
  );
  if (!label && !error) return input;
  return (
    <View style={styles.wrap}>
      {label ? (
        <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      ) : null}
      {input}
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  label: { fontWeight: '600', marginLeft: 2 },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  errorBorder: { borderWidth: 1 },
});
