import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  ReduceMotion,
  SnappySpringConfig,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PRIORITY_LABEL, priorityColor, readableOn } from '@/shared/ui/tone';
import { radius, type } from '@/shared/ui/tokens';

import { MockFrame, MockPill, MockText } from './MockPrimitives';
import { at, CURTAIN, EASE, OUT_CUBIC, sample, track, typeTrack } from './timeline';
import { useTourTokens } from './tourTokens';

/**
 * 슬라이드 2 목업 — "한 줄 입력 → 구조화된 할 일".
 *
 * 그리는 대상은 홈 히어로 `src/features/chat/AiCaptureCard.tsx`다. 실컴포넌트를 재사용하지
 * 않고(쿼리·상태에 묶여 있다) **치수만 그대로 베꼈다**:
 *   - inputRow  : borderRadius radius.pill / hairline border / paddingVertical 5 / send 30×30(r15)
 *   - 아이콘     : sparkles 17 · arrow-up 16 · checkmark-circle 15 · time/location-outline 13
 *   - result    : padding 12 / radius.md / hairline border, pill 은 paddingH 7·paddingV 2·r6·11/700
 * 유일한 축소: 입력 문장 글자 크기 15 → 14. 320pt 기기(목업 실폭 ≈ 264)에서 데모 문장이
 * 한 줄에 안 들어가면 리빌 도중 말줄임표가 새는데, 타이핑 연출이 통째로 망가진다.
 *
 * 모션은 전부 UI 스레드다 — 슬라이드 시계(clock) 하나를 각 요소가 구간별로 잘라 쓴다.
 * 애니메이션 노드(useAnimatedStyle) 15개, 글자별 애니메이션 없음.
 */

// ── 카피 (현행 온보딩 슬라이드 2와 동일) ──────────────────
const SENTENCE = '내일 강남에서 거래처 미팅';
const RESULT_TITLE = '거래처 미팅';
const META_WHEN = '내일';
const META_WHERE = '강남';

// ── 고정 기하 (컴파일 타임 상수 — 측정으로 모션을 만들지 않는다) ──
const PAD = 14; // 프레임 안쪽 여백
const INPUT_H = 40; // send 30 + paddingVertical 5×2 (AiCaptureCard inputRow)
const SEND = 30;
const LINK_H = 24; // 입력↔결과 사이 연결 스트립. reduced 의 정적 ↓ 자리이자 평소엔 여백
const LINE_H = 20; // 입력 문장 한 줄 높이 — 커버/캐럿이 이 높이를 공유한다
const CARET_H = 15;
const CARET_W = 1.5;

/*
 * 비트 표 (cycle = CYCLE.ai = 5600ms, holdAt = HOLD.ai = 0.88)
 *
 *  t          | 비트
 *  0.00–0.05  | 커튼 인. 빈 입력 + 캐럿 깜빡임(시계와 무관한 앰비언트 루프)
 *  0.05–0.34  | 타이핑: 커버가 글자 단위로 끊기며 물러난다(typeTrack — 매끄럽게 밀면 와이프로 보임)
 *  0.42–0.47  | 입력 테두리 inputBorder→primary, 전송 버튼 surfaceSelected→primary,
 *             | 화살표 dim→onAccent 교체 + scale 1→1.12→1
 *  0.47–0.53  | 전송 눌림 scale→0.88→1, 스피너 크로스페이드 인
 *  0.53–0.61  | 스피너 아웃 / 화살표 복귀. 입력은 비우지 않는다(원인과 결과가 한 화면에)
 *  0.58–0.66  | 결과 카드 등장 (opacity, y 10→0, scale 0.97→1)
 *  0.60       | checkmark-circle 스프링 팝 (useAnimatedReaction, reduced 면 미마운트)
 *  0.66–0.71  | 제목 x −6→0 페이드인
 *  0.70–0.78  | 메타 칩 3개 stagger (0.016 ≈ 90ms 간격): 내일 · 강남 · 높음
 *  0.80–0.93  | 홀드 — 완성 상태 (reduced 가 고정되는 지점)
 *  0.93–1.00  | 커튼 아웃 (랩어라운드 하드컷을 가린다)
 */
/* 타이핑 구간. 연속 보간이면 '와이프'로 보여서 글자 수만큼 계단으로 끊는다(typeTrack). */
const REVEAL = typeTrack(SENTENCE.length, 0.05, 0.34);
const CARET_OP = track([
  [0.0, 0],
  [0.02, 1],
  [0.42, 1],
  [0.46, 0],
  [1.0, 0],
]);
const SEND_SCALE = track([
  [0.0, 1],
  [0.42, 1],
  [0.45, 1.12],
  [0.47, 1],
  [0.5, 0.88],
  [0.53, 1],
  [1.0, 1],
]);
const ARROW_DIM = track([
  [0.0, 1],
  [0.42, 1],
  [0.47, 0],
  [1.0, 0],
]);
const ARROW_ON = track([
  [0.0, 0],
  [0.42, 0],
  [0.47, 1],
  [0.5, 0],
  [0.58, 0],
  [0.62, 1],
  [1.0, 1],
]);
const SPINNER = track([
  [0.0, 0],
  [0.47, 0],
  [0.51, 1],
  [0.57, 1],
  [0.61, 0],
  [1.0, 0],
]);

/** 활성화(테두리·전송 버튼 색) 구간 */
const FOCUS_T0 = 0.42;
const FOCUS_T1 = 0.47;
/** 결과 카드 구간 */
const CARD_T0 = 0.58;
const CARD_T1 = 0.66;
/** 제목/메타 stagger */
const TITLE_T0 = 0.66;
const META_T0 = [0.7, 0.716, 0.732] as const;
const FADE_DUR = 0.05;
const SLIDE_X = -6;

/**
 * 체크 아이콘 팝(임펄스)만 리액션+스프링으로 처리한다. 연속 모션은 타임라인이 낫지만
 * 한 번 튀는 건 스프링이 자연스럽다.
 * `reduced` 일 때 **이 컴포넌트 자체를 마운트하지 않아** 리액션도 스프링도 생기지 않는다
 * (조건부 훅 금지를 컴포넌트 경계로 우회. 공유값을 여기서 만들어 프롭 변형도 피한다).
 */
function CheckPop({ clock, color }: { clock: SharedValue<number>; color: string }) {
  const pop = useSharedValue(0);

  useAnimatedReaction(
    () => clock.value >= 0.6 && clock.value < 0.95,
    (armed, prev) => {
      if (armed && !prev) {
        pop.value = 0;
        pop.value = withSpring(1, SnappySpringConfig);
      } else if (!armed && prev) {
        pop.value = 0; // 랩어라운드 리셋
      }
    },
  );

  // ── 애니메이션 노드 11 ──
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.5 + pop.value * 0.5 }] }));

  return (
    <Animated.View style={checkStyle}>
      <Ionicons name="checkmark-circle" size={15} color={color} />
    </Animated.View>
  );
}

export function AiCaptureMock({ clock, reduced }: { clock: SharedValue<number>; reduced: boolean }) {
  const k = useTourTokens();
  const pColor = priorityColor(k.theme, 'HIGH');

  /** 문장 폭 — JS 측정은 이 한 번뿐이고, 커버의 이동 거리로만 쓰인다 */
  const textW = useSharedValue(0);
  const blink = useSharedValue(1);
  const pulse = useSharedValue(0);

  // 캐럿 깜빡임·sparkles 숨쉬기는 사이클에 묶으면 어색하다 — 독립 루프.
  // reduceMotion: Never 필수 — 기본값 System 이면 OS 설정이 켜졌을 때 무한 반복이 폭주한다.
  useEffect(() => {
    if (reduced) {
      blink.value = 0;
      pulse.value = 0;
      return;
    }
    blink.value = withRepeat(
      withTiming(0, { duration: 520, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 900,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
    return () => {
      cancelAnimation(blink);
      cancelAnimation(pulse);
    };
  }, [reduced, blink, pulse]);

  // ── 애니메이션 노드 1: 커튼 (랩어라운드 이음매 가리개) ──
  const curtainStyle = useAnimatedStyle(() => ({ opacity: sample(clock.value, CURTAIN) }));

  // ── 2: 입력 테두리 (비활성 → primary) ──
  const inputStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      at(clock.value, FOCUS_T0, FOCUS_T1),
      [0, 1],
      [k.theme.inputBorder, k.accent],
    ),
  }));

  // ── 3: sparkles 숨쉬기 ──
  const sparkStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.12 }] }));

  // ── 4: 타이핑 커버 (폭이 아니라 위치를 움직인다 — 프레임마다 레이아웃이 없다) ──
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sample(clock.value, REVEAL) * textW.value }],
  }));

  // ── 5: 캐럿 (커버 좌측 모서리를 따라간다) ──
  const caretStyle = useAnimatedStyle(() => ({
    opacity: sample(clock.value, CARET_OP) * blink.value,
    transform: [{ translateX: sample(clock.value, REVEAL) * textW.value }],
  }));

  // ── 6: 전송 버튼 (배경 + 눌림) ──
  const sendStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      at(clock.value, FOCUS_T0, FOCUS_T1),
      [0, 1],
      [k.rowPressed, k.accent],
    ),
    transform: [{ scale: sample(clock.value, SEND_SCALE) }],
  }));

  // ── 7·8: 화살표 2장 크로스페이드 (같은 글리프라 색만 바뀌어 보인다) ──
  const arrowDimStyle = useAnimatedStyle(() => ({ opacity: sample(clock.value, ARROW_DIM) }));
  const arrowOnStyle = useAnimatedStyle(() => ({ opacity: sample(clock.value, ARROW_ON) }));

  // ── 9: 스피너 (회전은 ActivityIndicator 자체가 네이티브로 돈다) ──
  const spinnerStyle = useAnimatedStyle(() => ({ opacity: sample(clock.value, SPINNER) }));

  // ── 10: 결과 카드 ──
  const cardStyle = useAnimatedStyle(() => {
    const p = OUT_CUBIC(at(clock.value, CARD_T0, CARD_T1));
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 10 }, { scale: 0.97 + p * 0.03 }],
    };
  });

  // ── 11: 체크 팝 → CheckPop 안에 있다 (reduced 면 미마운트) ──

  // ── 12: 제목 ──
  const titleStyle = useAnimatedStyle(() => {
    const p = EASE(at(clock.value, TITLE_T0, TITLE_T0 + FADE_DUR));
    return { opacity: p, transform: [{ translateX: (1 - p) * SLIDE_X }] };
  });

  // ── 13·14·15: 메타 칩 stagger ──
  const meta0Style = useAnimatedStyle(() => {
    const p = EASE(at(clock.value, META_T0[0], META_T0[0] + FADE_DUR));
    return { opacity: p, transform: [{ translateX: (1 - p) * SLIDE_X }] };
  });
  const meta1Style = useAnimatedStyle(() => {
    const p = EASE(at(clock.value, META_T0[1], META_T0[1] + FADE_DUR));
    return { opacity: p, transform: [{ translateX: (1 - p) * SLIDE_X }] };
  });
  const meta2Style = useAnimatedStyle(() => {
    const p = EASE(at(clock.value, META_T0[2], META_T0[2] + FADE_DUR));
    return { opacity: p, transform: [{ translateX: (1 - p) * SLIDE_X }] };
  });

  const onTextLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) textW.value = w;
  };

  return (
    <MockFrame k={k} label="한 줄로 적은 말이 날짜·장소·우선순위가 채워진 할 일로 바뀌는 예시 화면">
      <Animated.View style={[styles.body, { backgroundColor: k.canvas }, curtainStyle]}>
        {/* 입력 pill — AiCaptureCard styles.inputRow */}
        <Animated.View style={[styles.inputRow, { backgroundColor: k.row }, inputStyle]}>
          <Animated.View style={sparkStyle}>
            <Ionicons name="sparkles" size={17} color={k.accent} />
          </Animated.View>

          <View style={styles.field}>
            {/* 문장은 한 번만 레이아웃된다. 폭을 애니메이션하지 않으므로 한글 자간이 그대로 유지된다 */}
            <View onLayout={onTextLayout} style={styles.fieldText}>
              <MockText numberOfLines={1} style={[styles.sentence, { color: k.text }]}>
                {SENTENCE}
              </MockText>
            </View>
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: k.row }, coverStyle]}
            />
            <Animated.View style={[styles.caret, { backgroundColor: k.accent }, caretStyle]} />
          </View>

          <Animated.View style={[styles.send, sendStyle]}>
            <Animated.View style={[styles.sendIcon, arrowDimStyle]}>
              <Ionicons name="arrow-up" size={16} color={k.textDim} />
            </Animated.View>
            <Animated.View style={[styles.sendIcon, arrowOnStyle]}>
              <Ionicons name="arrow-up" size={16} color={k.onAccent} />
            </Animated.View>
            <Animated.View style={[styles.sendIcon, spinnerStyle]}>
              <ActivityIndicator size="small" color={k.onAccent} animating={!reduced} />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/*
         * 연결 스트립 — 높이는 항상 고정이다(레이아웃을 애니메이션하지 않는다).
         * reduced 에서만 정적 ↓ 를 띄워 "입력이 결과를 만든다"는 인과를 모션 없이 설명한다.
         */}
        <View style={[styles.link, { opacity: reduced ? 1 : 0 }]}>
          <Ionicons name="arrow-down" size={16} color={k.textDim} />
        </View>

        {/* 결과 카드 — AiCaptureCard styles.result */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: k.row, borderColor: k.frameBorder },
            cardStyle,
          ]}>
          <View style={styles.cardHead}>
            {reduced ? (
              <Ionicons name="checkmark-circle" size={15} color={k.done} />
            ) : (
              <CheckPop clock={clock} color={k.done} />
            )}
            <MockText style={[styles.headText, { color: k.done }]}>할 일이 생성됐어요</MockText>
          </View>

          <Animated.View style={titleStyle}>
            <MockText numberOfLines={1} style={[styles.title, { color: k.text }]}>
              {RESULT_TITLE}
            </MockText>
          </Animated.View>

          <View style={styles.metaRow}>
            <Animated.View style={[styles.meta, meta0Style]}>
              <Ionicons name="time-outline" size={13} color={k.textSub} />
              <MockText style={[styles.metaText, { color: k.textSub }]}>{META_WHEN}</MockText>
            </Animated.View>
            <Animated.View style={[styles.meta, meta1Style]}>
              <Ionicons name="location-outline" size={13} color={k.textSub} />
              <MockText style={[styles.metaText, { color: k.textSub }]}>{META_WHERE}</MockText>
            </Animated.View>
            <Animated.View style={meta2Style}>
              <MockPill bg={pColor} color={readableOn(pColor)}>
                {PRIORITY_LABEL.HIGH}
              </MockPill>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </MockFrame>
  );
}

const styles = StyleSheet.create({
  body: { padding: PAD },
  inputRow: {
    height: INPUT_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 5,
  },
  field: { flex: 1, height: LINE_H, justifyContent: 'center', overflow: 'hidden' },
  fieldText: { alignSelf: 'flex-start', maxWidth: '100%' },
  // 원본 input 은 15/500 — 320pt 기기에서 한 줄 유지를 위해 14로만 낮췄다
  sentence: { fontSize: 14, fontWeight: '500', letterSpacing: -0.14 },
  caret: {
    position: 'absolute',
    left: 0,
    top: (LINE_H - CARET_H) / 2,
    width: CARET_W,
    height: CARET_H,
    borderRadius: CARET_W,
  },
  send: {
    width: SEND,
    height: SEND,
    borderRadius: SEND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { height: LINK_H, alignItems: 'center', justifyContent: 'center' },
  card: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 7,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headText: { ...type.caption, fontWeight: '700' },
  title: { ...type.body, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: type.caption,
});
