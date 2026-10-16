import { Easing, Extrapolation, interpolate } from 'react-native-reanimated';

import { motion } from '@/shared/ui/tokens';

/**
 * 투어 타임라인 유틸 — 웹 온보딩의 페이즈 테이블(BOARD_DRAG / CAL_DRAG)을 RN으로 옮긴 것.
 *
 * 웹은 setInterval로 phase 인덱스를 올리고 리렌더로 그렸다. 여기서는 슬라이드마다
 * 0→1을 도는 시계(useTourClock) 하나를 두고, 각 요소가 자기 구간만 interpolate로
 * 잘라 쓴다. 페이즈 "표"라는 가독성은 트랙(키프레임 목록)으로 유지되고, 값은 연속
 * 보간되므로 요소끼리 어긋날 수가 없다.
 */

/**
 * tokens.motion.easeBezier를 워클릿에서 부를 수 있는 형태로.
 * Easing.bezier()는 withTiming 전용 팩토리라 워클릿에서 직접 호출할 수 없다 — bezierFn을 쓴다.
 */
export const EASE = Easing.bezierFn(...motion.easeBezier);
export const OUT_CUBIC = Easing.out(Easing.cubic);

export type Track = { input: number[]; output: number[] };

/** 키프레임 목록 → interpolate 인자. 시간(t)은 반드시 오름차순. */
export function track(beats: readonly (readonly [t: number, v: number])[]): Track {
  const input = beats.map((b) => b[0]);
  if (__DEV__) {
    for (let i = 1; i < input.length; i += 1) {
      if (input[i] < input[i - 1]) {
        throw new Error(`[tour/timeline] 키프레임 시간이 역행합니다: ${input[i - 1]} → ${input[i]}`);
      }
    }
  }
  return { input, output: beats.map((b) => b[1]) };
}

/** 트랙 샘플링. 구간 밖은 양끝 값으로 고정. */
export function sample(clock: number, tr: Track): number {
  'worklet';
  return interpolate(clock, tr.input, tr.output, Extrapolation.CLAMP);
}

/** [t0,t1] 구간의 로컬 0→1 진행률. 이징을 씌워 쓰는 게 기본. */
export function at(clock: number, t0: number, t1: number): number {
  'worklet';
  return interpolate(clock, [t0, t1], [0, 1], Extrapolation.CLAMP);
}

/**
 * 계단(불연속) 전환 — 같은 시각에 값을 둘 찍어 표현한다.
 * track([[0, 0], ...step(0.4, 0, 1), [1, 1]]) 처럼 펼쳐 쓴다.
 */
const EPS = 0.0005;
export function step(t: number, from: number, to: number) {
  return [
    [t - EPS, from],
    [t, to],
  ] as const;
}

/**
 * 문자 단위로 끊어 올라가는 진행률 트랙 — "타이핑되는 것처럼" 보이게 한다.
 *
 * 커버를 연속 보간으로 밀면 글자가 매끄럽게 드러나서 **타이핑이 아니라 와이프**로 읽힌다.
 * 실제 타이핑은 글자 단위로 툭툭 끊기므로, 각 글자 경계에서 계단으로 점프시킨다.
 * 반환값은 0→1 진행률이라 커버 translateX(=진행률 × 텍스트폭)와 캐럿 위치가 함께 끊긴다.
 */
export function typeTrack(chars: number, t0: number, t1: number): Track {
  const beats: [number, number][] = [
    [0, 0],
    [t0, 0],
  ];
  const dt = (t1 - t0) / chars;
  for (let i = 1; i <= chars; i += 1) {
    const t = t0 + dt * i;
    beats.push([t - EPS, (i - 1) / chars]);
    beats.push([t, i / chars]);
  }
  beats.push([1, 1]);
  return track(beats);
}

/**
 * 랩어라운드(t=1 → 0 점프)를 가리는 커튼. 모든 목업이 공유한다.
 * 시계 방식은 역재생이 없는 대신 이음매에서 "하드 컷"이 보이는데, 양끝을 페이드로 덮어 없앤다.
 */
export const CURTAIN = track([
  [0.0, 0],
  [0.05, 1],
  [0.95, 1],
  [1.0, 0],
]);

/**
 * 슬라이드별 사이클 길이와 정지 지점.
 *
 * holdAt은 "완성 상태를 들고 있는 구간"의 한가운데다. 1.0이 아닌 이유: 1.0 근처는
 * 커튼이 내려가는(페이드아웃) 구간이라 거기 고정하면 화면이 어두워진다.
 * reduced-motion이거나 비활성 슬라이드면 시계가 여기에 멈춘다.
 */
export const CYCLE = {
  swipe: 5200,
  ai: 4600,
  geofence: 4200,
  calendar: 4000,
  dm: 6200,
} as const;

export const HOLD = {
  swipe: 0.86,
  ai: 0.88,
  geofence: 0.87,
  calendar: 0.86,
  dm: 0.88,
} as const;
