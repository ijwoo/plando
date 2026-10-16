import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  SnappySpringConfig,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { impactHaptic } from '@/shared/ui/haptics';
import { PRIORITY_LABEL, priorityColor, readableOn, statusColor, type TodoPriority } from '@/shared/ui/tone';
import { radius, type } from '@/shared/ui/tokens';

import {
  DashedConnector,
  FingerHint,
  HintChip,
  LiftShadowPlate,
  MOCK_ROW_H,
  MockDot,
  MockFrame,
  MockPill,
  MockRow,
  MockText,
} from './MockPrimitives';
import { at, CURTAIN, EASE, sample, track } from './timeline';
import { useTourTokens, type TourTokens } from './tourTokens';

/**
 * 슬라이드 1 목업 — "오른쪽으로 밀어서 완료".
 *
 * 무엇을 그리는가: 실제 `src/features/todo/TaskListRow.tsx`의 오른쪽 스와이프 완료다.
 * (TaskListRow:279-303 `ReanimatedSwipeable` + :289-296 `onSwipeableWillOpen('right')` →
 *  끝까지 밀면 즉시 완료 — 애플 미리알림 방식. 임계는 :119 `width * 0.4`.)
 * 칸반 드래그앤드롭은 이 앱에 **없다** — 그리지 않는다.
 *
 * 구조 규칙
 * - 모든 모션은 UI 스레드: `clock`(0→1 무한 주행) 하나를 각 요소가 `interpolate`로 잘라 쓴다.
 *   setInterval·setState 루프 없음, JS 리렌더 0회.
 * - 스와이프 5단계(접근→끌기→임계→놓기→정착)는 **트랙 하나**(`SWIPE_X`)에 경계를 키프레임으로
 *   박았다. 손가락과 행이 같은 파생값(`dragX`)을 읽으므로 어긋날 수가 없다.
 * - `layoutId` 대응물이 없으므로 주인공 행은 레이아웃을 떠나지 않는다: 도착 슬롯은 항상
 *   자리를 차지하고(고스트), 이동은 **컴파일 타임 상수** `MOVE_DY`로만 한다. 측정 금지.
 * - 레이아웃 애니메이션 금지 — transform / opacity / color 전용.
 * - 그림자는 `LiftShadowPlate`(판의 opacity)로만. `elevation`·`shadowOpacity` 직접 애니메이션 금지.
 * - 색은 전부 `useTourTokens()` + `tone.ts` 헬퍼. 하드코딩 hex/rgba 0개.
 */

// ── 기하 (전부 컴파일 타임 상수) ──────────────────────────
const ROW_H = MOCK_ROW_H; // 56 — MockPrimitives가 TaskListRow styles.row에서 베낀 행 높이
const HDR_H = 24; // 그룹 헤더
const R1_TOP = HDR_H; // 24  리서치 정리
const R2_TOP = R1_TOP + ROW_H; // 80  API 연동 ← 주인공(mover), 세 행의 가운데
const R3_TOP = R2_TOP + ROW_H; // 136 배포 점검
const HDR2_TOP = R3_TOP + ROW_H; // 192 "완료" 헤더
const DEST_TOP = HDR2_TOP + HDR_H; // 216 도착 슬롯
const LIST_H = DEST_TOP + ROW_H; // 272

/** 도착 오프셋 — 행 2개 + 헤더 1개. 이 값이 상수라는 게 이 설계의 전제다. */
const MOVE_DY = DEST_TOP - R2_TOP; // 136

const SWIPE_MAX = 112; // 끝까지 민 거리
const THRESHOLD_X = 96; // 완료 임계 (실제 앱은 화면폭×0.4 — 목업 폭 기준 대략 같은 비율)
const COUNT_H = 16; // 카운트 롤 한 칸
const FINGER = 26; // FingerHint 지름

// ── 비트 표 (cycle = CYCLE.swipe 5200ms, 정지점 HOLD.swipe 0.86) ──────────
//
// | t          | 비트                                                        |
// |------------|-------------------------------------------------------------|
// | 0.00–0.05  | 커튼 인 + 목록이 y 12 → 0 으로 떠오름                        |
// | 0.18–0.24  | 손가락 인디케이터 등장 (행2 좌측), scale 0.8 → 1              |
// | 0.24–0.30  | 집기 — 리프트 그림자 판 opacity 0 → 1, 행 scale 1 → 1.015     |
// | 0.28–0.37  | 끌기 0 → 96 (임계). 뒤에 깔린 초록 완료 판이 드러난다         |
// | 0.37       | **임계 통과** — 햅틱(첫 사이클만) + 체크 아이콘 스프링 팝     |
// | 0.37–0.44  | 임계 너머로 더 밀기 96 → 112                                 |
// | 0.44–0.52  | 손 뗌(opacity→0) · 스냅백 112 → -8 → 0 (오버슈트를 구워 넣음) |
// | 0.52–0.62  | 완료 표현 — 취소선 scaleX 0→1, 제목색 text→textSub,           |
// |            | 우선순위/마감 메타 페이드아웃, 선두 원 → 체크 크로스페이드     |
// | 0.62–0.76  | 그룹 이동 — 행2 y 0→136, scale 1→0.97→1 / 행3 y 0→-56 (빈자리) |
// | 0.76–0.84  | 카운트 롤 — 진행 중 3→2, 완료 0→1                            |
// | 0.84–0.94  | **홀드** (reduced·비활성 슬라이드가 여기 0.86에 정지)          |
// | 0.94–1.00  | 커튼 아웃 — 랩어라운드 하드컷을 덮는다                        |

const T_CROSS = 0.37; // 임계 통과 시각 — SWIPE_X가 정확히 THRESHOLD_X를 찍는 키프레임
const T_RELEASE = 0.44; // 손 떼는 시각

/** 스와이프 = 트랙 하나. 키프레임 간격이 곧 이징(감속)이라 별도 이징 없이 사람 손처럼 읽힌다. */
const SWIPE_X = track([
  [0.0, 0],
  [0.28, 0], // 대기
  [0.31, 48], // 끌기 — 초반이 빠르고
  [0.34, 78],
  [T_CROSS, THRESHOLD_X], // 임계 통과 (96)
  [0.4, 108],
  [T_RELEASE, SWIPE_MAX], // 끝까지 (112) — 손 뗌
  [0.46, 40], // 스냅백
  [0.48, -8], // 오버슈트
  [0.5, -2],
  [0.52, 0], // 정착
  [1.0, 0],
]);

/** 그룹 이동 — out-cubic을 키프레임에 구워 넣었다(감속). */
const MOVE_Y = track([
  [0.0, 0],
  [0.62, 0],
  [0.655, 58],
  [0.69, 98],
  [0.725, 124],
  [0.76, MOVE_DY],
  [1.0, MOVE_DY],
]);

/** 행3이 빈자리를 메우며 올라온다 — 같은 구간·같은 감속. */
const FILL_Y = track([
  [0.0, 0],
  [0.62, 0],
  [0.655, -24],
  [0.69, -40],
  [0.725, -51],
  [0.76, -ROW_H],
  [1.0, -ROW_H],
]);

/** 집기 살짝 + 착지 살짝 — 스케일 한 트랙에 두 비트를 묶었다. */
const MOVE_S = track([
  [0.0, 1],
  [0.26, 1],
  [0.3, 1.015],
  [0.5, 1.015],
  [0.56, 1],
  [0.62, 1],
  [0.67, 0.97],
  [0.76, 1],
  [1.0, 1],
]);

/** 리프트 그림자 — 끌 때와 옮길 때만 떠 있다. */
const LIFT = track([
  [0.0, 0],
  [0.24, 0],
  [0.3, 1],
  [0.5, 1],
  [0.56, 0],
  [0.63, 0],
  [0.67, 1],
  [0.74, 1],
  [0.78, 0],
  [1.0, 0],
]);

/** 초록 완료 판 — 행 뒤에 처음부터 깔려 있다(폭 애니메이션 아님).
 *  0.56–0.60에 끄는 이유: 행이 이미 덮고 있는 구간이라 사라지는 게 안 보이고,
 *  0.62의 그룹 이동 때 빈자리에 초록이 남지 않는다. */
const PANEL_OP = track([
  [0.0, 1],
  [0.56, 1],
  [0.6, 0],
  [1.0, 0],
]);

const FINGER_OP = track([
  [0.0, 0],
  [0.18, 0],
  [0.24, 1],
  [T_RELEASE, 1],
  [0.47, 0],
  [1.0, 0],
]);

const FINGER_S = track([
  [0.0, 0.8],
  [0.18, 0.8],
  [0.24, 1],
  [T_RELEASE, 1],
  [0.47, 0.9],
  [1.0, 0.9],
]);

/** 완료 표현(취소선·제목 디밍·메타 페이드·체크 크로스페이드)이 공유하는 0→1 진행률 구간 */
const T_DONE0 = 0.52;
const T_DONE1 = 0.62;

/** 도착 슬롯 고스트 — "여기로 간다"를 미리 보여주고, 행이 앉으면 사라진다. */
const SLOT_OP = track([
  [0.0, 0],
  [0.3, 0],
  [0.4, 1],
  [0.66, 1],
  [0.74, 0],
  [1.0, 0],
]);

/** 카운트 롤 — 겹친 Text 2장을 한 칸 올린다(텍스트 내용은 바뀌지 않는다). */
const ROLL = track([
  [0.0, 0],
  [0.76, 0],
  [0.84, 1],
  [1.0, 1],
]);

/** 목록 진입 — 커튼과 한 노드에 묶었다(행별 stagger는 노드 3개를 먹어 포기). */
const RISE = track([
  [0.0, 12],
  [0.02, 12],
  [0.12, 0],
  [1.0, 0],
]);

/**
 * 완료 판의 체크 아이콘 + 임계 통과 임펄스.
 *
 * 연속 모션은 타임라인이지만 "한 번 튀는 것"은 스프링이 낫다. 임계를 넘는 순간 아이콘이
 * 0.68 → 1로 스프링 팝하고, **첫 사이클에만** 햅틱이 한 번 울린다(5초마다 진동하는 온보딩은
 * 고문이다). `fired`가 워클릿 쪽 1회 래치이고, 랩어라운드에서는 `pop`만 재무장한다.
 *
 * 이 조각을 별도 컴포넌트로 뽑은 이유: `reduced`일 때 **리액션을 아예 마운트하지 않기 위해서**다
 * (훅은 조건부 호출이 불가능하므로 호출부를 조건부 렌더로 만든다).
 */
function PanelCheck({ clock, k }: { clock: SharedValue<number>; k: TourTokens }) {
  const pop = useSharedValue(0);
  const fired = useSharedValue(false);

  useAnimatedReaction(
    () => clock.value >= T_CROSS && clock.value < 0.9,
    (armed, prev) => {
      if (armed && !prev) {
        pop.value = 0;
        pop.value = withSpring(1, SnappySpringConfig);
        if (!fired.value) {
          fired.value = true;
          runOnJS(impactHaptic)(); // TaskListRow:36과 같은 피드백
        }
      } else if (!armed && prev) {
        pop.value = 0; // 랩어라운드 리셋
      }
    },
  );

  const popStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.68, 1]) }],
  }));

  return (
    <Animated.View style={popStyle}>
      <Ionicons name="checkmark" size={20} color={k.onDone} />
    </Animated.View>
  );
}

/** 그룹 헤더 — 점 + 라벨 + 카운트 롤. 오른쪽은 비워 둔다(정적 커넥터가 지나갈 자리). */
function GroupHeader({
  k,
  dot,
  label,
  from,
  to,
  rollStyle,
}: {
  k: TourTokens;
  dot: string;
  label: string;
  from: string;
  to: string;
  rollStyle: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
}) {
  return (
    <View style={styles.header}>
      <MockDot color={dot} size={6} />
      <MockText style={[styles.headerLabel, { color: k.textSub }]}>{label}</MockText>
      <View style={styles.countClip}>
        <Animated.View style={rollStyle}>
          <MockText style={[styles.count, { color: k.textDim }]}>{from}</MockText>
          <MockText style={[styles.count, { color: k.textDim }]}>{to}</MockText>
        </Animated.View>
      </View>
    </View>
  );
}

/** 애니메이션 없는 행 본문 — 치수 출처: TaskListRow styles.prioBar(3pt)·title·pill */
function RowBody({ k, title, prio, due }: { k: TourTokens; title: string; prio?: TodoPriority; due?: string }) {
  const pc = prio ? priorityColor(k.theme, prio) : null;
  return (
    <>
      {prio && prio !== 'LOW' && pc ? <View style={[styles.prioBar, { backgroundColor: pc }]} /> : null}
      <View style={styles.lead}>
        <Ionicons name="ellipse-outline" size={20} color={k.textDim} />
      </View>
      <View style={styles.body}>
        <MockText numberOfLines={1} style={[styles.title, { color: k.text }]}>
          {title}
        </MockText>
      </View>
      {prio && pc ? (
        <MockPill bg={pc} color={readableOn(pc)}>
          {PRIORITY_LABEL[prio]}
        </MockPill>
      ) : null}
      {due ? <MockText style={[styles.due, { color: k.textSub }]}>{due}</MockText> : null}
    </>
  );
}

export function TodoSwipeMock({ clock, reduced }: { clock: SharedValue<number>; reduced: boolean }) {
  const k = useTourTokens();
  const { width } = useWindowDimensions();
  // 화면폭에서 한 번 계산하는 레이아웃 상수(측정 아님) — 정적 SVG 기하에 쓰인다.
  const frameW = Math.max(240, Math.min(width - 56, 340));

  // 손가락과 행이 같은 값을 읽는다 → 어긋남 원천 차단
  const dragX = useDerivedValue(() => sample(clock.value, SWIPE_X));
  // 두 카운터가 같은 숫자를 쓴다
  const rollY = useDerivedValue(() => -COUNT_H * sample(clock.value, ROLL));
  // 완료 표현 4종이 공유하는 진행률
  const doneP = useDerivedValue(() => at(clock.value, T_DONE0, T_DONE1));

  // ── 애니메이션 노드 (부모 13 + PanelCheck 1 = 14) ────────────────────────────────
  // 1. 목록 전체: 커튼(랩어라운드 가림) + 진입 상승
  const listStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, CURTAIN),
    transform: [{ translateY: sample(clock.value, RISE) }],
  }));

  // 2. 주인공 행: 스와이프 + 그룹 이동 + 집기/착지 스케일 (한 트랙 묶음)
  const moverStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: sample(clock.value, MOVE_Y) },
      { scale: sample(clock.value, MOVE_S) },
    ],
  }));

  // 3. 리프트 그림자 판 (판의 opacity만 — 그림자 자체는 정적)
  const liftStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: sample(clock.value, LIFT) }));

  // 4. 완료 판 노출/정리
  const panelStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: sample(clock.value, PANEL_OP) }));

  // 5. 손가락
  const fingerStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, FINGER_OP),
    transform: [{ translateX: dragX.value }, { scale: sample(clock.value, FINGER_S) }],
  }));

  // 6. 취소선 (origin left — transformOrigin으로 폭 측정 없이 왼→오)
  const strikeStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: doneP.value > 0 ? 1 : 0,
    transform: [{ scaleX: EASE(doneP.value) }],
  }));

  // 7. 제목색 text → textSecondary (TaskListRow:207의 완료 표현)
  const titleStyle = useAnimatedStyle(() => ({
    color: interpolateColor(doneP.value, [0, 1], [k.text, k.textSub]),
  }));

  // 8. 우선순위 pill + 마감 — 완료되면 사라진다 (TaskListRow:236 `!done && priority`)
  const metaStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: 1 - doneP.value }));

  // 9. 선두 원 → 체크 크로스페이드 (TaskListRow:198 checkmark-circle 22 / theme.green)
  const checkStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: doneP.value }));

  // 10. 행3이 빈자리를 메운다 — reduced면 출발 자리를 비워 둬야 고스트가 설명이 된다
  const row3Style = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateY: reduced ? 0 : sample(clock.value, FILL_Y) }],
  }));

  // 11. 도착 슬롯 고스트
  const slotStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: sample(clock.value, SLOT_OP) }));

  // 12·13. 카운트 롤 2개 (같은 rollY를 공유)
  const roll1Style = useAnimatedStyle<ViewStyle>(() => ({ transform: [{ translateY: rollY.value }] }));
  const roll2Style = useAnimatedStyle<ViewStyle>(() => ({ transform: [{ translateY: rollY.value }] }));

  const rowLine = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: k.line };
  const highColor = priorityColor(k.theme, 'HIGH');

  // reduced 정적 어포던스 기하 — 출발 고스트(점선 사각형)와 도착으로 내려가는 점선 화살표
  const ghostW = frameW - 16;
  const ghostH = ROW_H - 12;
  const gr = 10;
  const ghostPath =
    `M ${gr} 0 H ${ghostW - gr} A ${gr} ${gr} 0 0 1 ${ghostW} ${gr} V ${ghostH - gr} ` +
    `A ${gr} ${gr} 0 0 1 ${ghostW - gr} ${ghostH} H ${gr} A ${gr} ${gr} 0 0 1 0 ${ghostH - gr} ` +
    `V ${gr} A ${gr} ${gr} 0 0 1 ${gr} 0 Z`;

  return (
    <MockFrame
      k={k}
      label="할 일을 오른쪽으로 밀어 완료하고, 완료 목록으로 옮겨지는 예시 화면"
      style={{ width: frameW, alignSelf: 'center' }}>
      <Animated.View style={[styles.list, listStyle]}>
        <GroupHeader
          k={k}
          dot={statusColor(k.theme, 'IN_PROGRESS')}
          label="진행 중"
          from="3"
          to="2"
          rollStyle={roll1Style}
        />

        <View style={[styles.slot, { top: R1_TOP }]}>
          <MockRow k={k} style={rowLine}>
            <RowBody k={k} title="리서치 정리" prio="MEDIUM" due="오늘" />
          </MockRow>
        </View>

        <Animated.View style={[styles.slot, { top: R3_TOP }, row3Style]}>
          <MockRow k={k} style={rowLine}>
            <RowBody k={k} title="배포 점검" />
          </MockRow>
        </Animated.View>

        <View style={[styles.header, styles.header2]}>
          <MockDot color={statusColor(k.theme, 'DONE')} size={6} />
          <MockText style={[styles.headerLabel, { color: k.textSub }]}>완료</MockText>
          <View style={styles.countClip}>
            <Animated.View style={roll2Style}>
              <MockText style={[styles.count, { color: k.textDim }]}>0</MockText>
              <MockText style={[styles.count, { color: k.textDim }]}>1</MockText>
            </Animated.View>
          </View>
        </View>

        {/* 도착 슬롯 — 항상 자리를 차지한다(레이아웃이 움직이지 않는 전제) */}
        <Animated.View style={[styles.slot, styles.slotGhost, { top: DEST_TOP }, slotStyle]}>
          <View style={[styles.slotFill, { backgroundColor: k.block }]} />
        </Animated.View>

        {/* 완료 판 — 행 뒤에 깔려 있다가 행이 밀려나며 드러난다 (TaskListRow:402-404 leftFill) */}
        <Animated.View
          style={[styles.slot, styles.panel, { top: R2_TOP, backgroundColor: k.done }, panelStyle]}>
          {/* reduced면 리액션(햅틱·스프링)을 아예 마운트하지 않는다 — 판 자체가 보이지 않는 상태다 */}
          {reduced ? (
            <Ionicons name="checkmark" size={20} color={k.onDone} />
          ) : (
            <PanelCheck clock={clock} k={k} />
          )}
          <MockText style={[styles.panelLabel, { color: k.onDone }]}>완료</MockText>
        </Animated.View>

        {/* 주인공 행 */}
        <Animated.View style={[styles.slot, { top: R2_TOP }, moverStyle]}>
          {/* MockPrimitives의 animatedStyle은 StyleProp<ViewStyle> 시그니처라 핸들을 넘길 때 캐스트가 필요하다 */}
          <LiftShadowPlate k={k} animatedStyle={liftStyle as unknown as StyleProp<ViewStyle>} />
          <MockRow k={k} style={rowLine}>
            <View style={[styles.prioBar, { backgroundColor: highColor }]} />
            <View style={styles.lead}>
              <Ionicons name="ellipse-outline" size={20} color={k.textDim} />
              <Animated.View style={[styles.leadOver, checkStyle]}>
                <Ionicons name="checkmark-circle" size={22} color={k.done} />
              </Animated.View>
            </View>
            <View style={styles.body}>
              <View style={styles.titleWrap}>
                <Animated.Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.title, titleStyle]}>
                  API 연동
                </Animated.Text>
                <Animated.View
                  style={[styles.strike, { backgroundColor: k.textSub }, strikeStyle]}
                />
              </View>
            </View>
            <Animated.View style={[styles.meta, metaStyle]}>
              <MockPill bg={highColor} color={readableOn(highColor)}>
                {PRIORITY_LABEL.HIGH}
              </MockPill>
              <MockText style={[styles.due, { color: k.textSub }]}>오늘</MockText>
            </Animated.View>
          </MockRow>
        </Animated.View>

        {reduced ? (
          <>
            {/* 출발 자리 점선 잔상 — borderStyle:'dashed'는 Android에서 실선이라 SVG로 그린다 */}
            <View style={[styles.ghost, { top: R2_TOP + 6 }]}>
              <DashedConnector color={k.textDim} d={ghostPath} width={ghostW} height={ghostH} />
              <View style={styles.ghostChip}>
                <HintChip k={k}>→ 밀어서 완료</HintChip>
              </View>
            </View>
            {/* 출발 → 도착 점선 화살표 (오른쪽 여백을 지난다) */}
            <View style={[styles.conn, { left: frameW - 44, top: R2_TOP + ROW_H / 2 }]}>
              <DashedConnector
                color={k.accent}
                d="M 18 2 C 18 38, 4 70, 18 98"
                arrow="11,96 25,96 18,110"
                width={36}
                height={116}
              />
            </View>
          </>
        ) : null}

        {/* 손가락 — 행과 같은 dragX를 읽는다 */}
        <Animated.View
          pointerEvents="none"
          style={[styles.finger, { top: R2_TOP + (ROW_H - FINGER) / 2 }, fingerStyle]}>
          <FingerHint k={k} size={FINGER} />
        </Animated.View>
      </Animated.View>
    </MockFrame>
  );
}

const styles = StyleSheet.create({
  list: { height: LIST_H },
  header: {
    height: HDR_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  header2: { position: 'absolute', left: 0, right: 0, top: HDR2_TOP },
  headerLabel: { ...type.label, fontWeight: '700' },
  countClip: { height: COUNT_H, overflow: 'hidden' },
  count: { ...type.caption, height: COUNT_H, lineHeight: COUNT_H, fontWeight: '700' },

  slot: { position: 'absolute', left: 0, right: 0, height: ROW_H },
  slotGhost: { alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 8 },
  slotFill: { flex: 1, marginVertical: 6, borderRadius: radius.md },

  // TaskListRow styles.prioBar (width 3, 좌측 부착)
  prioBar: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 999 },
  lead: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  leadOver: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  titleWrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  title: { ...type.body, fontWeight: '600' },
  strike: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    height: 1.5,
    borderRadius: 999,
    transformOrigin: 'left',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  due: { ...type.caption },

  // TaskListRow styles.leftFill — 초록 판 위 체크 + "완료"
  panel: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 26 },
  panelLabel: { fontSize: 12, fontWeight: '700' },

  ghost: { position: 'absolute', left: 8 },
  ghostChip: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  conn: { position: 'absolute' },

  finger: { position: 'absolute', left: 20 },
});
