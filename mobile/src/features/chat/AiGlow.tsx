import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * AI 화면 배경의 은은한 빛.
 *
 * [고쳐 온 과정] 처음엔 반투명 원 View 를 여러 겹 포개 블러를 흉내 냈다. RN 에 CSS blur 가
 * 없으니 그럴싸해 보였지만, **동심원 경계가 그대로 링으로 보였다.** 그 전에는 BlurView 를
 * 덮었는데 이번엔 블러 뷰 자체가 사각형이라 카드 모서리처럼 보였다. 둘 다 "경계를 감추는"
 * 접근이라 실패했다.
 *
 * 지금은 경계를 아예 만들지 않는다 — **화면보다 큰 사각형을 방사형 그라데이션으로 칠하고
 * 가장자리를 화면 밖으로 내보낸다.** 어디서 시작해 어디서 끝나는지 짚을 수 있으면 실패다.
 *
 * 스톱을 4개 두고 중간을 45% 에 둔 이유: 선형으로 떨어뜨리면 가장자리에 링이 남고,
 * 스톱이 셋 이하면 밴딩이 보인다.
 */

/** 빛의 중심을 카드보다 위에 둔다 — 글자 뒤에 깔리면 대비를 깎는다. */
const CY = '34%';

export function AiGlow({ accent }: { accent: string }) {
  const theme = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const breath = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduceMotion, breath]);

  /* 눈에 띄면 실패다. "있는지 없는지 애매한" 정도만 움직인다. */
  const breathing = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.06 }],
    opacity: 0.85 + breath.value * 0.15,
  }));

  /* 화면 전체로 퍼지니 같은 알파도 훨씬 옅게 읽힌다 — 시연 영역만 덮던 때보다 올렸다.
     라이트를 다크의 60% 로 낮췄더니 아예 보이지 않아서, 흰 바탕에서도 읽히는 선까지만
     올린다. 여전히 "있는지 없는지 애매한" 쪽에 둔다. */
  const peak = theme.isDark ? 0.2 : 0.16;

  return (
    <Animated.View style={[styles.layer, breathing]} pointerEvents="none">
      {/* 역할이 바뀌면 색이 튀지 않게 300ms 겹쳐 넘긴다(옛 층은 사라지고 새 층이 떠오른다) */}
      <Animated.View
        key={accent}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="aiGlow" cx="50%" cy={CY} r="72%">
              <Stop offset="0%" stopColor={accent} stopOpacity={peak} />
              <Stop offset="45%" stopColor={accent} stopOpacity={peak * 0.44} />
              <Stop offset="75%" stopColor={accent} stopOpacity={peak * 0.13} />
              <Stop offset="100%" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#aiGlow)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* **화면 전체**를 덮는다.
     [고치는 결함] 처음엔 시연 영역 안에 두고 음수 여백으로 밖으로 밀었는데, 그 영역이
     FlatList 안이라 리스트 경계에서 싹둑 잘렸다 — 헤더 밑에 가로줄 하나가 그어진 것처럼
     보인 게 그 잘린 자리다. 화면을 다 덮으면 그라데이션이 스스로 0 이 될 때까지 갈 곳이
     있어서 잘릴 데가 없다. */
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
