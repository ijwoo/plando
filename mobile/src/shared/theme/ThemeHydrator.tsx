import { useEffect } from 'react';

import { useSettings } from '@/features/settings/queries';
import { hydrateThemeMode } from '@/shared/store/themeStore';

/**
 * 로그인 후 사용자 설정을 불러와 테마 모드(themeMode)를 앱 전역 스토어에 반영한다.
 * 렌더 출력 없음 — 인증 영역에 한 번만 마운트.
 */
export function ThemeHydrator() {
  const { data } = useSettings();
  useEffect(() => {
    if (data) hydrateThemeMode(data.themeMode);
  }, [data]);
  return null;
}
