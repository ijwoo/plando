import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { setUnauthorizedHandler } from '@/api/client';
import { getApiErrorMessage } from '@/api/error';
import { WelcomeFlow } from '@/features/onboarding/WelcomeFlow';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { queryClient } from '@/shared/query/queryClient';
import { useAuthStore } from '@/shared/store/authStore';
import { clearKeychainIfFreshInstall } from '@/shared/store/freshInstall';
import { useOnboardingStore } from '@/shared/store/onboardingStore';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { useProjectFilter } from '@/shared/store/projectStore';
import { useListPrefs } from '@/features/todo/listPrefs';
import { recreateSampleTodos, sampleTodosExist } from '@/features/todo/api';
import type { Todo } from '@/features/todo/api';
import { joinWorkspace } from '@/features/workspace/api';
import { pendingInvite } from '@/features/workspace/inviteStore';
import '@/features/map/geofence'; // 백그라운드 지오펜스 태스크 등록(앱 시작 시 정의돼야 함)
import { useCustomThemeStore } from '@/shared/store/customThemeStore';
import { SystemSchemeSync } from '@/shared/theme/SystemSchemeSync';
import { ThemeHydrator } from '@/shared/theme/ThemeHydrator';
import { GeofenceBridge } from '@/features/map/GeofenceBridge';
import { LeaveAlertBridge } from '@/features/map/LeaveAlertBridge';
import { WidgetSyncBridge } from '@/features/widget/WidgetSyncBridge';
import { LiveActivityBridge } from '@/features/liveactivity/LiveActivityBridge';
import { ShareInboxBridge } from '@/features/share/ShareInboxBridge';
import { SpotlightSyncBridge } from '@/features/spotlight/SpotlightSyncBridge';
import { Widget } from '@/native-modules/widget';
import { PushBridge } from '@/features/notification/PushBridge';
import { QuickActionsBridge } from '@/features/quickactions/QuickActionsBridge';
import { UniversalLinkBridge } from '@/shared/linking/UniversalLinkBridge';
import { AppErrorBoundary } from '@/shared/ui/AppErrorBoundary';
import { AppLockGate } from '@/shared/ui/AppLockGate';
import { OfflineBanner } from '@/shared/ui/OfflineBanner';
import { toast } from '@/shared/ui/toast';
import { ToastHost } from '@/shared/ui/ToastHost';

import { initSentry } from '@/shared/monitoring/sentry';

initSentry(); // DSN(EXPO_PUBLIC_SENTRY_DSN) 설정 시에만 활성 — 프로덕션 크래시 수집

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const signOut = useAuthStore((s) => s.signOut);
  const resolveWorkspace = useWorkspaceStore((s) => s.resolve);
  const resetWorkspace = useWorkspaceStore((s) => s.reset);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActive);
  const prevStatusRef = useRef<typeof status | null>(null);
  const onboarded = useOnboardingStore((s) => s.onboarded);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const completeOnboarding = useOnboardingStore((s) => s.complete);

  // 앱 시작 시 보안 저장소에서 인증 상태 복원, 401은 로그아웃으로 처리
  useEffect(() => {
    void (async () => {
      /* 반드시 복원보다 **먼저**. iOS 키체인은 앱을 지워도 남아서, 재설치해도 토큰과
         plando_onboarded가 살아 있어 자동 로그인되고 온보딩이 뜨지 않았다.
         새 설치로 판정되면 여기서 키체인을 비운 뒤에 복원을 시작한다. */
      await clearKeychainIfFreshInstall();
      await hydrate();
      await hydrateOnboarding();
      void useCustomThemeStore.getState().hydrate(); // 커스텀 테마 색 복원(themeMode='custom'일 때)
      void useListPrefs.getState().hydrate(); // 할 일 탭·보기 복원
    })();
    setUnauthorizedHandler(() => {
      void signOut();
    });
  }, [hydrate, hydrateOnboarding, signOut]);

  // 인증되면 기본 워크스페이스 해석(헤더 주입), 로그아웃되면 초기화.
  // 초대 딥링크(/join)로 들어와 로그인한 경우엔 보관된 코드로 자동 참여 후 그 워크스페이스로 전환.
  /* 워크스페이스 해석 재시도.
     예전엔 로그인 전환 시 1회만 시도해서, 그 순간 네트워크가 끊기면 앱이 빈 상태로 잠겼다
     (재시도도, 포그라운드 복귀 시 재실행도 없었음 — 앱을 완전히 종료해야 복구).
     실패해 있으면 앱이 포그라운드로 돌아올 때마다 다시 시도한다. */
  useEffect(() => {
    if (status !== 'authenticated') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const ws = useWorkspaceStore.getState();
      if (!ws.ready || ws.failed) void ws.resolve();
    });
    return () => sub.remove();
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      void (async () => {
        await resolveWorkspace();
        const code = pendingInvite.peek();
        if (!code) {
          // 일반 로그인 — 워크스페이스 헤더 확정 후 헤더 없이 캐시된 응답을 갱신
          await queryClient.invalidateQueries();
          return;
        }
        try {
          const res = await joinWorkspace(code);
          pendingInvite.clear(); // 성공했을 때만 소비 — 실패 시 다음 기회에 재시도 가능
          if (res.workspaceId != null) setActiveWorkspace(res.workspaceId);
          await queryClient.invalidateQueries();
          toast.success(`"${res.workspaceName ?? '워크스페이스'}"에 참여했어요`);
        } catch (e) {
          toast.error(getApiErrorMessage(e));
        }
      })();
    } else if (status === 'unauthenticated') {
      resetWorkspace();
      /* 캐시를 반드시 비운다. invalidate가 아니라 clear다 —
         로그아웃 시 resetWorkspace()로 activeId가 null이 되면 워크스페이스 쿼리가 enabled:false가
         되는데, 비활성 useQuery도 캐시된 data는 그대로 반환한다. 즉 다른 계정으로 로그인하면
         이전 사용자의 할 일·DM·알림이 화면에 보이고, 갱신 요청조차 걸리지 않아 그대로 남는다. */
      queryClient.clear();
      // 병행 설치 기간: 기존 Capacitor 앱과 App Group을 공유하므로,
      // '실제 로그아웃'일 때만 지운다 (비로그인 상태의 단순 부팅이 기존 앱 위젯을 비우지 않게)
      if (prevStatusRef.current === 'authenticated') Widget.clear();
    }
    prevStatusRef.current = status;
  }, [status, resolveWorkspace, resetWorkspace, setActiveWorkspace]);

  /* 워크스페이스가 정해지거나 바뀌면 그 워크스페이스의 마지막 프로젝트 스코프를 복원한다.
     프로젝트 id는 워크스페이스마다 다르므로 전환 시 반드시 다시 읽어야 한다. */
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeId);
  useEffect(() => {
    void useProjectFilter.getState().hydrateFor(activeWorkspaceId);
  }, [activeWorkspaceId]);

  // 로그인 여부를 알 때까지 스플래시 유지 (UI 깜빡임 방지)
  useEffect(() => {
    if (status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  const isAuthed = status === 'authenticated';
  const scheme = useResolvedScheme(); // 베이스 스킴 — 상태바 대비용
  const c = useTheme(); // 컬러 테마(pink/midnight 등) 포함 전체 팔레트

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
      {/* initialMetrics — 첫 프레임부터 실제 인셋 사용. 지연 측정되면 navH(paddingTop)가
          뒤늦게 바뀌며 탭 콘텐츠가 아래로 밀리는 점프가 생긴다 */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <SystemSchemeSync />
          <UniversalLinkBridge />
          {isAuthed ? <ThemeHydrator /> : null}
          {isAuthed ? <PushBridge /> : null}
          {isAuthed ? <QuickActionsBridge /> : null}
          {isAuthed ? <GeofenceBridge /> : null}
          {isAuthed ? <LeaveAlertBridge /> : null}
          {isAuthed ? <WidgetSyncBridge /> : null}
          {isAuthed ? <LiveActivityBridge /> : null}
          {isAuthed ? <ShareInboxBridge /> : null}
          <SpotlightSyncBridge />
          <AppErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              headerBackButtonDisplayMode: 'minimal',
              headerStyle: { backgroundColor: c.background },
              headerTintColor: c.text,
              headerTitleStyle: { color: c.text },
              contentStyle: { backgroundColor: c.background },
            }}>
            <Stack.Protected guard={isAuthed}>
              <Stack.Screen name="(tabs)" options={{ title: '뒤로가기' }} />
              {/* 탭 위로 푸시되는 화면들 */}
              <Stack.Screen name="dm/[roomId]" />
              <Stack.Screen name="dm/search/[roomId]" options={{ presentation: 'modal', headerShown: true }} />
              <Stack.Screen name="dm/new" />
              <Stack.Screen name="map" />
              <Stack.Screen name="map-search" options={{ presentation: 'modal', headerShown: true }} />
              <Stack.Screen name="todo/[id]" />
              <Stack.Screen name="todo/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="recruitment/index" />
              <Stack.Screen name="recruitment/[id]" />
              <Stack.Screen name="recruitment/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="archive" />
              <Stack.Screen name="account" />
              <Stack.Screen name="settings/index" />
              <Stack.Screen name="settings/display" />
              <Stack.Screen name="settings/notifications" />
              <Stack.Screen name="settings/calendar" />
              <Stack.Screen name="settings/todo" />
              {/* 워크플로우 상태 관리 — 다른 settings/* 와 같이 인증 가드 안에 둔다.
                  (등록이 빠져 있어 딥링크로는 로그인 없이도 들어올 수 있는 유일한 설정 화면이었다) */}
              <Stack.Screen name="settings/statuses" />
              <Stack.Screen name="settings/security" />
              <Stack.Screen name="legal" />
              <Stack.Screen name="workspaces" />
              <Stack.Screen name="templates" />
              <Stack.Screen name="chat" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="search" options={{ headerShown: true }} />
              <Stack.Screen name="wrap" />
              <Stack.Screen name="stats" />
              <Stack.Screen name="projects" />
              <Stack.Screen name="project/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={!isAuthed}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            {/* 초대·이메일 인증 딥링크 — 로그인 여부와 무관하게 진입 가능 */}
            <Stack.Screen name="join" />
            <Stack.Screen name="verify-email" />
          </Stack>
          </AppErrorBoundary>
          <OfflineBanner />
          <ToastHost />
          {isAuthed && onboarded === false ? (
            <View style={StyleSheet.absoluteFill}>
              <WelcomeFlow
                onComplete={() => {
                  void completeOnboarding();
                  // 빈 계정 첫인상 — 샘플이 없고 할 일도 없으면 샘플 할 일을 채워준다(멱등)
                  void (async () => {
                    try {
                      const todos = queryClient.getQueryData<Todo[]>(['todos']);
                      if (todos && todos.length > 0) return;
                      if (await sampleTodosExist()) return;
                      await recreateSampleTodos();
                      await queryClient.invalidateQueries({ queryKey: ['todos'] });
                      toast.success('둘러볼 수 있는 샘플 할 일을 준비했어요');
                    } catch {
                      // 샘플 생성 실패는 치명적이지 않음 — 조용히 무시
                    }
                  })();
                }}
              />
            </View>
          ) : null}
          {/* Face ID 앱 잠금 — 최상단 오버레이(온보딩 포함 전부 덮음). 꺼져 있으면 null */}
          <AppLockGate />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
