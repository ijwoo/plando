import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type as scale } from '@/shared/ui/tokens';

/**
 * 텍스트 primitive — plando 타입 스케일(tokens.type) 기반.
 * 신규: display/title1/title2/title3/body/label/caption/num/numLg (정밀 제어용).
 * 레거시 별칭(default/small/smallBold/subtitle/title/link/code)은 기존 화면 호환을 위해
 * 유지하되 값은 plando 스케일로 매핑.
 */
export type ThemedTextType =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'body'
  | 'label'
  | 'caption'
  | 'num'
  | 'numLg'
  // 레거시 별칭
  | 'default'
  | 'title'
  | 'subtitle'
  | 'small'
  | 'smallBold'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

const TYPE: Record<ThemedTextType, TextStyle> = {
  // plando 정밀 스케일
  display: scale.display,
  title1: scale.title1,
  title2: scale.title2,
  title3: scale.title3,
  body: scale.body,
  label: scale.label,
  caption: scale.caption,
  num: scale.num,
  numLg: scale.numLg,
  // 레거시 별칭 → plando 매핑
  default: scale.body,
  title: scale.display,
  subtitle: scale.title1,
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500', letterSpacing: 0 },
  smallBold: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0 },
  link: { fontSize: 15, lineHeight: 22, fontWeight: '600', letterSpacing: -0.15 },
  linkPrimary: { fontSize: 15, lineHeight: 22, fontWeight: '600', letterSpacing: -0.15 },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 13,
    lineHeight: 18,
  },
};

// 기본 색이 텍스트색이 아닌(=브랜드색) 타입
const PRIMARY_TYPES = new Set<ThemedTextType>(['link', 'linkPrimary']);

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = themeColor
    ? theme[themeColor]
    : PRIMARY_TYPES.has(type)
      ? theme.primary
      : theme.text;

  return <Text style={[{ color }, TYPE[type], style]} {...rest} />;
}
