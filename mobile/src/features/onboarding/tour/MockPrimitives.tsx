import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';

import { radius, type } from '@/shared/ui/tokens';

import type { TourTokens } from './tourTokens';

/**
 * 목업 공통 부품.
 *
 * 목업은 실제 컴포넌트(TaskListRow / AiCaptureCard)를 재사용하지 않는다 — 실컴포넌트는
 * 쿼리·제스처·데이터에 묶여 있고, 목업은 순수 표현이어야 한다. 대신 **치수는 원본을 그대로
 * 베끼고** 출처를 주석에 남긴다(수치가 어긋나면 "앱 화면 조각"이라는 인상이 깨진다).
 *
 * 규칙
 * - 모든 색은 TourTokens에서만. 하드코딩 hex 금지.
 * - 목업 안 마이크로 카피는 allowFontScaling={false} — 기기 글자 크기 최대에서 레이아웃이
 *   무너지는 걸 막는다. (슬라이드 본문 카피는 스케일 가능하게 유지 — 접근성 회귀 금지)
 * - 내부는 애니메이션 노드를 아끼기 위해 되도록 평범한 View로 둔다.
 */

/** 목업 안에서만 쓰는 고정 글자 — 접근성 스케일에서 제외 */
export function MockText({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text allowFontScaling={false} numberOfLines={numberOfLines} style={style}>
      {children}
    </Text>
  );
}

/**
 * 목업 바깥 틀 — "앱 화면의 한 조각"으로 보이게 하는 프레임.
 * 장식이므로 스크린리더에는 라벨 하나로만 노출하고 내부는 통째로 감춘다.
 */
export function MockFrame({
  k,
  label,
  style,
  children,
}: {
  k: TourTokens;
  label: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.frame,
        { backgroundColor: k.frameBg, borderColor: k.frameBorder },
        k.frameShadow,
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * 목업 안 리스트 행 — 치수 출처: src/features/todo/TaskListRow.tsx styles.row
 * (paddingVertical 14 / paddingHorizontal 18 / gap 12). 목업은 세로를 조금 줄여 쓴다.
 */
export const MOCK_ROW_H = 56;

export function MockRow({
  k,
  style,
  children,
}: {
  k: TourTokens;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.row, { height: MOCK_ROW_H, backgroundColor: k.row }, style]}>
      {children}
    </View>
  );
}

/** 상태 점 — TaskListRow의 상태 dot과 같은 크기(8) */
export function MockDot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: color }} />;
}

/**
 * 우선순위/메타 pill — 치수 출처: TaskListRow styles.pill
 * (paddingHorizontal 7 / paddingVertical 2 / borderRadius 6, 글자 11/700)
 */
export function MockPill({
  bg,
  color,
  children,
}: {
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <MockText style={[styles.pillText, { color }]}>{children}</MockText>
    </View>
  );
}

/** 글자 없는 자리표시 막대 — 목업에서 "본문이 있다"만 표현할 때 */
export function MockBar({
  k,
  w,
  h = 6,
  dim = false,
}: {
  k: TourTokens;
  w: number | `${number}%`;
  h?: number;
  dim?: boolean;
}) {
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: 999,
        backgroundColor: dim ? k.line : k.block,
      }}
    />
  );
}

/**
 * 그림자 판 — 들어올림 표현용.
 * iOS shadowOpacity는 애니메이션되지만 Android elevation은 품질이 나쁘고 solid 배경을 요구한다.
 * 그래서 그림자를 직접 애니메이션하지 않고, 그림자를 가진 판을 깔아 **판의 opacity만** 움직인다.
 * (웹 투어의 LiftShadow와 같은 수법)
 */
export function LiftShadowPlate({
  k,
  style,
  animatedStyle,
}: {
  k: TourTokens;
  style?: StyleProp<ViewStyle>;
  animatedStyle: StyleProp<ViewStyle>;
}) {
  if (k.theme.isDark) return null; // 다크에선 그림자가 안 보인다 — 노드 낭비
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius.md, backgroundColor: k.frameBg },
        k.frameShadow,
        style,
        animatedStyle,
      ]}
    />
  );
}

/**
 * 점선 커넥터 + 화살촉 (정적 SVG).
 * borderStyle:'dashed'는 Android에서 borderRadius와 함께 실선으로 렌더되므로 점선은 전부 SVG로 그린다.
 * reduced-motion에서 "여기서 저기로 이동한다"를 움직임 없이 설명하는 용도.
 */
export function DashedConnector({
  color,
  d,
  arrow,
  width,
  height,
}: {
  color: string;
  /** SVG path 커맨드 */
  d: string;
  /** 화살촉 꼭짓점 3개 "x,y x,y x,y" */
  arrow?: string;
  width: number;
  height: number;
}) {
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path d={d} stroke={color} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
      {arrow ? <Polygon points={arrow} fill={color} /> : null}
    </Svg>
  );
}

/** reduced-motion에서 제스처를 글로 설명하는 칩 */
export function HintChip({ k, children }: { k: TourTokens; children: React.ReactNode }) {
  return (
    <View style={[styles.hintChip, { backgroundColor: k.frameBg, borderColor: k.accent }]}>
      <MockText style={[styles.hintText, { color: k.accent }]}>{children}</MockText>
    </View>
  );
}

/**
 * 손가락 인디케이터 — 제스처 데모에서 접촉점을 보여주는 반투명 원.
 * 실제 손가락 그림 대신 iOS 터치 하이라이트를 닮은 링으로(문화·피부톤 중립).
 */
export function FingerHint({ k, size = 26 }: { k: TourTokens; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: k.accentSoft,
        borderWidth: 1.5,
        borderColor: k.accent,
      }}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillText: { fontSize: 11, fontWeight: '700' },
  hintChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hintText: { ...type.caption, fontWeight: '700' },
});
