import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/themed-text';
import { Press } from '@/shared/ui/Press';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/shared/ui/Avatar';
import { tickHaptic } from '@/shared/ui/haptics';
import { readableOn } from '@/shared/ui/tone';
import { relativeTime } from '@/shared/utils/datetime';
import type { DmRoom } from './api';

const ACTION_W = 76;

export function RoomRow({
  room,
  onPress,
  suggestionCount = 0,
  onMarkRead,
}: {
  room: DmRoom;
  onPress: () => void;
  /** 대기 중 AI 할 일 제안 수 — ✨ 뱃지 */
  suggestionCount?: number;
  /** 왼쪽 스와이프 액션 '읽음' — 방 읽음 처리 (없으면 스와이프 비활성) */
  onMarkRead?: () => void;
}) {
  const theme = useTheme();
  // 스와이프 상태 — 할 일 리스트(TaskListRow)와 동일한 탭/스와이프 충돌 방지 패턴
  const ref = useRef<SwipeableMethods>(null);
  const openRef = useRef(false); // 액션 메뉴가 열려 있는지
  const lastDragAt = useRef(0); // 직전 스와이프 시각 — 스와이프가 탭으로 잡혀 방으로 들어가는 충돌 방지
  const isGroup = room.isGroup;
  const name = isGroup ? (room.groupName ?? '그룹') : (room.partnerName ?? '알 수 없음');
  const img = isGroup ? room.groupImageUrl : room.partnerProfileImageUrl;
  const unread = room.unreadCount ?? 0;

  // 행 탭: 메뉴가 열려 있으면 닫기, 방금 스와이프한 직후면 무시, 아니면 방으로
  const handlePress = () => {
    if (openRef.current) {
      ref.current?.close();
      return;
    }
    if (Date.now() - lastDragAt.current < 250) return;
    onPress();
  };

  // 왼쪽 스와이프(오른쪽에서 등장) = 읽음 처리
  const renderRightActions = () => (
    <View style={styles.actions}>
      <Pressable
        onPress={() => {
          ref.current?.close();
          tickHaptic();
          onMarkRead?.();
        }}
        accessibilityLabel="읽음으로 표시"
        accessibilityRole="button"
        style={[styles.swipeAction, { backgroundColor: theme.primary }]}>
        <Ionicons name="checkmark-done" size={18} color={readableOn(theme.primary)} />
        <Text style={[styles.swipeActionLabel, { color: readableOn(theme.primary) }]}>읽음</Text>
      </Pressable>
    </View>
  );

  const content = (
    <Press
      onPress={onMarkRead ? handlePress : onPress}
      style={[styles.row, { backgroundColor: theme.isDark ? theme.background : theme.surface }]}
      pressedStyle={{ backgroundColor: theme.surfaceSelected }}
      scale={1}>
      <Avatar person={{ name, profileImageUrl: img }} size={50} />
      <View style={[styles.body, { borderBottomColor: theme.divider }]}>
        <View style={styles.head}>
          <ThemedText type="default" style={styles.name} numberOfLines={1}>
            {name}
          </ThemedText>
          {room.lastMessageAt ? (
            <ThemedText type="small" style={styles.time}>
              {relativeTime(room.lastMessageAt)}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.previewRow}>
          <ThemedText type="small" style={[styles.preview, { color: unread > 0 ? theme.text : theme.textSecondary }]} numberOfLines={1}>
            {room.lastMessage ?? '대화를 시작해보세요'}
          </ThemedText>
          {suggestionCount > 0 ? (
            <View style={[styles.suggest, { backgroundColor: theme.primary + '14' }]}>
              <Ionicons name="sparkles" size={10} color={theme.primary} />
              <ThemedText type="small" style={[styles.suggestText, { color: theme.primary }]}>
                {suggestionCount}
              </ThemedText>
            </View>
          ) : null}
          {unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText type="small" style={[styles.badgeText, { color: readableOn(theme.primary) }]}>
                {unread > 99 ? '99+' : unread}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Press>
  );

  if (!onMarkRead) return content;
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1}
      rightThreshold={36}
      overshootRight={false}
      onSwipeableOpenStartDrag={() => { lastDragAt.current = Date.now(); }}
      onSwipeableCloseStartDrag={() => { lastDragAt.current = Date.now(); }}
      onSwipeableWillOpen={() => { openRef.current = true; }}
      onSwipeableWillClose={() => { openRef.current = false; }}
      renderRightActions={renderRightActions}>
      {content}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16 },
  body: { flex: 1, gap: 3, paddingVertical: 12, paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name: { flex: 1, fontWeight: '700' },
  time: { opacity: 0.5 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, height: 20, borderRadius: 10 },
  suggestText: { fontWeight: '700', fontSize: 11 },
  badgeText: { fontWeight: '700', fontSize: 11 },
  actions: { flexDirection: 'row' },
  swipeAction: { width: ACTION_W, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swipeActionLabel: { fontSize: 12, fontWeight: '700' },
});
