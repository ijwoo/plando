import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { AppState, Linking } from 'react-native';

import { useSettings } from '@/features/settings/queries';
import { getPushPermState, THEME_LABELS, SettingsShell, type PushPerm } from '@/features/settings/shared';
import { useWorkspacePermissions } from '@/features/workspace/permissions';
import { useAppLockStore } from '@/shared/store/appLockStore';
import { usePushStore } from '@/shared/store/pushStore';
import { ListGroup, ListRow, ListSectionHeader } from '@/shared/ui/List';
import { getPriorityLabel } from '@/shared/ui/tone';

const CAL_VIEW_LABEL: Record<string, string> = { month: '월간', week: '주간', day: '일간' };

/** 환경설정 허브 — iOS 설정 앱처럼 카테고리별 세부 화면으로 진입, 행에 현재 값 요약 표시. */
export default function SettingsScreen() {
  const router = useRouter();
  const { data: s, isLoading, isError, error } = useSettings();
  const { canManageWorkspace } = useWorkspacePermissions();

  // 요약 값용 가벼운 상태 (푸시 권한·앱 잠금)
  const [pushPerm, setPushPerm] = useState<PushPerm>(null);
  const pushEnabled = usePushStore((st) => st.enabled);
  const appLockEnabled = useAppLockStore((st) => st.enabled);
  useEffect(() => {
    void usePushStore.getState().hydrate();
    void useAppLockStore.getState().hydrate();
    const refresh = async () => setPushPerm(await getPushPermState());
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, []);

  const pushOn = pushEnabled && pushPerm === 'granted';

  return (
    <SettingsShell title="환경설정" loading={isLoading} error={isError ? error : undefined}>
      {s ? (
        <>
          <ListGroup>
            <ListRow
              icon="color-palette"
              iconBg="#8B5CF6"
              label="화면"
              desc="테마 · 콤팩트 모드 · 완료 사운드"
              value={THEME_LABELS[s.themeMode ?? 'system'] ?? '시스템'}
              onPress={() => router.push('/settings/display')}
            />
            <ListRow
              icon="notifications"
              iconBg="#EF4444"
              label="알림"
              desc="푸시 · 받을 알림 · 리마인더"
              value={pushPerm == null ? undefined : pushOn ? '켜짐' : '꺼짐'}
              onPress={() => router.push('/settings/notifications')}
            />
            <ListRow
              icon="calendar"
              iconBg="#F59E0B"
              label="캘린더"
              desc="기본 보기 · 주 시작 요일"
              value={CAL_VIEW_LABEL[s.calendarDefaultView ?? 'month']}
              onPress={() => router.push('/settings/calendar')}
            />
            <ListRow
              icon="checkbox"
              iconBg="#3B82F6"
              label="할 일"
              desc="새 할 일 기본값 · 자동 보관"
              value={getPriorityLabel((s.defaultPriority as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'MEDIUM')}
              onPress={() => router.push('/settings/todo')}
            />
            <ListRow
              icon="lock-closed"
              iconBg="#10B981"
              label="보안"
              desc="Face ID 앱 잠금"
              value={appLockEnabled ? '켜짐' : '꺼짐'}
              last={!canManageWorkspace}
              onPress={() => router.push('/settings/security')}
            />
            {/* 상태(워크플로우) 정의 관리 — ADMIN+ 에게만 */}
            {canManageWorkspace ? (
              <ListRow
                icon="git-branch"
                iconBg="#0EA5E9"
                label="워크플로우 상태"
                desc="상태 라벨·색상 · 순서 · 기본값"
                last
                onPress={() => router.push('/settings/statuses')}
              />
            ) : null}
          </ListGroup>

          <ListSectionHeader>정보</ListSectionHeader>
          <ListGroup>
            <ListRow label="약관 및 정보" desc="이용약관 · 개인정보처리방침 · 오픈소스" onPress={() => router.push('/legal')} />
            <ListRow
              label="문의하기"
              desc="불편한 점·제안을 보내주세요"
              onPress={() => void Linking.openURL(`mailto:wawa9972@gmail.com?subject=${encodeURIComponent('Plan Do! 문의')}`)}
            />
            <ListRow label="앱 버전" value={Constants.expoConfig?.version ?? '-'} last hideChevron />
          </ListGroup>
        </>
      ) : null}
    </SettingsShell>
  );
}
