import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { buildEditorHtml } from './editorHtml';

/**
 * 본문 WYSIWYG 에디터 — 웹앱과 동일한 TipTap+tiptap-markdown(WebView).
 * 마크다운 in/out이라 웹과 완전 호환. CDN 로드 실패(오프라인 등) 시 onFallback으로
 * 기존 플레인 텍스트 편집으로 넘어간다.
 */
export function RichEditorSheet({
  initialMarkdown,
  onSave,
  onClose,
  onFallback,
}: {
  initialMarkdown: string;
  onSave: (markdown: string) => void;
  onClose: () => void;
  onFallback: () => void;
}) {
  const theme = useTheme();
  // RN Modal은 별도 네이티브 계층이라 SafeAreaView가 인셋을 못 받는다 — 부모 컨텍스트 훅으로 직접 패딩
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef(initialMarkdown);

  const html = useMemo(
    () =>
      buildEditorHtml({
        bg: theme.surface,
        text: theme.text,
        secondary: theme.textSecondary,
        primary: theme.primary,
        divider: theme.divider,
      }),
    [theme],
  );

  const onMessage = (raw: string) => {
    try {
      const m = JSON.parse(raw) as { type: string; markdown?: string; message?: string };
      if (m.type === 'ready') {
        setReady(true);
        webRef.current?.postMessage(JSON.stringify({ type: 'init', markdown: initialMarkdown }));
      } else if (m.type === 'change') {
        latest.current = m.markdown ?? '';
      } else if (m.type === 'error') {
        onFallback(); // 에디터 로드 실패 — 플레인 편집으로
      }
    } catch {
      // 무시
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.surface, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}>
        {/* 헤더 — 취소 / 완료 */}
        <View style={[styles.header, { borderBottomColor: theme.divider }]}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="취소">
            <ThemedText type="default" style={{ color: theme.textSecondary }}>
              취소
            </ThemedText>
          </Pressable>
          <ThemedText type="default" style={styles.title}>
            내용 편집
          </ThemedText>
          <Pressable onPress={() => onSave(latest.current)} hitSlop={8} accessibilityLabel="완료">
            <ThemedText type="default" style={{ color: theme.primary, fontWeight: '800' }}>
              완료
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.body}>
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            // esm.sh 모듈 로드를 위해 https 베이스 필요 (지도 WebView와 동일 패턴)
            source={{ html, baseUrl: 'https://plando.imjaewoo.dev' }}
            onMessage={(e) => onMessage(e.nativeEvent.data)}
            onError={onFallback}
            javaScriptEnabled
            hideKeyboardAccessoryView
            style={styles.web}
          />
          {!ready ? (
            <View style={[styles.loading, { backgroundColor: theme.surface }]} pointerEvents="none">
              <ActivityIndicator />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontWeight: '700' },
  body: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
