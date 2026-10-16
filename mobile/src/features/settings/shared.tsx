import type { ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiErrorMessage } from '@/api/error';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** 설정 서브 화면 공통 셸 — 헤더 + 로딩/에러 + 그룹 리스트 스크롤 */
export function SettingsShell({
  title,
  loading,
  error,
  children,
}: {
  title: string;
  loading?: boolean;
  error?: unknown;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: true, title }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText type="default" style={{ color: theme.danger }}>
            {getApiErrorMessage(error)}
          </ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── 옵션 상수 (설정 서브 화면 공용) ──────────────────────────────
export const CALENDAR_VIEWS = [
  { value: 'month', label: '월' },
  { value: 'week', label: '주' },
  { value: 'day', label: '일' },
];
export const WEEK_START = [
  { value: 'sun', label: '일요일' },
  { value: 'mon', label: '월요일' },
];
export const DUE_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'today', label: '오늘' },
  { value: 'tomorrow', label: '내일' },
  { value: 'week', label: '이번 주' },
];
export const ARCHIVE_OPTIONS = [
  { value: '0', label: '안 함' },
  { value: '7', label: '1주' },
  { value: '14', label: '2주' },
  { value: '30', label: '1개월' },
];
// 웹 THEMES 키 순서 미러 + 맨 앞 시스템 + 맨 뒤 커스텀 (backend settings.themeMode와 왕복)
export const THEME_MODES = ['system', 'light', 'dark', 'pink', 'lavender', 'midnight', 'mint', 'ocean', 'custom'] as const;
export const THEME_LABELS: Record<string, string> = {
  system: '시스템',
  light: '라이트',
  dark: '다크',
  pink: '핑크',
  lavender: '라벤더',
  midnight: '미드나잇',
  mint: '민트',
  ocean: '오션',
  custom: '커스텀',
};

/** OS 푸시 권한 상태 — blocked = 영구 거부(요청 불가, 앱 설정으로 안내). null = 확인 불가(네이티브 모듈 없음 등). */
export type PushPerm = 'granted' | 'undetermined' | 'blocked' | null;

export async function getPushPermState(): Promise<PushPerm> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.status === 'granted') return 'granted';
    if (p.status === 'undetermined' || p.canAskAgain) return 'undetermined';
    return 'blocked';
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  content: { padding: 16, paddingBottom: 32 },
});
