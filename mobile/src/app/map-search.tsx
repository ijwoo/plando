import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { buildPlacesHtml } from '@/features/map/mapHtml';
import { useMapSearchStore, type Place } from '@/features/map/searchStore';
import { KAKAO_JS_KEY, KAKAO_MAP_REFERRER } from '@/shared/config/env';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useTheme } from '@/hooks/use-theme';

/** 장소 검색 — DM 검색과 동일하게 네이티브 UISearchBar. 검색은 숨김 WebView의 Kakao Places로 수행. */
export default function MapSearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false); // 검색 요청~결과 사이 인디케이터
  const [failed, setFailed] = useState(false); // 검색기 자체가 실패 — '결과 없음'과 구분해서 보여준다
  const debounced = useDebounce(q, 300);
  const html = useState(() => buildPlacesHtml(KAKAO_JS_KEY))[0];

  // 응답 대기 타임아웃. 답이 오면(결과/오류/WebView 오류) **반드시 여기서 끈다** —
  // 예전엔 effect cleanup으로만 껐는데, 결과가 도착해도 deps(debounced/ready)는 그대로라
  // cleanup이 돌지 않았다. 그래서 정상적인 "결과 0건"이 8초 뒤 "검색하지 못했어요"로 뒤집혔다.
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearFailTimer = useCallback(() => {
    if (failTimer.current) {
      clearTimeout(failTimer.current);
      failTimer.current = null;
    }
  }, []);
  const armFailTimer = useCallback(
    (ms: number) => {
      clearFailTimer();
      failTimer.current = setTimeout(() => {
        failTimer.current = null;
        setSearching(false);
        setFailed(true);
      }, ms);
    },
    [clearFailTimer],
  );
  const failNow = useCallback(() => {
    clearFailTimer();
    setSearching(false);
    setFailed(true);
  }, [clearFailTimer]);

  useEffect(() => {
    const query = debounced.trim();
    if (!query) {
      clearFailTimer(); // 입력을 비웠으면 이전 검색의 실패 타이머까지 취소
      return;
    }
    if (!ready) {
      // 검색기가 아직 준비되지 않았다. 예전엔 여기서 그냥 return 해서, 준비가 영영 안 되면
      // (오프라인·JS키 도메인 거절) 스피너가 무한히 돌았다. 시간을 두고 실패로 확정한다.
      armFailTimer(6000);
      return clearFailTimer;
    }
    webRef.current?.injectJavaScript(`window.__search(${JSON.stringify(query)});true;`);
    // 주입은 됐는데 응답이 없는 경우(SDK 내부 오류)도 스피너를 붙잡아두지 않는다.
    armFailTimer(8000);
    return clearFailTimer;
  }, [debounced, ready, armFailTimer, clearFailTimer]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'results') {
        // 결과 0건도 '정상 응답'이다 — 타이머를 끄지 않으면 8초 뒤 실패로 뒤집힌다
        clearFailTimer();
        setResults(msg.results ?? []);
        setSearching(false);
        setFailed(false);
      } else if (msg.type === 'error') {
        // 카카오가 오류를 준 것을 빈 결과로 뭉개면 "검색 결과가 없습니다"라는 거짓말이 된다.
        setResults([]);
        failNow();
      }
    } catch {
      /* ignore */
    }
  };

  const pick = (p: Place) => {
    useMapSearchStore.getState().pick(p);
    router.back();
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '장소 검색',
          headerSearchBarOptions: {
            placeholder: '장소·주소 검색',
            autoFocus: true,
            hideWhenScrolling: false,
            onChangeText: (e) => {
              const t = e.nativeEvent.text;
              setQ(t);
              // 입력~결과 도착까지 스피너 (이벤트 핸들러에서만 setState)
              setSearching(!!t.trim());
              setFailed(false);
              if (!t.trim()) {
                clearFailTimer(); // 지우자마자 이전 검색의 실패 타이머가 뒤늦게 터지지 않게
                setResults([]);
              }
            },
            onCancelButtonPress: () => router.back(),
          },
        }}
      />
      {/* 검색 엔진용 숨김 WebView (Kakao Places) */}
      <WebView
        ref={webRef}
        style={styles.hidden}
        originWhitelist={['*']}
        source={{ html, baseUrl: KAKAO_MAP_REFERRER }}
        javaScriptEnabled
        onMessage={onMessage}
        onError={failNow}
        onHttpError={failNow}
      />
      <FlatList
        data={results}
        keyExtractor={(p) => p.name + p.lat}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          searching ? (
            <ActivityIndicator style={styles.empty} />
          ) : failed ? (
            <ThemedText type="small" style={[styles.empty, { color: theme.danger }]}>
              장소를 검색하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.
            </ThemedText>
          ) : (
            <ThemedText type="small" style={styles.empty}>
              {debounced.trim() ? '검색 결과가 없습니다' : '장소나 주소를 입력하세요.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => pick(item)} style={[styles.row, { borderBottomColor: theme.divider }]}>
            <Ionicons name="location-outline" size={18} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText type="default" numberOfLines={1}>
                {item.name}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                {item.address}
              </ThemedText>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { width: 0, height: 0, position: 'absolute', opacity: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
});
