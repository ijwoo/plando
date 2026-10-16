import { useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { handleCheckinAction, registerCheckinCategories } from '@/features/map/checkin';
import { handleLeaveAction, registerLeaveCategory } from '@/features/map/LeaveAlertBridge';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useMe } from '@/features/auth/queries';
import { useRooms } from '@/features/dm/queries';
import { useUnreadCount } from '@/features/notification/queries';
import { todoKeys, useTodos } from '@/features/todo/queries';
import { handleTodoDueAction, registerTodoDueCategory, requestReconcile } from '@/features/todo/reminders';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { configureNotificationHandler, registerForPush, setBadge, unregisterPush } from './push';
import { usePushStore } from '@/shared/store/pushStore';

type PushData = { type?: string; targetId?: number | string; workspaceId?: number | string };

// 콜드스타트 탭은 프로세스당 1회만 처리 (재로그인으로 PushBridge가 재마운트돼도 중복 라우팅 방지)
let coldStartHandled = false;

/**
 * 인증 상태에서만 마운트되는 푸시 브릿지(렌더 없음).
 * - 권한 요청 + APNs 토큰 등록(언마운트=로그아웃 시 해제)
 * - 알림 탭 → 워크스페이스 전환 후 해당 화면 라우팅 (콜드스타트 탭 포함)
 * - 앱 배지 = 알림 안읽음 + DM 안읽음
 * - 할 일 마감 리마인더 reconcile 트리거 + 알림 액션([완료]/[1시간 뒤]) 처리
 */
export function PushBridge() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: todos } = useTodos();
  const { data: unread } = useUnreadCount();
  const { data: rooms } = useRooms();

  // 시작 시 1회 등록 — 사용자가 설정에서 푸시를 끈 경우 생략. 토글 전환의 등록/해제는
  // 설정 화면이 직접 수행한다(여기서 enabled를 deps에 넣으면 해제→재등록 레이스가 생김).
  const pushHydrated = usePushStore((st) => st.hydrated);
  useEffect(() => {
    void usePushStore.getState().hydrate();
  }, []);
  useEffect(() => {
    configureNotificationHandler();
    if (me?.email && pushHydrated && usePushStore.getState().enabled) void registerForPush();
  }, [me?.email, pushHydrated]);
  // 언마운트(=로그아웃으로 인증 게이트가 닫힐 때)에만 토큰 해제.
  // deps에 me?.email을 두면 me가 비동기로 로드되며 undefined→email 전환이 **항상** 일어나고,
  // React가 cleanup을 먼저 돌려 방금 등록한 토큰을 DELETE로 지운다(등록 POST와 경합).
  // 실제 로그아웃은 authStore.signOut이 clearToken 이전에 unregisterPush를 이미 호출한다.
  useEffect(() => {
    return () => {
      void unregisterPush();
    };
  }, []);

  // 알림 데이터 → 라우팅. 다른 워크스페이스의 리소스면 먼저 전환한다 (웹 PushNotificationHandler 미러).
  const routeFromNotification = useCallback(
    async (data: PushData | undefined) => {
      const type = String(data?.type ?? '').toUpperCase();
      const targetId = data?.targetId;
      const wsId = data?.workspaceId != null ? Number(data.workspaceId) : null;

      if (wsId != null && !Number.isNaN(wsId) && wsId !== useWorkspaceStore.getState().activeId) {
        useWorkspaceStore.getState().setActive(wsId);
        void qc.invalidateQueries(); // 갱신은 백그라운드로 — 알림 탭 후 내비게이션을 몇 초씩 막지 않는다
      }

      if (type.startsWith('RECRUITMENT')) {
        // 팀모집은 WebView 임베드 — 상세·Q&A 탭 딥링크 파라미터 전달
        const isQa = type === 'RECRUITMENT_QUESTION_RECEIVED' || type === 'RECRUITMENT_QUESTION_ANSWERED';
        router.push({ pathname: '/recruitment', params: { detail: String(targetId ?? ''), ...(isQa ? { tab: 'qa' } : {}) } });
        return;
      }
      if (type === 'ROUTE_BRIEFING') {
        // 아침 동선 브리핑 — 지도 화면 오늘 동선 모드로 진입
        router.push('/map?route=1');
        return;
      }
      if (type === 'WRAP_WEEKLY') {
        // 주간 회고 — 서버가 targetId 없이 보낸다. 아래 `targetId == null` 가드보다 먼저
        // 처리하지 않으면, /wrap 화면이 멀쩡히 있는데도 탭이 아무 일도 하지 않는다.
        router.push('/wrap');
        return;
      }
      if (type === 'AI_SCHEDULE') {
        /* 예약 실행 결과. 특정 할 일이 아니라 요약이라 targetId 자리에 **예약 id** 가 온다.
           [고치는 결함] 예전엔 /chat 으로만 보내서 빈 화면이 떴다 — "기한이 지난 일정이 2개
           있어요" 를 읽고 눌러도 무엇이 지났는지 볼 길이 없었다. 알려만 주고 길은 막은 셈이다.
           이제 그 예약의 질문을 다시 던져 결과를 그 자리에서 보여준다.
           아래 `targetId == null` 가드보다 먼저 처리해야 한다(주간 회고에서 같은 자리를 놓쳤다). */
        router.push(targetId != null ? `/chat?scheduleId=${targetId}` : '/chat');
        return;
      }
      // 여기까지 왔는데 대상이 없으면 갈 곳을 특정할 수 없다. 그래도 조용히 삼키지 않고
      // 알림 목록으로 보낸다 — 사용자는 최소한 방금 받은 알림을 다시 볼 수 있다.
      if (targetId == null) {
        router.push('/notifications');
        return;
      }
      if (type.startsWith('DM')) router.push(`/dm/${targetId}`);
      else if (type.includes('COMMENT') || type.includes('MENTION'))
        router.push({ pathname: '/todo/[id]', params: { id: String(targetId), tab: 'comments' } });
      else router.push(`/todo/${targetId}`);
    },
    [router, qc],
  );

  // 앱이 켜져 있을 때 알림 탭
  useEffect(() => {
    let sub: Notifications.EventSubscription | undefined;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((resp) => {
        const data = resp.notification.request.content.data as PushData & { kind?: string; todoId?: number };
        // 도착/이탈 체크인 액션 — 앱 전환 없이 상태만 패치
        if (data?.kind === 'checkin' && data.todoId != null) {
          const action = resp.actionIdentifier;
          if (action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
            void handleCheckinAction(action, Number(data.todoId));
            return;
          }
          router.push(`/todo/${data.todoId}`); // 본문 탭 → 상세로
          return;
        }
        // 출발 알림 액션 — [길찾기]는 지도 앱, [N분 뒤]는 재예약
        if (data?.kind === 'leave') {
          const action = resp.actionIdentifier;
          if (action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
            void handleLeaveAction(action, data as never, resp.notification.request.content);
            return;
          }
          if (data.todoId != null) {
            router.push(`/todo/${data.todoId}`); // 본문 탭 → 상세로
            return;
          }
        }
        // 마감 리마인더 액션 — [완료]는 상태 패치 후 캐시 invalidate, [1시간 뒤]는 재예약
        if (data?.kind === 'todo-due' && data.todoId != null) {
          const action = resp.actionIdentifier;
          if (action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
            void handleTodoDueAction(action, Number(data.todoId), resp.notification.request.content).then((r) => {
              if (r === 'completed') void qc.invalidateQueries({ queryKey: todoKeys.all });
            });
            return;
          }
          router.push(`/todo/${data.todoId}`); // 본문 탭 → 상세로
          return;
        }
        void routeFromNotification(data);
      });
    } catch {
      // 네이티브 모듈 없음(리빌드 전) — 무시
    }
    return () => sub?.remove();
  }, [routeFromNotification, router, qc]);

  // 콜드스타트 — 알림 탭으로 앱이 실행된 경우 리스너 등록 전에 배달된 응답을 소비
  useEffect(() => {
    if (coldStartHandled) return;
    coldStartHandled = true;
    void registerCheckinCategories();
    void registerLeaveCategory();
    void registerTodoDueCategory();
    (async () => {
      try {
        const resp = await Notifications.getLastNotificationResponseAsync();
        if (resp) await routeFromNotification(resp.notification.request.content.data as PushData);
      } catch {
        // 네이티브 모듈 없음 — 무시
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회
  }, []);

  // 앱 아이콘 배지
  const dmUnread = (rooms ?? []).reduce((n, r) => n + (r.unreadCount ?? 0), 0);
  useEffect(() => {
    void setBadge((unread ?? 0) + dmUnread);
  }, [unread, dmUnread]);

  // 할 일 마감 리마인더 — todos 쿼리 성공(데이터 변경)마다 reconcile (모듈 내부 5초 디바운스).
  // 완료/삭제/보관/마감 변경은 전부 todos invalidate를 거치므로 별도 훅 없이 자연 반영된다.
  useEffect(() => {
    if (todos) requestReconcile(todos, me?.email);
  }, [todos, me?.email]);

  return null;
}
