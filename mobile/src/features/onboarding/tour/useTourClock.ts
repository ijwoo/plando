import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * 슬라이드 하나를 통째로 구동하는 단일 타임라인 시계.
 *
 * 0 → 1을 cycleMs 동안 선형 주행하고 무한 반복한다. 값 자체가 "사이클 내 진행률"이라
 * 모든 요소는 interpolate(clock.value, [t0,t1], [...])로 자기 구간만 잘라 쓴다.
 * 웹 useLoopPhase(setInterval + setState)의 대체물 — JS 리렌더가 0회다.
 *
 * playing=false(reduced-motion이거나 지금 안 보이는 슬라이드)면 holdAt에 정지한다.
 */
export function useTourClock(
  cycleMs: number,
  playing: boolean,
  holdAt: number,
): SharedValue<number> {
  const clock = useSharedValue(playing ? 0 : holdAt);

  useEffect(() => {
    cancelAnimation(clock);
    if (!playing) {
      clock.value = holdAt;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, {
        duration: cycleMs,
        easing: Easing.linear,
        // ⚠️ 기본값 ReduceMotion.System이면 OS "동작 줄이기"가 켜졌을 때 reanimated가
        //    타이밍을 즉시 끝값으로 스냅시킨다 — 무한 withRepeat과 만나면 폭주한다.
        //    reduced 판정은 우리가 playing으로 직접 하므로 여기선 항상 Never.
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
    );
    // 비활성 슬라이드에서 타임라인이 영구히 도는 걸 막는다.
    return () => cancelAnimation(clock);
  }, [clock, cycleMs, playing, holdAt]);

  return clock;
}
