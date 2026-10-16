import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { buildCustomColors, Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCustomThemeStore } from '@/shared/store/customThemeStore';
import { readableOn } from '@/shared/ui/tone';
import type { ThemeName } from '@/shared/ui/tokens';

export type ThemeMode = 'system' | 'custom' | ThemeName;

type PreviewPalette = { bg: string; accent: string; line: string; card: string; cardBorder: string };

/** 테마별 미니 미리보기 색 — Colors 팔레트(surface/primary 등)에서 파생, 웹 THEMES와 동일 키 */
function previewFor(name: ThemeName): PreviewPalette {
  const c = Colors[name];
  return {
    bg: c.surface,
    accent: c.primary,
    line: c.textDisabled,
    card: c.surfaceSelected,
    cardBorder: c.border,
  };
}

/** 라벨 — 웹 THEMES label 미러 + 시스템 + 커스텀 */
const LABEL: Record<ThemeMode, string> = {
  system: '시스템',
  custom: '커스텀',
  light: '라이트',
  dark: '다크',
  pink: '핑크',
  lavender: '라벤더',
  midnight: '미드나잇',
  mint: '민트',
  ocean: '오션',
};

function previewForColors(c: typeof Colors.light): PreviewPalette {
  return { bg: c.surface, accent: c.primary, line: c.textDisabled, card: c.surfaceSelected, cardBorder: c.border };
}

/** 모드 하나의 미니 앱 화면(상단바 + 카드 2개). system은 좌(라이트)/우(다크) 분할로 그린다. */
function MiniScreen({ palette, half }: { palette: PreviewPalette; half?: 'left' | 'right' }) {
  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }, half ? styles.half : null]}>
      <View style={styles.topbar}>
        <View style={[styles.dot, { backgroundColor: palette.accent }]} />
        <View style={{ height: 4, width: half ? '60%' : '42%', borderRadius: 2, backgroundColor: palette.line }} />
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <View style={[styles.cardDot, { backgroundColor: palette.accent, opacity: i === 0 ? 1 : 0.5 }]} />
          <View style={{ height: 4, width: i === 0 ? '70%' : '55%', borderRadius: 2, backgroundColor: palette.line }} />
        </View>
      ))}
    </View>
  );
}

/** 테마 선택 미니 미리보기 카드 — 웹 ThemePreview 미러(라이트/다크 + 컬러 테마). */
export function ThemePreview({ mode, selected, onPress }: { mode: ThemeMode; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const customBase = useCustomThemeStore((s) => s.base);
  const customAccent = useCustomThemeStore((s) => s.accent);
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={[styles.frame, { borderColor: selected ? theme.primary : theme.border }]}>
        {mode === 'system' ? (
          <View style={styles.split}>
            <MiniScreen palette={previewFor('light')} half="left" />
            <MiniScreen palette={previewFor('dark')} half="right" />
          </View>
        ) : mode === 'custom' ? (
          <MiniScreen palette={previewForColors(buildCustomColors(customBase, customAccent))} />
        ) : (
          <MiniScreen palette={previewFor(mode)} />
        )}
        {selected ? (
          <View style={[styles.check, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={12} color={readableOn(theme.primary)} />
          </View>
        ) : null}
      </View>
      <ThemedText
        type="small"
        style={{ textAlign: 'center', fontWeight: selected ? '800' : '500', color: selected ? theme.primary : theme.textSecondary }}>
        {LABEL[mode]}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 가로 스크롤 행에서 쓰이므로 고정 폭 (기존 flex:1 3분할 → 8개 스크롤)
  wrap: { width: 96, gap: 6 },
  frame: { position: 'relative', borderRadius: 12, overflow: 'hidden', borderWidth: 2 },
  split: { flexDirection: 'row' },
  screen: { height: 88, padding: 8, gap: 6 },
  half: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, padding: 5 },
  cardDot: { width: 6, height: 6, borderRadius: 2 },
  check: { position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
