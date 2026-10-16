import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import type { Todo } from '@/features/todo/api';
import { isTodoDone, useStatusMap } from '@/features/status/queries';
import { useTheme } from '@/hooks/use-theme';
import { statusColor } from '@/shared/ui/tone';

/**
 * 지도 하단 상시 바텀시트 — 위치 할 일 목록.
 * @gorhom/bottom-sheet: 리스트 어디서든 끌어 확장/축소(표준 제스처), 배경 딤 없음(지도 조작 유지).
 * `animatedPosition`에 시트 상단 Y를 받아 지도 FAB이 시트 위에 붙는다.
 */
export function LocationSheet({
  todos,
  onSelect,
  animatedPosition,
}: {
  todos: Todo[];
  onSelect: (id: number) => void;
  animatedPosition?: SharedValue<number>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // 커스텀 상태(st_<uuid>)는 STATUS_LABEL/statusColor 세 분기에 안 걸려 원시 키 + 빨강으로 나왔다
  const sm = useStatusMap();

  // peek(제목만) / 중간 — 콘텐츠가 적으면 큰 스냅이 무의미하므로 최대 스냅을 내용에 맞춘다(enableDynamicSizing)
  const snapPoints = useMemo(() => [84 + insets.bottom, '42%'], [insets.bottom]);

  return (
    <BottomSheet
      snapPoints={snapPoints}
      index={0}
      enableDynamicSizing
      maxDynamicContentSize={Dimensions.get('window').height * 0.42} // FAB 페이드 구간(0.44H~) 아래로 제한 — 겹침 방지
      animatedPosition={animatedPosition}
      backgroundStyle={[styles.bg, { backgroundColor: theme.surface }]}
      handleIndicatorStyle={{ backgroundColor: theme.textTertiary, opacity: 0.5, width: 38 }}>
      <View style={styles.titleWrap}>
        <ThemedText type="label" style={styles.title}>
          위치 할 일 ({todos.length})
        </ThemedText>
      </View>
      <BottomSheetFlatList
        data={todos}
        keyExtractor={(t: Todo) => String(t.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ThemedText type="small" style={styles.empty}>
            위치가 등록된 할 일이 없어요.{'\n'}검색하거나 지도를 길게 눌러 추가하세요.
          </ThemedText>
        }
        renderItem={({ item }: { item: Todo }) => (
          <Pressable
            onPress={() => item.id != null && onSelect(item.id)}
            style={({ pressed }) => [styles.row, { borderBottomColor: theme.divider }, pressed && { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="location" size={16} color={isTodoDone(item) ? theme.textSecondary : theme.primary} />
            <View style={styles.body}>
              <ThemedText type="default" numberOfLines={1}>
                {item.title}
              </ThemedText>
              {item.locationName ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {item.locationName}
                </ThemedText>
              ) : null}
            </View>
            {item.status ? (
              <ThemedText
                type="small"
                style={{ color: sm.color(item.status) ?? statusColor(theme, item.status, sm.category(item.status)), fontWeight: '700' }}>
                {sm.label(item.status)}
              </ThemedText>
            ) : null}
          </Pressable>
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bg: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  titleWrap: { alignItems: 'center', paddingBottom: 8 },
  title: { fontWeight: '700' },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flex: 1, gap: 2 },
  empty: { textAlign: 'center', opacity: 0.5, paddingVertical: 32, paddingHorizontal: 12 },
});
