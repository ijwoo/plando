import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useRooms } from '@/features/dm/queries';
import { tickHaptic } from '@/shared/ui/haptics';
import { tabRetap } from '@/shared/ui/tabRetap';

/**
 * 네이티브 바텀 탭 — iOS에서는 실제 UITabBar(iOS 26 Liquid Glass), Android에서는
 * 네이티브 Material 탭바를 렌더한다. 기존 앱과 동일하게 홈·할일·캘린더·메시지·더보기 5탭.
 * (지도·팀모집은 탭이 아니라 더보기 하위에 위치)
 * 탭 전환 시 햅틱(tabPress)으로 피드백.
 */
// 탭 프레스 — 햅틱 + 재탭 시 맨 위로(구독 화면에서 포커스 가드)
const listenersFor = (tab: string) => ({
  tabPress: () => {
    tickHaptic();
    tabRetap.emit(tab);
  },
});
const L = {
  index: listenersFor('index'),
  todo: listenersFor('todo'),
  calendar: listenersFor('calendar'),
  dm: listenersFor('dm'),
  more: listenersFor('more'),
};

export default function TabsLayout() {
  const { data: rooms } = useRooms();
  const dmUnread = (rooms ?? []).reduce((n, r) => n + (r.unreadCount ?? 0), 0);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index" listeners={L.index}>
        <NativeTabs.Trigger.Icon sf="house" />
        <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="todo" listeners={L.todo}>
        <NativeTabs.Trigger.Icon sf="checklist" />
        <NativeTabs.Trigger.Label>할 일</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar" listeners={L.calendar}>
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>캘린더</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dm" listeners={L.dm}>
        <NativeTabs.Trigger.Icon sf="message" />
        <NativeTabs.Trigger.Label>메시지</NativeTabs.Trigger.Label>
        {dmUnread > 0 ? <NativeTabs.Trigger.Badge>{dmUnread > 99 ? '99+' : String(dmUnread)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more" listeners={L.more}>
        <NativeTabs.Trigger.Icon sf="ellipsis" />
        <NativeTabs.Trigger.Label>더보기</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
