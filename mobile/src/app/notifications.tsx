import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import type { Notification } from '@/features/notification/api';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/features/notification/queries';
import { useTheme } from '@/hooks/use-theme';
// (ListSectionHeader 대신 알림 전용 작은 섹션 라벨 사용)
import { shadow } from '@/shared/ui/tokens';
import { relativeTime } from '@/shared/utils/datetime';

/** 알림 타입 → 라인 아이콘/틴트 색 (백엔드 타입이 느슨해 키워드로 매칭) — 뱃지 박스 없이 아이콘 틴트만 */
function typeMeta(type?: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  const t = (type ?? '').toUpperCase();
  // 부분일치(includes)보다 먼저 본다 — 뒤에 두면 다른 규칙에 먼저 걸릴 수 있다
  if (t === 'AI_SCHEDULE') return { icon: 'sparkles-outline', color: '#8B5CF6' };
  if (t.includes('DM')) return { icon: 'chatbubble-ellipses-outline', color: '#3D7BFF' };
  if (t.includes('MENTION')) return { icon: 'at-outline', color: '#7C5CF0' };
  if (t.includes('COMMENT')) return { icon: 'chatbox-ellipses-outline', color: '#0EA5E9' };
  if (t.includes('ASSIGN')) return { icon: 'person-add-outline', color: '#10B981' };
  if (t.includes('DUE') || t.includes('REMIND')) return { icon: 'alarm-outline', color: '#F59E0B' };
  if (t.includes('RECRUIT')) return { icon: 'people-outline', color: '#F59E0B' };
  return { icon: 'notifications-outline', color: '#94A3B8' };
}

/** 인앱 알림 — 안읽음/읽음 섹션 그룹 리스트. 탭하면 해당 화면으로 이동. */
export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: items, isLoading, isError, error, refetch, isRefetching } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unread = items?.filter((n) => !n.read) ?? [];
  const read = items?.filter((n) => n.read) ?? [];

  // 라이트: 흰 카드 + 그림자(더보기·환경설정과 동일 톤). 다크: 평면(차콜 배경) 유지.
  const cardStyle = !theme.isDark ? [styles.lightCard, { backgroundColor: theme.surface }, shadow.card] : undefined;

  // DM_RECEIVED → 대화방, RECRUITMENT_* → 팀모집(상세 딥링크), WRAP_WEEKLY → 회고,
  // ROUTE_BRIEFING → 지도, AI_SCHEDULE → AI 화면, 그 외(할일 배정·댓글·멘션) → 할일 상세. PushBridge와 규칙을 맞춘다.
  const onPressItem = (item: Notification) => {
    if (item.id != null && !item.read) markRead.mutate(item.id);
    const type = (item.type ?? '').toUpperCase();
    if (type.startsWith('RECRUITMENT')) {
      const isQa = type === 'RECRUITMENT_QUESTION_RECEIVED' || type === 'RECRUITMENT_QUESTION_ANSWERED';
      router.push({
        pathname: '/recruitment',
        params: { ...(item.targetId != null ? { detail: String(item.targetId) } : {}), ...(isQa ? { tab: 'qa' } : {}) },
      });
      return;
    }
    if (type === 'WRAP_WEEKLY') {
      // 주간 회고는 서버가 targetId 없이 보낸다. 아래 null 가드보다 먼저 처리하지 않으면
      // /wrap 화면이 있는데도 행을 눌렀을 때 아무 데도 가지 않는다. (PushBridge와 동일 규칙)
      router.push('/wrap');
      return;
    }
    if (type === 'ROUTE_BRIEFING') {
      router.push('/map?route=1');
      return;
    }
    if (type === 'AI_SCHEDULE') {
      // 예약 실행 결과 — targetId 자리에 예약 id 가 온다. 그 질문을 다시 던져 결과를 보여준다.
      // 아래 null 가드보다 먼저 처리해야 행이 반응한다. (PushBridge와 동일 규칙)
      router.push(item.targetId != null ? `/chat?scheduleId=${item.targetId}` : '/chat');
      return;
    }
    // 갈 곳이 없는 알림 — 이동은 못 하지만 위에서 이미 읽음 처리가 되어 행이 눈에 띄게 바뀐다.
    // (완전한 무반응은 아니라 그대로 둔다)
    if (item.targetId == null) return;
    if (type.includes('DM')) router.push(`/dm/${item.targetId}`);
    else if (type.includes('COMMENT') || type.includes('MENTION'))
      router.push({ pathname: '/todo/[id]', params: { id: String(item.targetId), tab: 'comments' } });
    else router.push(`/todo/${item.targetId}`);
  };

  // 엣지-투-엣지 피드 행 — 첫 줄: 제목 + 시각, 둘째 줄: 메시지. 안읽음은 틴트 + 볼드 + 프라이머리 시각.
  const renderRow = (item: Notification, i: number, list: Notification[]) => {
    const meta = typeMeta(item.type);
    const unreadRow = !item.read;
    return (
      <Pressable
        key={item.id}
        onPress={() => onPressItem(item)}
        style={({ pressed }) => [
          styles.row,
          !theme.isDark && styles.rowLightPad,
          { borderBottomColor: theme.divider, borderBottomWidth: i === list.length - 1 ? 0 : StyleSheet.hairlineWidth },
          unreadRow && { backgroundColor: theme.primary + '0D' },
          pressed && { backgroundColor: theme.surfaceSelected },
        ]}>
        <Ionicons name={meta.icon} size={19} color={meta.color} style={styles.icon} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <ThemedText type="default" style={[styles.title, unreadRow && styles.titleUnread]} numberOfLines={1}>
              {item.title || item.message}
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.time, unreadRow && { color: theme.primary, opacity: 1, fontWeight: '600' }]}>
              {relativeTime(item.createdAt)}
            </ThemedText>
          </View>
          {item.title && item.message ? (
            <ThemedText type="small" style={[styles.msg, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.message}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '알림',
          headerRight: () =>
            unread.length ? (
              <Pressable onPress={() => markAllRead.mutate()} hitSlop={8}>
                <ThemedText type="link">모두 읽음</ThemedText>
              </Pressable>
            ) : null,
        }}
      />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <ThemedText type="default" style={[styles.err, { color: theme.danger }]}>
            {getApiErrorMessage(error)}
          </ThemedText>
        </View>
      ) : !items?.length ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="notifications-off-outline" size={30} color={theme.textTertiary} />
          </View>
          <ThemedText type="default" style={styles.empty}>
            알림이 없어요
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
          {unread.length ? (
            <>
              <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary }]}>안읽음 {unread.length}</ThemedText>
              <View style={cardStyle}>{unread.map((item, i) => renderRow(item, i, unread))}</View>
            </>
          ) : null}
          {read.length ? (
            <>
              <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textTertiary }]}>읽음</ThemedText>
              <View style={cardStyle}>{read.map((item, i) => renderRow(item, i, read))}</View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  err: {  },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  empty: { opacity: 0.5 },
  // 플랫 리스트 규격 — 컨테이너 패딩 16 + 행 패딩 H4/V11, 아이콘 22 라인, 제목 16/600
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  // 섹션 라벨 — iOS 그룹 헤더 톤(작고 조밀)
  sectionLabel: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2, marginTop: 18, marginBottom: 6, marginLeft: 2 },
  // 라이트: 회색 캔버스 위 흰 카드로 부양 — 안읽음 덩어리가 카드 경계로 명확해짐
  lightCard: { borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 4, paddingVertical: 9 },
  rowLightPad: { paddingHorizontal: 13 },
  icon: { width: 22, textAlign: 'center' },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  titleUnread: { fontWeight: '700' },
  msg: { fontSize: 12.5, lineHeight: 17 },
  time: { fontSize: 11.5, opacity: 0.45 },
});
