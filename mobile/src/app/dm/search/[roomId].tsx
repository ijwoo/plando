import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useSearchInRoom } from '@/features/dm/queries';
import { dmSearchFocus } from '@/features/dm/searchFocusStore';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useTheme } from '@/hooks/use-theme';
import { relativeTime } from '@/shared/utils/datetime';

const MIN_QUERY = 2; // 통합 검색과 동일 — 1글자 검색은 노이즈·부하만 커서 막는다

/** 방 내 메시지 검색 — 네이티브 UISearchBar(headerSearchBarOptions) 사용. */
export default function DmSearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const id = Number(roomId);

  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const longEnough = debounced.trim().length >= MIN_QUERY;
  const search = useSearchInRoom(id, longEnough ? debounced : '');

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '검색',
          headerSearchBarOptions: {
            placeholder: '대화 내용 검색',
            autoFocus: true,
            hideWhenScrolling: false,
            onChangeText: (e) => setQ(e.nativeEvent.text),
            onCancelButtonPress: () => router.back(),
          },
        }}
      />
      {!longEnough ? (
        <View style={styles.center}>
          <ThemedText type="small" style={styles.hint}>
            두 글자 이상 입력해주세요.
          </ThemedText>
        </View>
      ) : search.isFetching ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : search.isError ? (
        // 실패를 "검색 결과가 없습니다"로 뭉개지 않는다 — 없는 것과 못 불러온 것은 다르다
        <View style={styles.center}>
          <ThemedText type="default" style={[styles.errorText, { color: theme.danger }]}>
            {getApiErrorMessage(search.error)}
          </ThemedText>
          <Pressable onPress={() => void search.refetch()} accessibilityRole="button">
            <ThemedText type="link">다시 시도</ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={search.data ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            debounced.trim() ? (
              <ThemedText type="small" style={styles.empty}>
                검색 결과가 없습니다
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (!item.sentAt) return;
                dmSearchFocus.set(id, item.sentAt); // 기존 방이 focus 시 소비 → 해당 메시지로 스크롤
                router.back();
              }}
              style={({ pressed }) => [styles.item, { borderBottomColor: theme.divider }, pressed && { backgroundColor: theme.surfaceSelected }]}>
              <View style={styles.head}>
                <ThemedText type="small" style={styles.sender}>
                  {item.senderName ?? ''}
                </ThemedText>
                <ThemedText type="small" style={styles.time}>
                  {relativeTime(item.sentAt)}
                </ThemedText>
              </View>
              <ThemedText type="default" numberOfLines={2}>
                {item.content ?? '[파일]'}
              </ThemedText>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  errorText: { textAlign: 'center' },
  list: { padding: 16 },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 40 },
  hint: { textAlign: 'center', opacity: 0.5 },
  item: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  sender: { opacity: 0.6 },
  time: { opacity: 0.5 },
});
