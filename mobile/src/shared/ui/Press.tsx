import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { tickHaptic } from '@/shared/ui/haptics';

/**
 * 공용 프레스 래퍼 — 웹 Press primitive 미러(scale 0.97 + 라이트 햅틱).
 * 앱 전역의 터치 피드백을 통일한다. 눌림 배경이 필요한 곳은 pressedStyle로.
 */
export function Press({
  children,
  style,
  pressedStyle,
  haptic = true,
  scale = 0.97,
  onPress,
  ...rest
}: PressableProps & {
  style?: StyleProp<ViewStyle>;
  /** 눌림 상태에서 병합할 추가 스타일 (배경 등) */
  pressedStyle?: StyleProp<ViewStyle>;
  /** 라이트 햅틱 (기본 on) */
  haptic?: boolean;
  /** 눌림 스케일 (1이면 스케일 없음) */
  scale?: number;
}) {
  return (
    <Pressable
      {...rest}
      // 햅틱은 release(onPress) 시점 — press-in에 걸면 Android에서 스크롤 시작 터치에도 틱이 울린다
      onPress={(e) => {
        if (haptic) tickHaptic();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        style,
        pressed && scale !== 1 ? { transform: [{ scale }] } : null,
        pressed ? pressedStyle : null,
      ]}>
      {children}
    </Pressable>
  );
}
