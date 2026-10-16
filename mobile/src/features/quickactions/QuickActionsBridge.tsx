import { useEffect } from 'react';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';

/**
 * iOS 앱 아이콘 길게눌러 나오는 퀵액션(홈 화면 단축).
 * params.href를 두면 useQuickActionRouting이 해당 경로로 자동 이동.
 * 인증 상태에서만 마운트(라우트 보호).
 */
export function QuickActionsBridge() {
  // 액션 탭 → params.href로 라우팅
  useQuickActionRouting();

  useEffect(() => {
    void QuickActions.setItems([
      { id: 'new-todo', title: '새 할 일', icon: 'add', params: { href: '/todo/new' } },
      { id: 'search', title: '검색', icon: 'search', params: { href: '/search' } },
      { id: 'map', title: '지도 일정', icon: 'location', params: { href: '/map' } },
    ]).catch(() => {
      // 네이티브 모듈 없음(리빌드 전) — 무시
    });
  }, []);

  return null;
}
