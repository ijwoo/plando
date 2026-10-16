import { Component, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { captureError } from '@/shared/monitoring/sentry';
import { Button } from '@/shared/ui/Button';

/**
 * 루트 에러 바운더리 — JS 예외 시 흰 화면 대신 복구 화면.
 * "다시 열기"는 바운더리 상태만 리셋해 트리를 다시 마운트한다.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[AppErrorBoundary]', error);
    captureError(error, { boundary: 'root' });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle-outline" size={40} color="#94A3B8" />
        </View>
        <ThemedText type="title" style={styles.title}>
          문제가 발생했어요
        </ThemedText>
        <ThemedText type="small" style={styles.desc}>
          일시적인 오류일 수 있어요. 다시 열어도 반복되면 앱을 재실행해주세요.
        </ThemedText>
        <Button title="다시 열기" onPress={() => this.setState({ error: null })} style={styles.btn} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // 테마 훅을 못 쓰는 클래스 컴포넌트 + 크래시 상황 — 중립색 고정
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, backgroundColor: '#F0F2F5' },
  iconWrap: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4EAF3' },
  title: { fontWeight: '800', color: '#0F172A' },
  desc: { textAlign: 'center', color: '#475569', lineHeight: 19 },
  btn: { marginTop: 10, alignSelf: 'stretch' },
});
