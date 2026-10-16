import { AppState } from 'react-native';
import { focusManager, MutationCache, QueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { toast } from '@/shared/ui/toast';

// RN에는 window focus가 없다 — 포그라운드 복귀를 focus로 매핑해
// stale 쿼리(방 목록·배지·할 일 등)가 복귀 시 자동 refetch 되게 한다.
AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

/** 공용 TanStack Query 클라이언트. 서버 상태는 여기, 클라 상태만 Zustand가 보유 */
export const queryClient = new QueryClient({
  // 모든 mutation 실패 시 전역 toast로 에러 표시 (기존 웹 app-toast와 동일).
  // 401(인증 만료)은 axios 인터셉터가 로그아웃 처리하므로 toast 생략.
  mutationCache: new MutationCache({
    onError: (error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) return;
      // 인증 리다이렉트(HTML 응답) 거부도 인터셉터가 로그아웃 처리 — 토스트 중복 방지
      if ((error as { code?: string })?.code === 'ERR_AUTH_REDIRECT') return;
      toast.error(getApiErrorMessage(error));
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: true, // = 앱 포그라운드 복귀 (위 focusManager 연동)
      // 오프라인이면 조회는 '일시정지'가 맞다 — 온라인 복귀 시 자동으로 다시 나간다.
    },
    mutations: {
      /**
       * 오프라인에서도 요청을 **보내고 실패시킨다**.
       *
       * 기본값('online')이면 OfflineBanner의 onlineManager.setOnline(false)와 맞물려
       * 뮤테이션이 실패가 아니라 **paused** 상태로 멈춘다. 그러면 mutateAsync가 영영
       * 안 끝나서 호출부의 finally/토스트가 실행되지 않고, 앱을 종료하면 그 저장은
       * 흔적 없이 사라진다(영속 persister도, resumePausedMutations도 없다).
       *
       * 오프라인 큐를 제대로 만들기 전까지는 **조용히 삼키는 것보다 즉시 실패**가 낫다 —
       * mutationCache.onError가 토스트를 띄우므로 사용자가 다시 시도할 수 있다.
       */
      networkMode: 'always',
    },
  },
});
