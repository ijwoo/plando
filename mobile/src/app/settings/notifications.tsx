import { useEffect, useState } from 'react';
import { AppState, Linking, Switch } from 'react-native';

import { registerForPush, unregisterPush } from '@/features/notification/push';
import type { UserSettingsUpdate } from '@/features/settings/api';
import { useSettings, useUpdateSettings } from '@/features/settings/queries';
import { getPushPermState, SettingsShell, type PushPerm } from '@/features/settings/shared';
import {
  ensureReminderPermission,
  hydrateReminderSettings,
  REMINDER_LEAD_OPTIONS,
  setReminderEnabled,
  setReminderLead,
  type ReminderSettings,
} from '@/features/todo/reminders';
import { LiveActivity } from '@/native-modules/liveactivity';
import { useLiveActivityStore } from '@/shared/store/liveActivityStore';
import { usePushStore } from '@/shared/store/pushStore';
import { ListGroup, ListRow, ListSectionHeader } from '@/shared/ui/List';
import { Segmented } from '@/shared/ui/Segmented';
import { toast } from '@/shared/ui/toast';

/** 설정 > 알림 — 푸시 채널·이벤트별·제안·잠금화면 진행·마감 리마인더 */
export default function NotificationSettingsScreen() {
  const { data: s, isLoading, isError, error } = useSettings();
  const update = useUpdateSettings();
  const set = (payload: UserSettingsUpdate) => update.mutate(payload);

  // OS 푸시 권한 상태 — 진입 시 + 앱 복귀 시(설정 앱에서 바꾸고 돌아온 경우) 갱신
  const [pushPerm, setPushPerm] = useState<PushPerm>(null);
  useEffect(() => {
    const refresh = async () => setPushPerm(await getPushPermState());
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, []);

  // 앱 푸시 토글 — 켬 = 권한 요청+토큰 등록, 끔 = 서버 토큰 해제
  const pushEnabled = usePushStore((st) => st.enabled);
  useEffect(() => {
    void usePushStore.getState().hydrate();
  }, []);
  const [pushBusy, setPushBusy] = useState(false);
  const pushOn = pushEnabled && pushPerm === 'granted';

  const onPushToggle = async (next: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (!next) {
        await usePushStore.getState().setEnabled(false);
        const ok = await unregisterPush();
        // 서버에서 토큰을 지우지 못하면 푸시가 계속 온다 — 껐다고 단정하지 않는다.
        toast[ok === false ? 'error' : 'success'](
          ok === false ? '알림 해제를 서버에 알리지 못했어요. 잠시 후 다시 시도해주세요' : '앱 푸시 알림을 껐어요',
        );
        return;
      }
      if (pushPerm === 'blocked') {
        await Linking.openSettings().catch(() => {});
        return;
      }
      await usePushStore.getState().setEnabled(true);
      const token = await registerForPush();
      const state = await getPushPermState();
      setPushPerm(state);
      if (state === 'granted' && token) {
        toast.success('푸시 알림이 켜졌어요');
      } else if (state === 'blocked') {
        toast.info('기기 설정에서 알림을 허용해주세요');
      } else {
        // 권한은 있는데 APNs 토큰을 못 받았거나 서버 등록이 실패한 경우.
        // 예전엔 이 경로에서 토스트가 하나도 없었고 스위치는 켜진 채로 남아,
        // 서버에 토큰이 없는데도 사용자는 켜졌다고 믿었다.
        await usePushStore.getState().setEnabled(false);
        toast.error('푸시 알림을 켜지 못했어요. 잠시 후 다시 시도해주세요');
      }
    } finally {
      setPushBusy(false);
    }
  };

  // Live Activity 토글 — 끄면 진행 중 활동 즉시 종료
  const laEnabled = useLiveActivityStore((st) => st.enabled);
  useEffect(() => {
    void useLiveActivityStore.getState().hydrate();
  }, []);
  const onLiveActivityToggle = async (v: boolean) => {
    await useLiveActivityStore.getState().setEnabled(v);
    if (!v) LiveActivity.end();
    toast.success(v ? '잠금화면 오늘 진행을 켰어요' : '잠금화면 오늘 진행을 껐어요');
  };

  // 마감 리마인더 — 기기 로컬 설정 (SecureStore). 끄면 reconcile이 예약을 전부 취소한다.
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);
  useEffect(() => {
    void hydrateReminderSettings().then(setReminder);
  }, []);
  const reminderOn = !!reminder?.enabled && pushPerm === 'granted';

  const onReminderToggle = async (next: boolean) => {
    if (!next) {
      setReminder((r) => (r ? { ...r, enabled: false } : r));
      await setReminderEnabled(false);
      toast.success('마감 리마인더를 껐어요');
      return;
    }
    if (pushPerm === 'blocked') {
      await Linking.openSettings().catch(() => {});
      return;
    }
    // 로컬 알림도 권한 필요 — 이미 허용이면 재요청 없이 통과, 미결정일 때만 요청
    const granted = await ensureReminderPermission();
    setPushPerm(await getPushPermState());
    if (!granted) {
      toast.info('기기 설정에서 알림을 허용해주세요');
      return;
    }
    setReminder((r) => (r ? { ...r, enabled: true } : { enabled: true, leadMinutes: 30 }));
    await setReminderEnabled(true);
    toast.success('마감 리마인더를 켰어요');
  };

  const onReminderLead = (leadMinutes: number) => {
    setReminder((r) => (r ? { ...r, leadMinutes } : r));
    void setReminderLead(leadMinutes);
  };

  return (
    <SettingsShell title="알림" loading={isLoading} error={isError ? error : undefined}>
      {s ? (
        <>
          <ListGroup>
            <ListRow
              label="인앱 알림"
              desc="앱 안에서 알림 벨·목록으로 소식을 받아요"
              right={<Switch value={s.notificationEnabled !== false} onValueChange={(v) => set({ notificationEnabled: v })} />}
            />
            <ListRow
              label="앱 푸시 알림"
              desc={pushPerm === 'blocked' ? '기기 설정에서 알림이 꺼져 있어요 — 켜면 설정으로 이동' : '앱을 열지 않아도 기기로 푸시 알림을 받아요'}
              last
              right={<Switch value={pushOn} disabled={pushBusy || pushPerm == null} onValueChange={(v) => void onPushToggle(v)} />}
            />
          </ListGroup>

          <ListSectionHeader>받을 알림</ListSectionHeader>
          <ListGroup>
            <ListRow label="담당자 지정" desc="할 일에 나를 담당자로 지정했을 때" right={<Switch value={!!s.notifyAssignment} onValueChange={(v) => set({ notifyAssignment: v })} />} />
            <ListRow label="마감일" desc="내가 담당한 할 일의 마감일이 다가올 때" right={<Switch value={!!s.notifyDueDate} onValueChange={(v) => set({ notifyDueDate: v })} />} />
            <ListRow label="댓글" desc="내 할 일·참여 스레드에 댓글이 달렸을 때" right={<Switch value={!!s.notifyComment} onValueChange={(v) => set({ notifyComment: v })} />} />
            <ListRow label="멘션" desc="댓글에서 나를 멘션했을 때" right={<Switch value={!!s.notifyMention} onValueChange={(v) => set({ notifyMention: v })} />} />
            <ListRow label="다이렉트 메시지" desc="DM 메시지·파일을 받았을 때" last right={<Switch value={!!s.notifyDm} onValueChange={(v) => set({ notifyDm: v })} />} />
          </ListGroup>

          <ListSectionHeader>스마트 기능</ListSectionHeader>
          <ListGroup>
            <ListRow
              label="대화 속 할 일 제안"
              desc="약속·요청을 감지해 할 일로 제안 (끄면 내 메시지는 분석하지 않아요)"
              right={<Switch value={s.dmSuggestionEnabled !== false} onValueChange={(v) => set({ dmSuggestionEnabled: v })} />}
            />
            <ListRow
              label="잠금화면 오늘 진행"
              desc="오늘 일정이 있는 동안 잠금화면·다이나믹 아일랜드에 진행 상황 표시"
              last
              right={<Switch value={laEnabled} onValueChange={(v) => void onLiveActivityToggle(v)} />}
            />
          </ListGroup>

          <ListSectionHeader>마감 리마인더</ListSectionHeader>
          <ListGroup>
            <ListRow
              label="마감 리마인더"
              desc={
                pushPerm === 'blocked'
                  ? '기기 설정에서 알림이 꺼져 있어요 — 켜면 설정으로 이동'
                  : '내 할 일의 시작·마감 전에 기기에서 알려드려요'
              }
              right={
                <Switch
                  value={reminderOn}
                  disabled={reminder == null || pushPerm == null}
                  onValueChange={(v) => void onReminderToggle(v)}
                />
              }
            />
            <ListRow
              label="알림 시점"
              desc="시간이 있는 할 일 기준 · 날짜만 있는 할 일은 마감일 오전 9시에 알려드려요"
              vertical
              last
              right={
                <Segmented
                  options={REMINDER_LEAD_OPTIONS}
                  value={String(reminder?.leadMinutes ?? 30)}
                  onChange={(v) => onReminderLead(Number(v))}
                />
              }
            />
          </ListGroup>
        </>
      ) : null}
    </SettingsShell>
  );
}
