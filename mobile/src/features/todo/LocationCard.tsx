import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { buildStaticMapHtml } from '@/features/map/mapHtml';
import type { Todo } from '@/features/todo/api';
import { KAKAO_JS_KEY, KAKAO_MAP_REFERRER } from '@/shared/config/env';
import { useTheme } from '@/hooks/use-theme';

/** 할 일 상세 위치 카드 — 위치명/주소 + 정적 카카오 미니맵(탭하면 지도 화면으로). */
export function LocationCard({ todo }: { todo: Todo }) {
  const theme = useTheme();
  const router = useRouter();
  const lat = todo.locationLat;
  const lng = todo.locationLng;
  const hasCoords = lat != null && lng != null;
  const hasLocation = !!(todo.locationName || todo.locationAddress || hasCoords);

  const html = useMemo(
    () => (hasCoords ? buildStaticMapHtml(KAKAO_JS_KEY, lat as number, lng as number) : ''),
    [hasCoords, lat, lng],
  );

  if (!hasLocation) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.head}>
        <View style={[styles.iconBox, { backgroundColor: theme.primary + '22' }]}>
          <Ionicons name="location" size={18} color={theme.primary} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.name} numberOfLines={1}>
            {todo.locationName || '저장된 위치'}
          </ThemedText>
          {todo.locationAddress ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={2}>
              {todo.locationAddress}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {hasCoords ? (
        <View style={styles.mapBox}>
          <WebView
            style={styles.map}
            originWhitelist={['*']}
            source={{ html, baseUrl: KAKAO_MAP_REFERRER }}
            javaScriptEnabled
            scrollEnabled={false}
            pointerEvents="none"
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => router.push('/map')} />
          <View style={styles.chip}>
            <Ionicons name="map" size={13} color="#DCEBFF" />
            <ThemedText type="small" style={styles.chipText}>
              지도에서 보기
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  name: { fontWeight: '800' },
  mapBox: { height: 160, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1, backgroundColor: 'transparent' },
  chip: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 11, borderRadius: 999, backgroundColor: 'rgba(9,18,36,0.9)' },
  chipText: { color: '#DCEBFF', fontWeight: '700' },
});
