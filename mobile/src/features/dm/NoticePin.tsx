import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { shadow } from '@/shared/ui/tokens';

import type { DmMessage } from './api';

/**
 * 방 상단 고정 공지 배너 — tag==='NOTICE'인 최신 메시지 (웹 DmNoticePin 미러).
 * 탭하면 펼침/접힘, 확성기 아이콘 + 한 줄 요약.
 */
export function NoticePin({ notice, onPress }: { notice: DmMessage; onPress?: () => void }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const text = notice.content ?? '';
  if (!text) return null;

  return (
    <Pressable
      onPress={() => (expanded && onPress ? onPress() : setExpanded((v) => !v))}
      style={[styles.pin, { backgroundColor: theme.surface, borderColor: theme.border }, shadow.card]}>
      <View style={[styles.icon, { backgroundColor: theme.primary + '1A' }]}>
        <Ionicons name="megaphone" size={13} color={theme.primary} />
      </View>
      <ThemedText type="small" style={styles.text} numberOfLines={expanded ? 6 : 1}>
        {text}
      </ThemedText>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontWeight: '600' },
});
