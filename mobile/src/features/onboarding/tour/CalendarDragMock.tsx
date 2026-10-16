import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  SnappySpringConfig,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { tickHaptic } from '@/shared/ui/haptics';
import { type } from '@/shared/ui/tokens';

import {
  DashedConnector,
  FingerHint,
  HintChip,
  LiftShadowPlate,
  MockFrame,
  MockText,
} from './MockPrimitives';
import { at, CURTAIN, OUT_CUBIC, sample, step, track } from './timeline';
import { useTourTokens, type TourTokens } from './tourTokens';

/**
 * 슬라이드 목업 — "빈 칸을 길게 눌러 끌면 그 시간으로 일정이 생긴다".
 *
 * 무엇을 그리는가: `src/features/calendar/WeekTimeline.tsx`의 **생성 모드** 제스처다.
 * (WeekTimeline:178-180 `Gesture.Pan().activateAfterLongPress(350)` → :205-216 빈 격자에서
 *  시작하면 생성 모드로 30분짜리 미리보기가 뜨고 `tickHaptic()`이 울린다 → :233-242 아래로
 *  끌면 `Math.round(e.y / SNAP) * SNAP`으로 **30분 스냅**된 시간 범위가 벌어지고 거터에 시작·종료
 *  시간 태그가 붙는다 → :248 놓으면 `onCreateSlot(day, start, end)`.)
 * 기존 블록 위에서 시작하는 **이동 모드**(:189-203)는 그리지 않는다 — 한 장면에 제스처 둘은 안 읽힌다.
 *
 * 기하는 실물을 그대로 베꼈다 (출처: WeekTimeline)
 *   - `HOUR_H 56` / `SNAP 28`(=HOUR_H/2, 30분) / `GUTTER 46`          :15-17
 *   - 시간 라벨  `left 6 / top -7 / fontSize 11`, 색 textSecondary     :339-341, :443
 *   - 시간 격자  `borderTopWidth hairline`, 세로선 hairline, 색 divider :338, :380, :446
 *   - 이벤트 블록 `borderRadius 6 / borderLeftWidth 3 / paddingH 4 / paddingV 2`,
 *                제목 `fontSize 11 / 600`                              :447-448
 *   - 거터 시간 태그 `left 2 / paddingH 2 / fontSize 11 / 800`          :361-369, :444
 *
 * 구조 규칙 (doc/onboarding-tour-plan.md §0·§2·§6)
 * - 모션은 전부 UI 스레드: clock 하나를 각 요소가 interpolate로 잘라 쓴다. JS 리렌더 0회.
 * - 롱프레스 → 드래그 → 놓기 → 정착을 **트랙 하나**(`DRAG_Y`)에 키프레임으로 박았다. 손가락은
 *   연속값을, 미리보기·거터 태그는 그 값을 30분 스냅한 값을 읽는다 — 출처가 하나라 어긋날 수 없다.
 * - 성장은 `height`가 아니라 `scaleY` + `transformOrigin:'top'`(§6.1: 레이아웃 애니메이션 금지).
 *   블록 안 글자는 스케일에 딸려 찌그러지지 않도록 **스케일되지 않는 형제 레이어**에 둔다.
 * - 종료 시각 텍스트는 바뀌지 않는다(§0-3). 14:00/14:30/15:00 세 장을 겹쳐 두고 한 칸씩 굴린다.
 * - 그림자는 `LiftShadowPlate`(판의 opacity)로만. `elevation`·`shadowOpacity` 직접 애니메이션 금지.
 * - 색은 전부 `useTourTokens()`. 하드코딩 hex/rgba 0개.
 * - 애니메이션 노드(useAnimatedStyle) 9개 + PressPulse 2개 = **11개** — 예산 15개 이내(§6.5).
 */

// ── 카피 ──────────────────────────────────────────────
const TITLE = '팀 회의';
/** 시작 시각(고정) — 격자 13:00 기준 13:30 지점에서 롱프레스한다 */
const T_START = '13:30';
/** 30분 스냅 3단계의 종료 시각. 겹쳐 두고 굴린다(텍스트 교체 금지) */
const T_END = ['14:00', '14:30', '15:00'] as const;
/** 요일 헤더 — calendarUtils:7 `WEEKDAY_LABELS`에서 화·수·목만 잘라 왔다 */
const DAYS = [
  { w: '화', d: '28', today: false },
  { w: '수', d: '29', today: true },
  { w: '목', d: '30', today: false },
] as const;

// ── 고정 기하 (전부 컴파일 타임 상수 — 측정으로 모션을 만들지 않는다) ──
const MOCK_H = 260;
/** WeekTimeline:15-17 그대로 */
const HOUR_H = 56;
const SNAP = HOUR_H / 2; // 28 = 30분
const GUTTER = 46;
const COLS = 3;
/** 격자 좌표계의 시작 시각 = 13:00. 라벨은 앞 4개만(5번째 줄은 프레임 밖으로 잘린다) */
const HOURS = ['13:00', '14:00', '15:00', '16:00', '17:00'] as const;
const LABELED = 4;

const HEAD_H = 26;
const PAD_TOP = 8; // WeekTimeline ScrollView contentContainer paddingTop:8 (:334)
const GRID_TOP = HEAD_H + PAD_TOP; // 34

/** 스윕 구간: 13:30(y 28) → 15:00(y 112). 높이 84 = 30분 × 3칸 */
const START_Y = SNAP; // 28
const FULL_H = SNAP * 3; // 84
/** 손가락이 실제로 짚는 y. round(30/28)=1 → 스냅 결과가 START_Y가 되는 자연스러운 지점 */
const TOUCH_Y = 30;
/** 현재 시간선 — 13:15. 스윕 구간(28~112)을 가로지르지 않는 유일하게 안전한 자리라 여기 둔다.
 *  거터 시간 태그(WeekTimeline:351)는 13:00 시간 라벨과 겹쳐서 생략했다. */
const NOW_Y = 14;

const FINGER = 26;
const RING = 34;
const TAG_H = 15; // 거터 시간 태그 한 칸 = 롤 높이
const BAR_H = 2; // 드래그 프론티어(현재 끌고 있는 아래 모서리)
const BLOCK_R = 6; // WeekTimeline:447
/** slides.tsx styles.slide paddingHorizontal — reduced 정적 SVG의 폭 계산에만 쓰는 레이아웃 상수 */
const SLIDE_PAD = 28;

/**
 * 30분 스냅 — WeekTimeline:233 `Math.max(startY + SNAP, Math.round(e.y / SNAP) * SNAP)`을
 * 그대로 옮긴 것. 손가락 오프셋(dy)을 넣으면 미리보기의 실제 높이(28 | 56 | 84)가 나온다.
 * 손가락은 연속으로 흐르고 블록만 계단으로 뛰는 실제 감각이 여기서 나온다.
 */
function snapSpan(dy: number): number {
  'worklet';
  const endY = Math.max(START_Y + SNAP, Math.round((TOUCH_Y + dy) / SNAP) * SNAP);
  return endY - START_Y;
}

// ── 비트 표 (cycle = CYCLE.calendar 5400ms, 정지점 HOLD.calendar = 0.86) ────────
//
// | t          | 비트                                                              |
// |------------|-------------------------------------------------------------------|
// | 0.00–0.05  | 커튼 인. 빈 주간 격자만                                            |
// | 0.06–0.12  | 손가락이 13:30 빈 칸에 내려앉는다 (scale 0.8 → 1)                  |
// | 0.12–0.185 | **롱프레스 350ms 대기** — 진행 링이 1.9 → 0.78로 조여든다          |
// | 0.185      | **활성** — tickHaptic(첫 사이클만) + 리플 스프링 팝.                |
// |            | 30분(28pt) 미리보기 등장 + 거터 시간 태그 13:30 / 14:00            |
// | 0.20–0.52  | 아래로 끌기 dy 0 → 84. 미리보기는 30분 스냅으로 계단 성장           |
// |            | (28 → 56 → 84), 종료 태그가 14:00 → 14:30 → 15:00 으로 굴러간다    |
// | 0.52–0.58  | 바닥에서 잠깐 멈춤 (놓기 직전의 사람 손)                            |
// | 0.58–0.62  | **놓기** — 손가락·프론티어 바 아웃 (실제로는 여기서 생성 시트가 열린다) |
// | 0.60–0.70  | 정착 — 제목 페이드인, 리프트 그림자 팝, 블록 scale 1 → 1.03 → 1     |
// | 0.70–0.94  | **홀드** — 완성 상태 (reduced·비활성 슬라이드가 여기 0.86에 정지)   |
// | 0.94–1.00  | 커튼 아웃 — 랩어라운드 하드컷을 덮는다                              |

/** 롱프레스가 활성되는 시각. 0.12부터 0.065(=350ms/5400ms) 뒤 — 실제 임계와 같은 길이다. */
const T_ACTIVATE = 0.185;
const T_RELEASE = 0.58;

/** 드래그 = 트랙 하나. 키프레임 간격이 곧 감속이라 별도 이징 없이 사람 손처럼 읽힌다. */
const DRAG_Y = track([
  [0.0, 0],
  [0.2, 0], // 활성 직후 잠깐 머문다
  [0.26, 18],
  [0.32, 36],
  [0.38, 54],
  [0.44, 70],
  [0.5, 82],
  [0.52, FULL_H], // 15:00 도달
  [1.0, FULL_H],
]);

/** 미리보기·거터 태그는 활성 순간 "툭" 나타난다(페이드 아님 — 실제 제스처가 그렇다) */
const SHOW = track([
  [0.0, 0],
  ...step(T_ACTIVATE, 0, 1),
  [1.0, 1],
]);

/** 프론티어 바 — 끌고 있는 동안만. 놓으면 사라지고 블록만 남는다. */
const BAR_OP = track([
  [0.0, 0],
  ...step(T_ACTIVATE, 0, 1),
  [T_RELEASE, 1],
  [0.62, 0],
  [1.0, 0],
]);

const FINGER_OP = track([
  [0.0, 0],
  [0.06, 0],
  [0.12, 1],
  [T_RELEASE, 1],
  [0.62, 0],
  [1.0, 0],
]);

/** 접근(0.8→1) · 누름(0.9) · 떼기(0.92)를 한 트랙에 묶었다 */
const FINGER_S = track([
  [0.0, 0.8],
  [0.06, 0.8],
  [0.12, 1],
  [0.17, 1],
  [T_ACTIVATE, 0.9],
  [0.21, 1],
  [T_RELEASE, 1],
  [0.62, 0.92],
  [1.0, 0.92],
]);

/** 롱프레스 진행 링 — 바깥에서 손가락 크기로 조여들며 "누르고 있는 중"을 그린다 */
const RING_S = track([
  [0.0, 1.9],
  [0.12, 1.9],
  [T_ACTIVATE, 0.78],
  [1.0, 0.78],
]);
const RING_OP = track([
  [0.0, 0],
  [0.12, 0],
  [0.14, 0.55],
  ...step(T_ACTIVATE, 0.55, 0),
  [1.0, 0],
]);

/** 착지 팝 — scaleY(스냅 성장)와 곱해지는 균일 스케일 */
const SETTLE_S = track([
  [0.0, 1],
  [0.6, 1],
  [0.645, 1.03],
  [0.7, 1],
  [1.0, 1],
]);

/** 리프트 그림자 — 블록이 앉는 순간에만 떠 있다 */
const LIFT = track([
  [0.0, 0],
  [T_RELEASE, 0],
  [0.64, 1],
  [0.72, 1],
  [0.8, 0],
  [1.0, 0],
]);

/** 제목 페이드인 구간 */
const TITLE_T0 = 0.6;
const TITLE_T1 = 0.7;

// ── reduced-motion 정적 어포던스(§3.3) ──────────────────
/** 거터에서 스윕 방향을 설명하는 점선 화살표. 원점 = 격자 좌표 (32, START_Y+10) */
const ARROW_BOX = { w: 14, h: 66 };
const ARROW_D = 'M 7 0 V 52';
const ARROW_HEAD = '2,52 12,52 7,64';

/**
 * 롱프레스 링 + 활성 리플.
 *
 * 연속 모션은 타임라인이지만 "한 번 튀는 것"은 스프링이 낫다(§2.3). 롱프레스가 활성되는 순간
 * 리플이 한 번 퍼지고, **첫 사이클에만** `tickHaptic()`이 울린다 — WeekTimeline:216과 같은
 * 피드백이다. 5.4초마다 진동하는 온보딩은 고문이므로 `fired`가 워클릿 쪽 1회 래치다.
 *
 * 이 조각을 별도 컴포넌트로 뽑은 이유: `reduced`일 때 **리액션을 아예 마운트하지 않기 위해서**다
 * (훅은 조건부 호출이 불가능하므로 호출부를 조건부 렌더로 만든다).
 */
function PressPulse({ clock, k }: { clock: SharedValue<number>; k: TourTokens }) {
  const pop = useSharedValue(0);
  const fired = useSharedValue(false);

  useAnimatedReaction(
    () => clock.value >= T_ACTIVATE && clock.value < 0.9,
    (armed, prev) => {
      if (armed && !prev) {
        pop.value = 0;
        pop.value = withSpring(1, SnappySpringConfig);
        if (!fired.value) {
          fired.value = true;
          runOnJS(tickHaptic)(); // WeekTimeline:216 롱프레스 활성 햅틱
        }
      } else if (!armed && prev) {
        pop.value = 0; // 랩어라운드 리셋
      }
    },
  );

  // ── 노드 10: 롱프레스 진행 링 ──
  const holdStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, RING_OP),
    transform: [{ scale: sample(clock.value, RING_S) }],
  }));

  // ── 노드 11: 활성 리플 ──
  const rippleStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: (1 - pop.value) * 0.7,
    transform: [{ scale: 0.7 + pop.value * 1.1 }],
  }));

  return (
    <>
      <Animated.View style={[styles.ring, { borderColor: k.accent }, holdStyle]} />
      <Animated.View style={[styles.ring, { borderColor: k.accent }, rippleStyle]} />
    </>
  );
}

export function CalendarDragMock({ clock, reduced }: { clock: SharedValue<number>; reduced: boolean }) {
  const k = useTourTokens();
  const { width } = useWindowDimensions();
  // 화면폭에서 한 번 계산하는 레이아웃 상수(측정 아님) — reduced 정적 SVG 기하에만 쓰인다.
  const colW = Math.max(44, (width - SLIDE_PAD * 2 - GUTTER) / COLS);

  // 손가락(연속) · 미리보기(30분 스냅) · 거터 종료 태그가 전부 이 하나에서 나온다 → 어긋남 원천 차단
  const dragY = useDerivedValue(() => sample(clock.value, DRAG_Y));
  const spanH = useDerivedValue(() => snapSpan(dragY.value));

  // ── 애니메이션 노드 (부모 9 + PressPulse 2 = 11) ─────────────
  // 1. 커튼 — 랩어라운드 이음매를 덮는다(격자·헤더는 덮지 않는다: 배경이 깜빡이면 안 된다)
  const curtainStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, CURTAIN),
  }));

  // 2. 미리보기 → 이벤트 블록. 높이가 아니라 scaleY(origin top) — 레이아웃 애니메이션 금지(§6.1)
  const blockStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, SHOW),
    transform: [
      { scaleY: spanH.value / FULL_H },
      { scale: sample(clock.value, SETTLE_S) },
    ],
  }));

  // 3. 드래그 프론티어 — 스냅된 아래 모서리
  const barStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, BAR_OP),
    transform: [{ translateY: spanH.value - BAR_H }],
  }));

  // 4. 손가락 — 스냅되지 않은 연속 위치
  const fingerStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, FINGER_OP),
    transform: [{ translateY: dragY.value }, { scale: sample(clock.value, FINGER_S) }],
  }));

  // 5. 거터 시작 시각 태그 — 13:00 시간 라벨 자리를 primary로 덮어쓴다(실제 앱과 같은 겹침)
  const startTagStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, SHOW),
  }));

  // 6. 거터 종료 시각 태그 — 스냅된 끝선을 따라 내려간다
  const endTagStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, SHOW),
    transform: [{ translateY: spanH.value }],
  }));

  // 7. 종료 시각 롤 — 겹친 Text 3장을 한 칸씩 올린다(텍스트 내용은 바뀌지 않는다)
  const rollStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateY: -TAG_H * (spanH.value / SNAP - 1) }],
  }));

  // 8. 블록 제목 — 스케일되지 않는 형제 레이어라 글자가 찌그러지지 않는다
  const titleStyle = useAnimatedStyle<ViewStyle>(() => {
    const p = OUT_CUBIC(at(clock.value, TITLE_T0, TITLE_T1));
    return { opacity: p, transform: [{ translateY: (1 - p) * 4 }] };
  });

  // 9. 리프트 그림자 판 (판의 opacity만 — 그림자 자체는 정적)
  const liftStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: sample(clock.value, LIFT) }));

  // reduced 정적 어포던스 — 스윕된 범위를 두르는 점선 사각형(§3.3)
  const rw = colW - 2;
  const sweepRect =
    `M ${BLOCK_R} 0 H ${rw - BLOCK_R} A ${BLOCK_R} ${BLOCK_R} 0 0 1 ${rw} ${BLOCK_R} ` +
    `V ${FULL_H - BLOCK_R} A ${BLOCK_R} ${BLOCK_R} 0 0 1 ${rw - BLOCK_R} ${FULL_H} ` +
    `H ${BLOCK_R} A ${BLOCK_R} ${BLOCK_R} 0 0 1 0 ${FULL_H - BLOCK_R} ` +
    `V ${BLOCK_R} A ${BLOCK_R} ${BLOCK_R} 0 0 1 ${BLOCK_R} 0 Z`;

  return (
    <MockFrame
      k={k}
      label="캘린더 빈 시간을 길게 눌러 아래로 끌면 그 시간으로 일정이 만들어지는 예시 화면"
      style={styles.frame}>
      {/* 요일 헤더 — 정적. WeekTimeline:287-296의 2단(요일/날짜)을 260pt에 맞춰 한 줄로 압축했다 */}
      <View style={styles.head}>
        {DAYS.map((d) => (
          <View key={d.w} style={styles.headCol}>
            <MockText style={[styles.headWeek, { color: k.textSub }]}>{d.w}</MockText>
            {d.today ? (
              <View style={[styles.headToday, { backgroundColor: k.accent }]}>
                <MockText style={[styles.headDay, { color: k.onAccent }]}>{d.d}</MockText>
              </View>
            ) : (
              <MockText style={[styles.headDay, { color: k.text }]}>{d.d}</MockText>
            )}
          </View>
        ))}
      </View>

      {/* 시간 격자 — 정적. 커튼 밖에 두어 배경이 깜빡이지 않게 한다. */}
      <View style={styles.grid}>
        {HOURS.map((h, i) => (
          <View key={h} style={[styles.hourRow, { borderTopColor: k.line }]}>
            {i < LABELED ? (
              <MockText style={[styles.hourLabel, { color: k.textSub }]}>{h}</MockText>
            ) : null}
          </View>
        ))}
        <View style={styles.cols}>
          <View style={[styles.col, { borderLeftColor: k.line }]} />
          <View style={[styles.col, { borderLeftColor: k.line }]} />
          <View style={[styles.col, { borderLeftColor: k.line }]} />
        </View>
        {/* 현재 시간선 — WeekTimeline:416-418 (오늘 컬럼 왼쪽에 점) */}
        <View style={[styles.nowLine, { backgroundColor: k.theme.danger }]}>
          <View style={[styles.nowDot, { backgroundColor: k.theme.danger }]} />
        </View>
      </View>

      {/* 애니메이션 레이어 — 커튼 하나가 거터 태그와 컬럼 액터를 함께 덮는다 */}
      <Animated.View style={[styles.layer, curtainStyle]} pointerEvents="none">
        {/* 거터 시간 태그 2개 — WeekTimeline:358-372 */}
        <Animated.View style={[styles.tag, { backgroundColor: k.frameBg }, startTagStyle]}>
          <MockText style={[styles.tagText, { color: k.accent }]}>{T_START}</MockText>
        </Animated.View>
        <Animated.View style={[styles.tag, styles.tagClip, { backgroundColor: k.frameBg }, endTagStyle]}>
          <Animated.View style={rollStyle}>
            {T_END.map((t) => (
              <MockText key={t} style={[styles.tagText, { color: k.accent }]}>
                {t}
              </MockText>
            ))}
          </Animated.View>
        </Animated.View>

        {reduced ? (
          <>
            {/* 스윕 방향을 모션 없이 설명하는 점선 화살표 */}
            <View style={styles.arrow}>
              <DashedConnector
                color={k.accent}
                d={ARROW_D}
                arrow={ARROW_HEAD}
                width={ARROW_BOX.w}
                height={ARROW_BOX.h}
              />
            </View>
            <View style={styles.hint}>
              <HintChip k={k}>길게 눌러 드래그</HintChip>
            </View>
          </>
        ) : null}

        <View style={styles.layerCols}>
          <View style={styles.colSpacer} />
          {/* 오늘(수) 컬럼 — 제스처가 일어나는 자리 */}
          <View style={styles.actorCol}>
            {/* 그림자 판은 블록 뒤에 깔린다. 스케일되지 않는 슬롯 안이라 그림자가 늘어나지 않는다. */}
            <View style={styles.plateSlot}>
              <LiftShadowPlate
                k={k}
                style={styles.plate}
                animatedStyle={liftStyle as unknown as StyleProp<ViewStyle>}
              />
            </View>

            {/* 미리보기 → 이벤트 블록 (WeekTimeline:447 block / :421 preview) */}
            <Animated.View
              style={[
                styles.block,
                { backgroundColor: k.accentSoft, borderLeftColor: k.accent },
                blockStyle,
              ]}
            />

            {/* 제목 — 스케일 밖 레이어 */}
            <Animated.View style={[styles.cardText, titleStyle]}>
              <MockText numberOfLines={1} style={[styles.cardTitle, { color: k.text }]}>
                {TITLE}
              </MockText>
            </Animated.View>

            {/* 드래그 프론티어 */}
            <Animated.View style={[styles.bar, { backgroundColor: k.accent }, barStyle]} />

            {reduced ? (
              <View style={styles.sweep}>
                <DashedConnector color={k.accent} d={sweepRect} width={rw} height={FULL_H} />
              </View>
            ) : (
              <PressPulse clock={clock} k={k} />
            )}

            <Animated.View style={[styles.finger, fingerStyle]}>
              <FingerHint k={k} size={FINGER} />
            </Animated.View>
          </View>
          <View style={styles.colSpacer} />
        </View>
      </Animated.View>
    </MockFrame>
  );
}

const styles = StyleSheet.create({
  frame: { height: MOCK_H, width: '100%' },

  head: { height: HEAD_H, flexDirection: 'row', paddingLeft: GUTTER, alignItems: 'center' },
  headCol: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  headWeek: { ...type.caption, fontSize: 11, fontWeight: '600' },
  headDay: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  headToday: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // WeekTimeline styles.grid/hourRow/hourLabel/cols/colLine
  grid: { position: 'absolute', left: 0, right: 0, top: GRID_TOP, bottom: 0 },
  hourRow: { height: HOUR_H, borderTopWidth: StyleSheet.hairlineWidth, paddingLeft: GUTTER },
  hourLabel: { ...type.label, fontSize: 11, position: 'absolute', left: 6, top: -7 },
  cols: { position: 'absolute', left: GUTTER, right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  col: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  nowLine: { position: 'absolute', left: GUTTER, right: 0, top: NOW_Y, height: 1.5 },
  nowDot: { position: 'absolute', top: -3.5, left: -3, width: 8, height: 8, borderRadius: 4 },

  layer: { position: 'absolute', left: 0, right: 0, top: GRID_TOP, bottom: 0 },
  layerCols: {
    position: 'absolute',
    left: GUTTER,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  colSpacer: { flex: 1 },
  actorCol: { flex: 1 },

  // 거터 시간 태그 — WeekTimeline styles.timeTag (left 2 / paddingH 2)
  tag: { position: 'absolute', left: 2, top: START_Y - 8, paddingHorizontal: 2 },
  tagClip: { height: TAG_H, overflow: 'hidden' },
  tagText: { fontSize: 11, lineHeight: TAG_H, fontWeight: '800' },

  plateSlot: { position: 'absolute', left: 1, right: 1, top: START_Y, height: FULL_H },
  plate: { borderRadius: BLOCK_R },

  block: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: START_Y,
    height: FULL_H,
    borderRadius: BLOCK_R,
    borderLeftWidth: 3,
    transformOrigin: 'top',
  },
  // WeekTimeline block paddingHorizontal 4 / paddingVertical 2 (+ borderLeftWidth 3)
  cardText: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: START_Y,
    height: FULL_H,
    paddingLeft: 7,
    paddingRight: 4,
    paddingTop: 2,
  },
  cardTitle: { fontSize: 11, lineHeight: 15, fontWeight: '600' },

  bar: { position: 'absolute', left: 1, right: 1, top: START_Y, height: BAR_H, borderRadius: 999 },

  ring: {
    position: 'absolute',
    left: '50%',
    marginLeft: -RING / 2,
    top: TOUCH_Y - RING / 2,
    width: RING,
    height: RING,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  finger: { position: 'absolute', left: '50%', marginLeft: -FINGER / 2, top: TOUCH_Y - FINGER / 2 },

  // reduced 전용 정적 레이어
  sweep: { position: 'absolute', left: 1, top: START_Y },
  arrow: { position: 'absolute', left: 32, top: START_Y + 10 },
  hint: { position: 'absolute', left: GUTTER + 6, top: 2 },
});
