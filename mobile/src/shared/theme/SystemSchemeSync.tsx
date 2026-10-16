import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { useThemeStore } from '@/shared/store/themeStore';

/**
 * RN의 반응형 useColorScheme → themeStore.systemScheme 동기화 (렌더 없음, 루트에 1회 마운트).
 *
 * 왜 필요한가: 새 아키텍처에서 JS 초기화 시점의 Appearance.getColorScheme()이
 * 실제 OS 값(다크)이 확정되기 전에 'light'/null을 반환하는 경우가 있다. 그러면 스토어
 * 초기값이 라이트로 굳고, 이후 OS 외관이 "변경"되지 않는 한 이벤트가 없어 계속 라이트로 남는다.
 * useColorScheme은 첫 트레이트 확정 시 리렌더를 일으키므로 그 값을 스토어에 밀어넣어 보정한다.
 *
 * 강제(light/dark) 모드에서는 Appearance.setColorScheme 오버라이드 값이 잡히므로
 * mode==='system'일 때만 동기화한다.
 */
export function SystemSchemeSync() {
  const scheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    if (mode !== 'system') return;
    const next = scheme === 'dark' ? 'dark' : 'light';
    if (useThemeStore.getState().systemScheme !== next) {
      useThemeStore.setState({ systemScheme: next });
    }
  }, [scheme, mode]);

  return null;
}
