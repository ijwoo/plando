import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  SnappySpringConfig,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { radius, type } from '@/shared/ui/tokens';

import { DashedConnector, FingerHint, HintChip, MockDot, MockFrame, MockText } from './MockPrimitives';
import { CURTAIN, EASE, OUT_CUBIC, at, sample, track } from './timeline';
import { useTourTokens, type TourTokens } from './tourTokens';

/**
 * 슬라이드 4 목업 — "대화가 그대로 할 일이 된다".
 *
 * 그리는 대상은 실제 DM의 AI 할 일 추출이다:
 *   - 트리거 : `src/app/dm/[roomId].tsx:1124` 롱프레스 액션시트의 `✨ AI로 할 일 추출`
 *              (:1124 조건 `content.length >= 60` — 그래서 목업 메시지도 60자를 넘긴다)
 *   - 시트   : `src/features/dm/ExtractTodosSheet.tsx` — 헤더 `sparkles`(15, primary) +
 *              `메시지에서 찾은 할 일`(:87-88), 로딩 `AI가 읽고 있어요…`(:99),
 *              후보 행 `checkmark-circle`/`ellipse-outline` 22 + gap 10(:116-121, :155),
 *              i>0 행에 hairline 구분선(:115), 확인 버튼 `할 일 N개 추가`(:140).
 *              **기본 전체 선택**(선택을 '제외 집합'으로 든다, :19·:33)이라 마지막에 3개가 다 켜져 있다.
 *   - 말풍선 : `src/features/dm/MessageBubble.tsx:381-383` (paddingV 9 / paddingH 13 /
 *              radius 18 / 받은 말풍선은 borderBottomLeftRadius 4), 이름 캡션(:204-208),
 *              아바타 28(:199) — 목업은 24로만 줄였다.
 *   - 시트 크롬 : `src/features/todo/todoPickers.tsx:410-411` (borderTopRadius 26, 핸들 36×4 r2 opacity .4)
 *
 * 의도적 축소(320pt에서 읽히게 하려고):
 *   - 후보 행 44 → 26, 확인 버튼 52(Button paddingV 15) → 32, 본문 15 → 13.5.
 *   - 후보의 `마감 …` 보조줄은 뺐다. 실제로도 dueDate가 없으면 제목만 나온다(:125-130).
 *   - 받은 말풍선 배경은 원본이 `surfaceAlt`인데(MessageBubble:235) 목업 캔버스가 이미
 *     `surfaceAlt`라 안 보인다 → 같은 표면 사다리의 다음 칸 `surfaceSelected`로 한 칸 올렸다.
 *
 * 규칙 (doc/onboarding-tour-plan.md §0·§2·§5·§6)
 * - 모션은 전부 UI 스레드: clock 하나를 각 요소가 interpolate로 잘라 쓴다. JS 리렌더 0회.
 * - 레이아웃 애니메이션 금지. transform/opacity만. 좌표는 전부 컴파일 타임 상수(측정 금지).
 * - 시트 상승 진행률은 `useDerivedValue` 하나(sheetP)로 계산해 시트와 그 아래 대화(디밍)가 공유한다(§6.5).
 * - 색은 useTourTokens()에서만. 하드코딩 hex/rgba 0개.
 * - 애니메이션 노드(useAnimatedStyle) 13개 — 예산 15개 이내(§6.5).
 */

// ── 카피 ────────────────────────────────────────────────
/**
 * 회의록투 69자 — [roomId].tsx:1124의 60자 게이트를 넘겨야 추출 액션이 뜬다.
 * 요청을 문장 앞쪽에 몰아 둔 이유: 말풍선은 두 줄에서 잘리는데(긴 메시지라는 게 보여야 한다),
 * 잘려도 첫 후보("시안 정리")의 근거는 화면에 남아 있어야 인과가 읽힌다.
 */
const MESSAGE = '내일까지 시안 정리하고, 금요일 회의 자료도 준비해주세요. 예산안은 목요일까지 공유 부탁드리고, 나머지는 회의 때 얘기해요.';
const SENDER = '팀원';
/** 추출 결과 — 문장의 요청 3건과 1:1 대응 */
const CANDIDATES = ['시안 정리', '회의 자료 준비', '예산안 공유'] as const;
const CONFIRM = `할 일 ${CANDIDATES.length}개 추가`;

// ── 고정 기하 (전부 컴파일 타임 상수) ──────────────────
const MOCK_H = 260;
const PAD = 14;

/** 시트 내부 — 위에서부터 쌓아 PANEL_H를 만든다 */
const HANDLE_H = 4;
const HEAD_TOP = 8 + HANDLE_H + 8; // 20
const HEAD_H = 18;
const LIST_TOP = HEAD_TOP + HEAD_H + 6; // 44
const ROW_H = 26;
const LIST_H = ROW_H * CANDIDATES.length; // 78
const BTN_TOP = LIST_TOP + LIST_H + 6; // 128
const BTN_H = 32;
const PANEL_H = BTN_TOP + BTN_H + 8; // 168
/** 시트 위로 남는 대화 조각의 높이 */
const CHAT_H = MOCK_H - PANEL_H; // 92

const AVATAR = 24;
const CHECK = 20;
const FINGER = 26;
/** 말풍선 — MessageBubble maxWidth 85%에 맞춰 오른쪽을 비운다 */
const BUBBLE_LEFT = PAD + AVATAR + 8; // 46
const BUBBLE_RIGHT = 60;
const BUBBLE_TOP = 22;
const MSG_LINE = 18;
const BUBBLE_H = MSG_LINE * 2 + 9 * 2; // 54 — 두 줄 + MessageBubble paddingVertical 9

// ── 타임라인 (cycle = CYCLE.dm = 6200ms, 정지 = HOLD.dm = 0.88) ──
//
// | t         | ms        | 비트                                                      |
// |-----------|-----------|-----------------------------------------------------------|
// | 0.00–0.05 | 0–310     | 커튼 인. 대화 조각이 y 8 → 0 으로 떠오른다                 |
// | 0.16–0.21 | 990–1300  | 손가락(롱프레스) 인 — scale 0.85 → 1                       |
// | 0.21–0.24 | 1300–1490 | 누름 유지 — scale 0.92 (롱프레스 300ms의 시각적 대응)      |
// | 0.24–0.29 | 1490–1800 | 액션 칩 `✨ AI로 할 일 추출` 인 (y 6 → 0)                   |
// | 0.30–0.38 | 1860–2360 | 손가락·칩 아웃 (액션시트가 닫히고 추출 시트가 뜬다)         |
// | 0.32–0.44 | 1980–2730 | **시트 상승** translateY 168 → 0, 뒤 대화 디밍 1 → 0.78     |
// | 0.38–0.52 | 2360–3220 | 로딩 — 스피너 + `AI가 읽고 있어요…`                        |
// | 0.52–0.56 | 3220–3470 | 로딩 아웃                                                  |
// | 0.54–0.66 | 3350–4090 | 후보 3행 stagger 인 (x −6 → 0, 0.035 ≈ 220ms 간격)         |
// | 0.66/0.70/0.74 | 4090/4340/4590 | **체크 팝** — 스프링(useAnimatedReaction), reduced면 미마운트 |
// | 0.78–0.84 | 4840–5210 | 확인 버튼 `할 일 3개 추가` 인 (y 8 → 0)                    |
// | 0.84–0.94 | 5210–5830 | **홀드** — 완성 상태 (reduced가 0.88에 고정되는 지점)       |
// | 0.94–1.00 | 5830–6200 | 커튼 아웃 (랩어라운드 하드컷을 덮는다)                      |

const CHAT_Y = track([
  [0.0, 8],
  [0.02, 8],
  [0.12, 0],
  [1.0, 0],
]);
/** 롱프레스 — 등장(0.85→1) 후 누르는 동안 살짝 눌린다(0.92) */
const FINGER_S = track([
  [0.0, 0.85],
  [0.16, 0.85],
  [0.21, 1],
  [0.24, 0.92],
  [0.32, 0.92],
  [0.34, 0.86],
  [1.0, 0.86],
]);
const FINGER_O = track([
  [0.0, 0],
  [0.16, 0],
  [0.21, 1],
  [0.3, 1],
  [0.34, 0],
  [1.0, 0],
]);
const CHIP_O = track([
  [0.0, 0],
  [0.24, 0],
  [0.29, 1],
  [0.34, 1],
  [0.38, 0],
  [1.0, 0],
]);
const CHIP_Y = track([
  [0.0, 6],
  [0.24, 6],
  [0.29, 0],
  [1.0, 0],
]);
const LOAD_O = track([
  [0.0, 0],
  [0.38, 0],
  [0.43, 1],
  [0.52, 1],
  [0.56, 0],
  [1.0, 0],
]);

/** 시트 상승 구간 — sheetP(파생값)의 정의역 */
const SHEET_T0 = 0.32;
const SHEET_T1 = 0.44;
/** 시트가 다 오르면 뒤 대화를 이만큼 죽인다(바텀시트 스크림 대응). 가독성 때문에 0.22까지만. */
const DIM = 0.22;

/** 후보 행 stagger — 등장 시각 / 체크 팝 시각 */
const ROW_IN = [0.54, 0.575, 0.61] as const;
const ROW_DUR = 0.05;
const TICK_AT = [0.66, 0.7, 0.74] as const;
const SLIDE_X = -6;

/** 확인 버튼 */
const BTN_T0 = 0.78;
const BTN_T1 = 0.84;

// ── reduced-motion 정적 어포던스(§3.3): 메시지 → 시트 인과를 점선으로 ──
/**
 * 박스 원점 = (프레임 우측 −12, 위 74) — 말풍선 아래로만 지나 글자를 가리지 않는다.
 * 화살촉은 시트 헤더의 힌트 칩을 가리키므로 시트 **위에** 겹쳐 그린다(마지막에 렌더).
 */
const LINK_BOX = { w: 64, h: 40 };
const LINK_D = 'M 10 4 C 22 12, 30 20, 40 28';
const LINK_ARROW = '34,25 46,28 38,37';

/**
 * 체크 팝(임펄스)만 리액션+스프링으로 처리한다. 연속 모션은 타임라인이 낫지만 한 번 튀는 건
 * 스프링이 자연스럽다(§2.3). `reduced`면 **이 컴포넌트를 마운트하지 않아** 리액션도 스프링도
 * 생기지 않는다(조건부 훅 금지를 컴포넌트 경계로 우회). 햅틱은 없다 — 제스처 데모가 아니라
 * 결과 시연이라 5초마다 울릴 이유가 없다.
 */
function CheckTick({ clock, k, tickAt }: { clock: SharedValue<number>; k: TourTokens; tickAt: number }) {
  const pop = useSharedValue(0);

  useAnimatedReaction(
    () => clock.value >= tickAt && clock.value < 0.95,
    (armed, prev) => {
      if (armed && !prev) {
        pop.value = 0;
        pop.value = withSpring(1, SnappySpringConfig);
      } else if (!armed && prev) {
        pop.value = 0; // 랩어라운드 리셋
      }
    },
  );

  const popStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: pop.value > 0 ? 1 : 0,
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.55, 1]) }],
  }));

  return (
    <Animated.View style={[styles.checkOver, popStyle]}>
      <Ionicons name="checkmark-circle" size={CHECK} color={k.accent} />
    </Animated.View>
  );
}

/**
 * 후보 한 줄 — ExtractTodosSheet의 Pressable 행. 체크는 `ellipse-outline` 위에
 * `checkmark-circle`(꽉 찬 원)을 겹쳐 크로스페이드한다(TaskListRow 선두 원과 같은 수법).
 */
function Candidate({
  k,
  clock,
  reduced,
  title,
  appearAt,
  tickAt,
  top,
  divider,
}: {
  k: TourTokens;
  clock: SharedValue<number>;
  reduced: boolean;
  title: string;
  appearAt: number;
  tickAt: number;
  top: number;
  divider: boolean;
}) {
  const rowStyle = useAnimatedStyle<ViewStyle>(() => {
    const p = EASE(at(clock.value, appearAt, appearAt + ROW_DUR));
    return { opacity: p, transform: [{ translateX: (1 - p) * SLIDE_X }] };
  });

  return (
    <Animated.View
      style={[
        styles.row,
        { top },
        divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: k.line } : null,
        rowStyle,
      ]}>
      <View style={styles.check}>
        <Ionicons name="ellipse-outline" size={CHECK} color={k.textDim} />
        {reduced ? (
          <View style={styles.checkOver}>
            <Ionicons name="checkmark-circle" size={CHECK} color={k.accent} />
          </View>
        ) : (
          <CheckTick clock={clock} k={k} tickAt={tickAt} />
        )}
      </View>
      <MockText numberOfLines={1} style={[styles.rowTitle, { color: k.text }]}>
        {title}
      </MockText>
    </Animated.View>
  );
}

export function DmExtractMock({ clock, reduced }: { clock: SharedValue<number>; reduced: boolean }) {
  const k = useTourTokens();

  /** 시트 상승 진행률 — 시트 자신과 그 아래 대화(디밍)가 같은 값을 읽는다 → 어긋날 수 없다 */
  const sheetP = useDerivedValue(() => OUT_CUBIC(at(clock.value, SHEET_T0, SHEET_T1)));

  // ── 애니메이션 노드 (부모 7 + 후보 3 + 체크 3 = 13) ──────────────
  // 1. 커튼 — 랩어라운드 이음매를 덮는다(캔버스는 덮지 않는다: 배경이 깜빡이면 안 된다)
  const bodyStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: sample(clock.value, CURTAIN) }));

  // 2. 대화 조각 — 진입 상승 + 시트가 올라오면 디밍(스크림 대응)
  const chatStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: at(clock.value, 0.02, 0.1) * (1 - DIM * sheetP.value),
    transform: [{ translateY: sample(clock.value, CHAT_Y) }],
  }));

  // 3. 손가락(롱프레스)
  const fingerStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, FINGER_O),
    transform: [{ scale: sample(clock.value, FINGER_S) }],
  }));

  // 4. 액션시트 항목 칩
  const chipStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: sample(clock.value, CHIP_O),
    transform: [{ translateY: sample(clock.value, CHIP_Y) }],
  }));

  // 5. 추출 시트 상승
  const sheetStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateY: PANEL_H * (1 - sheetP.value) }],
  }));

  // 6. 로딩(스피너 회전은 ActivityIndicator가 네이티브로 돈다)
  const loadStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: sample(clock.value, LOAD_O) }));

  // 7. 확인 버튼
  const confirmStyle = useAnimatedStyle<ViewStyle>(() => {
    const p = OUT_CUBIC(at(clock.value, BTN_T0, BTN_T1));
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] };
  });

  return (
    <MockFrame
      k={k}
      label="대화 속 긴 메시지에서 AI가 할 일 후보를 찾아 한 번에 만드는 예시 화면"
      style={[styles.frame, { backgroundColor: k.canvas }]}>
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]} pointerEvents="none">
        {/* 대화 조각 — 받은 메시지 하나 (MessageBubble 받은 말풍선) */}
        <Animated.View style={[styles.chat, chatStyle]}>
          <View style={styles.avatar}>
            <MockDot color={k.block} size={AVATAR} />
          </View>
          <MockText style={[styles.sender, { color: k.textDim }]}>{SENDER}</MockText>
          <View style={[styles.bubble, { backgroundColor: k.rowPressed }]}>
            <MockText numberOfLines={2} style={[styles.msg, { color: k.text }]}>
              {MESSAGE}
            </MockText>
          </View>

          {/* 롱프레스 지점 */}
          <Animated.View style={[styles.finger, fingerStyle]}>
            <FingerHint k={k} size={FINGER} />
          </Animated.View>

          {/* 액션시트 항목 — [roomId].tsx:1124와 문자 그대로 같다 */}
          <Animated.View style={[styles.action, { backgroundColor: k.accentSoft }, chipStyle]}>
            <MockText style={[styles.actionText, { color: k.accent }]}>✨ AI로 할 일 추출</MockText>
          </Animated.View>
        </Animated.View>

        {/* 추출 시트 — BottomSheet 크롬(todoPickers:410-411) */}
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: k.row, borderTopColor: k.frameBorder },
            sheetStyle,
          ]}>
          <View style={[styles.handle, { backgroundColor: k.textSub }]} />

          <View style={styles.head}>
            <Ionicons name="sparkles" size={15} color={k.accent} />
            <MockText style={[styles.headText, { color: k.text }]}>메시지에서 찾은 할 일</MockText>
            {/* reduced: 인과를 글로도 못박는다(§3.3). 점선 화살촉이 이 칩을 가리킨다 */}
            {reduced ? (
              <View style={styles.headHint}>
                <HintChip k={k}>대화에서 추출</HintChip>
              </View>
            ) : null}
          </View>

          <View style={styles.list}>
            {CANDIDATES.map((title, i) => (
              <Candidate
                key={title}
                k={k}
                clock={clock}
                reduced={reduced}
                title={title}
                appearAt={ROW_IN[i]}
                tickAt={TICK_AT[i]}
                top={i * ROW_H}
                divider={i > 0}
              />
            ))}
            {/* 로딩은 목록 자리에 겹쳐 둔다 — 레이아웃이 움직이지 않는 전제(§0-1) */}
            <Animated.View style={[styles.loading, loadStyle]}>
              <ActivityIndicator size="small" color={k.accent} animating={!reduced} />
              <MockText style={[styles.loadText, { color: k.textSub }]}>AI가 읽고 있어요…</MockText>
            </Animated.View>
          </View>

          <Animated.View style={[styles.confirm, { backgroundColor: k.accent }, confirmStyle]}>
            <MockText style={[styles.confirmText, { color: k.onAccent }]}>{CONFIRM}</MockText>
          </Animated.View>
        </Animated.View>

        {/* reduced: 메시지 → 시트 점선. 시트 위에 겹쳐야 화살촉이 안 잘린다(마지막에 렌더) */}
        {reduced ? (
          <View style={styles.link}>
            <DashedConnector
              color={k.accent}
              d={LINK_D}
              arrow={LINK_ARROW}
              width={LINK_BOX.w}
              height={LINK_BOX.h}
            />
          </View>
        ) : null}
      </Animated.View>
    </MockFrame>
  );
}

const styles = StyleSheet.create({
  frame: { height: MOCK_H, width: '100%' },

  chat: { position: 'absolute', left: 0, right: 0, top: 0, height: CHAT_H },
  avatar: { position: 'absolute', left: PAD, top: BUBBLE_TOP },
  // MessageBubble styles.sender (opacity .6 / marginLeft 6) → 목업은 textTertiary로 대체
  sender: { ...type.caption, position: 'absolute', left: BUBBLE_LEFT + 6, top: 4 },
  // MessageBubble styles.bubble + bubbleOther
  bubble: {
    position: 'absolute',
    left: BUBBLE_LEFT,
    right: BUBBLE_RIGHT,
    top: BUBBLE_TOP,
    height: BUBBLE_H,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    overflow: 'hidden',
  },
  // 원본은 15/400 — 두 줄 안에 회의록투 문장이 들어가야 해서 13.5로 낮췄다
  msg: { fontSize: 13.5, lineHeight: MSG_LINE, fontWeight: '400', letterSpacing: -0.14 },

  finger: { position: 'absolute', left: 110, top: BUBBLE_TOP + (BUBBLE_H - FINGER) / 2 },
  action: {
    position: 'absolute',
    left: 62,
    top: 64,
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { ...type.caption, fontWeight: '700' },

  // todoPickers styles.sheet — borderTopRadius 26
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PANEL_H,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // todoPickers styles.handle — 36×4 r2 opacity .4
  handle: { position: 'absolute', top: 8, alignSelf: 'center', width: 36, height: HANDLE_H, borderRadius: 2, opacity: 0.4 },

  head: {
    position: 'absolute',
    left: PAD,
    right: PAD,
    top: HEAD_TOP,
    height: HEAD_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headText: { ...type.label, fontWeight: '700' },
  headHint: { marginLeft: 'auto' },

  list: { position: 'absolute', left: PAD, right: PAD, top: LIST_TOP, height: LIST_H },
  // ExtractTodosSheet styles.row (gap 10) — 세로만 44 → 26으로 압축
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  check: { width: CHECK, height: CHECK, alignItems: 'center', justifyContent: 'center' },
  checkOver: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '500', letterSpacing: -0.14 },

  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadText: type.caption,

  // Button(primary) — radius.md 유지, 세로만 52 → 32
  confirm: {
    position: 'absolute',
    left: PAD,
    right: PAD,
    top: BTN_TOP,
    height: BTN_H,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { ...type.label, fontWeight: '700' },

  link: { position: 'absolute', right: 12, top: 74 },
});
