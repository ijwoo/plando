import type { StyleProp, ViewStyle } from 'react-native';

import { Button } from '@/shared/ui/Button';

/**
 * 호환 alias — 기존 사용처용. 신규 코드는 `Button`을 직접 사용.
 * 'primary'(채움) / 'glass'(iOS Liquid Glass).
 */
export function GlassButton({
  title,
  onPress,
  style,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'glass';
  disabled?: boolean;
  loading?: boolean;
}) {
  return <Button title={title} onPress={onPress} style={style} variant={variant} disabled={disabled} loading={loading} />;
}
