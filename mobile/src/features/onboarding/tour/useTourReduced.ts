import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * OS "동작 줄이기" 설정 구독.
 *
 * reanimated의 useReducedMotion()을 쓰지 않는 이유: 그건 모듈 초기화 시점의 스냅샷이라
 * 설정을 바꿔도 리렌더가 일어나지 않는다(앱 재시작 전까지 옛 값). 온보딩은 설정을 바꾸고
 * 바로 확인하는 화면이라 실시간 구독이 필요하다.
 *
 * ready=false인 첫 프레임에는 애니메이션을 시작하지 않는다 — 동작 줄이기가 켜진 기기에서
 * 한 프레임 움직였다가 멈추는 깜빡임을 막는다.
 */
export function useTourReduced(): { reduced: boolean; ready: boolean } {
  const [state, setState] = useState<{ reduced: boolean; ready: boolean }>({
    reduced: false,
    ready: false,
  });

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setState({ reduced: v, ready: true });
      })
      .catch(() => {
        // 조회 실패 시 애니메이션을 켜는 쪽으로 — 기능 손실보다 낫다.
        if (alive) setState({ reduced: false, ready: true });
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      if (alive) setState({ reduced: v, ready: true });
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return state;
}
