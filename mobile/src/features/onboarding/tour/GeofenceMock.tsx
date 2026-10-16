import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { radius, space, type } from '@/shared/ui/tokens';

import { DashedConnector, MockFrame, MockText } from './MockPrimitives';
import { CURTAIN, OUT_CUBIC, at, sample, step, track } from './timeline';
import { useTourTokens } from './tourTokens';

/**
 * 슬라이드 3 목업 — 위치·알림 권한이 "실제로 무엇을 사주는가" 한 장면.
 *
 * 추상화된 지도 위에 (1) 할 일 장소 핀 → (2) 반경 링(RADIUS_OPTIONS 기본값 500m) →
 * (3) 링 안으로 걸어 들어오는 사용자 점 → (4) 그 진입이 띄우는 iOS 로컬 알림 배너.
 * 배너 카피는 `src/features/map/checkin.ts`의 도착 체크인 알림과 **문자 그대로** 같다
 * (title `📍 도착했어요 (장소)` / body `'제목' — 지금 시작할까요?` / 액션 `▶ 지금 시작`·`나중에`).
 *
 * 규칙 (doc/onboarding-tour-plan.md §0·§2·§6)
 * - 모션은 전부 UI 스레드: clock 하나를 각 요소가 interpolate로 잘라 쓴다. JS 리렌더 0회.
 * - 반경 링은 SVG Circle이 아니라 **일반 View(borderRadius 999) + scale** — 애니메이션되는
 *   SVG prop은 Fabric에서 회귀 이력이 있다(§6.8). SVG는 정적 벡터(점선 커넥터)에만 쓴다.
 * - 레이아웃 애니메이션 금지. transform/opacity만. 모든 좌표는 컴파일 타임 상수(측정 금지).
 * - 색은 useTourTokens()에서만. 하드코딩 hex/rgba 0개.
 * - 애니메이션 노드(useAnimatedStyle) 12개 — 예산 15개 이내(§6.5).
 */

// ── 고정 기하 (전부 컴파일 타임 상수) ──────────────────
const MOCK_H = 260;

/** 반경 링 — 지름 / 프레임 가로중앙 기준 오프셋 / 프레임 상단 기준 중심 y */
const RING = 112;
const RING_R = RING / 2;
const RING_DX = -30;
const RING_CY = 170;

const PIN = 26;
const DOT = 14;
const HALO = 36;

/** 사용자 점의 "도착 후" 위치 — 링 중심에서 (-18, +20). 반경 56 안쪽(거리 ≈ 27). */
const DOT_DX = -18;
const DOT_DY = 20;
/** 진입 전 시작 지점(도착 위치 기준 오프셋) — 프레임 우하단 */
const DOT_FROM_X = 104;
const DOT_FROM_Y = 54;

/** 알림 배너: 위 12 + 높이 92. 숨을 때는 프레임 밖으로 완전히 올린다. */
const BANNER_TOP = 12;
const BANNER_H = 92;
const BANNER_HIDDEN_Y = -(BANNER_TOP + BANNER_H + 8);

// ── 타임라인 (cycle = CYCLE.geofence = 6000ms, 정지 = HOLD.geofence = 0.87) ──
// 비트표는 계획서 "슬라이드 3" 표와 1:1 대응한다.
/** 0.05–0.13 핀 낙하 — 바운스를 키프레임에 구워 넣는다(−26 → 0 → −5 → 0) */
const PIN_Y = track([
  [0.0, -26],
  [0.05, -26],
  [0.1, 0],
  [0.115, -5],
  [0.13, 0],
  [1.0, 0],
]);
const PIN_O = track([
  [0.0, 0],
  [0.05, 0],
  [0.07, 1],
  [1.0, 1],
]);
/** 핀 그림자 타원 — 낙하와 함께 눌려 퍼진다 */
const PIN_SHADOW_SX = track([
  [0.0, 0.4],
  [0.05, 0.4],
  [0.1, 1],
  [1.0, 1],
]);
/** 0.24–0.55 이동: 우하단 → 링 안. 4개 경유점(등속 보행감) */
const DOT_X = track([
  [0.0, DOT_FROM_X],
  [0.24, DOT_FROM_X],
  [0.34, 74],
  [0.42, 44],
  [0.5, 14],
  [0.55, 0],
  [1.0, 0],
]);
const DOT_Y = track([
  [0.0, DOT_FROM_Y],
  [0.24, DOT_FROM_Y],
  [0.34, 30],
  [0.42, 16],
  [0.5, 4],
  [0.55, 0],
  [1.0, 0],
]);
const DOT_O = track([
  [0.0, 0],
  [0.2, 0],
  [0.24, 1],
  [1.0, 1],
]);
/** 링 내부 채움 — 진입 순간(0.52–0.57) 한 번 밝아졌다 가라앉는다 */
const RING_FILL_O = track([
  [0.0, 0],
  [0.13, 0],
  [0.24, 0.6],
  [0.52, 0.6],
  [0.57, 1],
  [0.66, 0.8],
  [1.0, 0.8],
]);
/** 진입 트리거 리플 — 본 링과 같은 자리에서 한 번 퍼진다 */
const RIPPLE_S = track([
  [0.0, 1],
  [0.52, 1],
  [0.58, 1.34],
  [1.0, 1.34],
]);
const RIPPLE_O = track([
  [0.0, 0],
  ...step(0.52, 0, 0.55),
  [0.58, 0],
  [1.0, 0],
]);
const PILL_O = track([
  [0.0, 0],
  [0.16, 0],
  [0.24, 1],
  [1.0, 1],
]);

/** 액션 칩 2개 stagger (0.70–0.755 / 0.725–0.78) */
const CHIP_1 = [0.7, 0.755] as const;
const CHIP_2 = [0.725, 0.78] as const;

// ── reduced-motion 정적 어포던스(§3.3): 점선 경로 + 화살촉 ──
/** 사용자 점 시작지점 → 링 안. 박스 원점 = 링 중심 */
const PATH_BOX = { w: 120, h: 90 };
const PATH_D = 'M86 74 C 68 62, 48 44, 32 28';
const PATH_ARROW = '28,24 37,27.3 32.6,32.5';
/** 링 진입 → 알림 배너(인과). 박스 원점 = (가로중앙, 배너 하단) */
const LINK_BOX = { w: 100, h: 36 };
const LINK_D = 'M10 26 C 26 22, 44 14, 62 6';
const LINK_ARROW = '66,3 60,10.4 56.6,4.8';

export function GeofenceMock({ clock, reduced }: { clock: SharedValue<number>; reduced: boolean }) {
  const k = useTourTokens();

  /** 정확도 헤일로 — 시계와 무관한 앰비언트 펄스(§2.4). reduced면 마운트하지 않는다. */
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 1600,
        easing: Easing.inOut(Easing.quad),
        // 기본값 System이면 OS 모션 줄이기에서 무한 반복이 폭주한다(§6.9)
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);

  // ── 애니메이션 노드 12개 ──────────────────────────────
  // 1. 커튼 — 랩어라운드 이음매를 덮는다(캔버스는 덮지 않는다: 배경이 깜빡이면 안 된다)
  const curtainStyle = useAnimatedStyle(() => ({ opacity: sample(clock.value, CURTAIN) }));

  // 2. 핀 낙하
  const pinStyle = useAnimatedStyle(() => ({
    opacity: sample(clock.value, PIN_O),
    transform: [{ translateY: sample(clock.value, PIN_Y) }],
  }));

  // 3. 핀 그림자 타원
  const pinShadowStyle = useAnimatedStyle(() => {
    const sx = sample(clock.value, PIN_SHADOW_SX);
    return { opacity: at(clock.value, 0.05, 0.1) * 0.9, transform: [{ scaleX: sx }] };
  });

  // 4. 반경 링(테두리) — 0.13–0.24 scale 0.2→1
  const ringStyle = useAnimatedStyle(() => {
    const e = OUT_CUBIC(at(clock.value, 0.13, 0.24));
    return { opacity: e, transform: [{ scale: 0.2 + 0.8 * e }] };
  });

  // 5. 링 내부 채움(진입 팝)
  const ringFillStyle = useAnimatedStyle(() => ({ opacity: sample(clock.value, RING_FILL_O) }));

  // 6. 진입 리플
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: sample(clock.value, RIPPLE_O),
    transform: [{ scale: sample(clock.value, RIPPLE_S) }],
  }));

  // 7. 500m pill
  const pillStyle = useAnimatedStyle(() => ({ opacity: sample(clock.value, PILL_O) }));

  // 8. 사용자 점(경로 이동)
  const dotStyle = useAnimatedStyle(() => ({
    opacity: sample(clock.value, DOT_O),
    transform: [
      { translateX: sample(clock.value, DOT_X) },
      { translateY: sample(clock.value, DOT_Y) },
    ],
  }));

  // 9. 정확도 헤일로(앰비언트)
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.9 - pulse.value * 0.55,
    transform: [{ scale: 1 + pulse.value * 0.32 }],
  }));

  // 10. 알림 배너 — 0.58–0.70 위에서 내려온다
  const bannerStyle = useAnimatedStyle(() => {
    const e = OUT_CUBIC(at(clock.value, 0.58, 0.7));
    return {
      opacity: at(clock.value, 0.58, 0.645),
      transform: [{ translateY: BANNER_HIDDEN_Y * (1 - e) }, { scale: 0.96 + 0.04 * e }],
    };
  });

  // 11·12. 액션 칩 stagger
  const chip1Style = useAnimatedStyle(() => {
    const e = OUT_CUBIC(at(clock.value, CHIP_1[0], CHIP_1[1]));
    return { opacity: e, transform: [{ translateY: 6 * (1 - e) }] };
  });
  const chip2Style = useAnimatedStyle(() => {
    const e = OUT_CUBIC(at(clock.value, CHIP_2[0], CHIP_2[1]));
    return { opacity: e, transform: [{ translateY: 6 * (1 - e) }] };
  });

  return (
    <MockFrame
      k={k}
      label="장소에 도착하면 도착 알림이 오는 예시 화면"
      style={[styles.frame, { backgroundColor: k.canvas }]}>
      {/* 추상 지도 — 정적. 커튼 밖에 두어 배경이 깜빡이지 않게 한다. */}
      <View style={[styles.roadA, { backgroundColor: k.line }]} />
      <View style={[styles.roadB, { backgroundColor: k.line }]} />
      <View style={[styles.roadC, { backgroundColor: k.line }]} />
      <View style={[styles.blockA, { backgroundColor: k.block }]} />
      <View style={[styles.blockB, { backgroundColor: k.block }]} />

      <Animated.View style={[StyleSheet.absoluteFill, curtainStyle]} pointerEvents="none">
        {/* 반경 링 — 일반 View + scale (SVG Circle 금지, §6.8) */}
        <Animated.View style={[styles.ring, { borderColor: k.accent }, ringStyle]}>
          <Animated.View
            style={[styles.ringFill, { backgroundColor: k.accentSoft }, ringFillStyle]}
          />
        </Animated.View>
        <Animated.View style={[styles.ring, { borderColor: k.accent }, rippleStyle]} />

        {/* 핀 + 그림자 타원 */}
        <Animated.View style={[styles.pinShadow, { backgroundColor: k.line }, pinShadowStyle]} />
        <Animated.View style={[styles.pin, pinStyle]}>
          <Ionicons name="location" size={PIN} color={k.accent} />
        </Animated.View>

        {/* 반경 라벨 — map.tsx RADIUS_OPTIONS 기본값 */}
        <Animated.View style={[styles.pillWrap, pillStyle]}>
          <View style={[styles.pill, { backgroundColor: k.frameBg, borderColor: k.frameBorder }]}>
            <MockText style={[styles.pillText, { color: k.accent }]}>500m</MockText>
          </View>
        </Animated.View>

        {/* reduced-motion: 움직임 없이 "여기서 링 안으로 들어온다"를 점선으로 설명(§3.3) */}
        {reduced ? (
          <>
            <View style={styles.pathSvg}>
              <DashedConnector
                color={k.textDim}
                d={PATH_D}
                arrow={PATH_ARROW}
                width={PATH_BOX.w}
                height={PATH_BOX.h}
              />
            </View>
            <View style={styles.linkSvg}>
              <DashedConnector
                color={k.accent}
                d={LINK_D}
                arrow={LINK_ARROW}
                width={LINK_BOX.w}
                height={LINK_BOX.h}
              />
            </View>
          </>
        ) : null}

        {/* 사용자 점 + 정확도 헤일로 */}
        <Animated.View style={[styles.dotWrap, dotStyle]}>
          <Animated.View style={[styles.halo, { backgroundColor: k.accentSoft }, haloStyle]} />
          <View style={[styles.dot, { backgroundColor: k.accent, borderColor: k.frameBg }]} />
        </Animated.View>

        {/* 도착 체크인 알림 — 카피는 checkin.ts와 문자 그대로 일치 */}
        <Animated.View
          style={[
            styles.banner,
            { backgroundColor: k.row, borderColor: k.frameBorder },
            k.frameShadow,
            bannerStyle,
          ]}>
          <View style={styles.bannerHead}>
            <View style={[styles.bannerIcon, { backgroundColor: k.accentSoft }]}>
              <Ionicons name="location" size={16} color={k.accent} />
            </View>
            <View style={styles.bannerText}>
              <MockText numberOfLines={1} style={[styles.bannerTitle, { color: k.text }]}>
                📍 도착했어요 (강남역)
              </MockText>
              <MockText numberOfLines={1} style={[styles.bannerBody, { color: k.textSub }]}>
                &apos;거래처 미팅&apos; — 지금 시작할까요?
              </MockText>
            </View>
          </View>
          <View style={styles.bannerActions}>
            <Animated.View
              style={[styles.chip, { backgroundColor: k.accent }, chip1Style]}>
              <MockText style={[styles.chipText, { color: k.onAccent }]}>▶ 지금 시작</MockText>
            </Animated.View>
            <Animated.View
              style={[styles.chip, { backgroundColor: k.rowPressed }, chip2Style]}>
              <MockText style={[styles.chipText, { color: k.textSub }]}>나중에</MockText>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </MockFrame>
  );
}

const styles = StyleSheet.create({
  frame: { height: MOCK_H, width: '100%' },

  // 추상 도로 — 얇은 바를 회전시킨 것(§슬라이드 3 목업)
  roadA: { position: 'absolute', left: -30, right: -30, top: 128, height: 9, transform: [{ rotate: '-9deg' }] },
  roadB: { position: 'absolute', left: -30, right: -30, top: 214, height: 7, transform: [{ rotate: '6deg' }] },
  roadC: { position: 'absolute', top: -20, bottom: -20, left: '70%', width: 8, transform: [{ rotate: '9deg' }] },
  blockA: { position: 'absolute', left: 8, top: 118, width: 48, height: 40, borderRadius: radius.sm },
  blockB: { position: 'absolute', right: 18, top: 128, width: 62, height: 50, borderRadius: radius.sm },

  ring: {
    position: 'absolute',
    left: '50%',
    marginLeft: RING_DX - RING_R,
    top: RING_CY - RING_R,
    width: RING,
    height: RING,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  ringFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999 },

  pin: {
    position: 'absolute',
    left: '50%',
    marginLeft: RING_DX - PIN / 2,
    top: RING_CY - PIN - 2,
    width: PIN,
    height: PIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinShadow: {
    position: 'absolute',
    left: '50%',
    marginLeft: RING_DX - 9,
    top: RING_CY - 2,
    width: 18,
    height: 5,
    borderRadius: 999,
  },

  pillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: RING_CY + RING_R + 6,
    alignItems: 'center',
    transform: [{ translateX: RING_DX }],
  },
  // 치수 출처: MockPrimitives styles.pill (paddingHorizontal 7 / borderRadius 6)
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: { ...type.caption, fontWeight: '700' },

  dotWrap: {
    position: 'absolute',
    left: '50%',
    marginLeft: RING_DX + DOT_DX - DOT / 2,
    top: RING_CY + DOT_DY - DOT / 2,
    width: DOT,
    height: DOT,
  },
  halo: {
    position: 'absolute',
    left: (DOT - HALO) / 2,
    top: (DOT - HALO) / 2,
    width: HALO,
    height: HALO,
    borderRadius: 999,
  },
  dot: { width: DOT, height: DOT, borderRadius: 999, borderWidth: 2.5 },

  // 점선 경로 박스 — 원점을 링 중심 / 배너 하단에 고정(좌표는 전부 상수)
  pathSvg: { position: 'absolute', left: '50%', marginLeft: RING_DX, top: RING_CY },
  linkSvg: { position: 'absolute', left: '50%', top: BANNER_TOP + BANNER_H },

  banner: {
    position: 'absolute',
    left: space[3],
    right: space[3],
    top: BANNER_TOP,
    height: BANNER_H,
    padding: space[3],
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerHead: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  bannerIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1, minWidth: 0 },
  bannerTitle: { ...type.caption, fontWeight: '700' },
  bannerBody: { ...type.caption },
  bannerActions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
    marginLeft: 30 + space[2],
  },
  chip: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...type.caption, fontWeight: '700' },
});
