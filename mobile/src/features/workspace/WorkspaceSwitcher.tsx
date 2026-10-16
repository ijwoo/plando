import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { roleLabel } from '@/features/workspace/permissions';
import { useMyWorkspaces } from '@/features/workspace/queries';
import { useTheme } from '@/hooks/use-theme';
import { colorFromName, secureUrl } from '@/shared/ui/Avatar';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';

/**
 * 워크스페이스 전환 — 화면 상단(노치)에서 쭉 내려오는 글래스 시트.
 * 아바타 이미지·체크·부제 표현(네이티브 메뉴는 원격 이미지 불가).
 */
export function WorkspaceSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: workspaces } = useMyWorkspaces();
  const activeId = useWorkspaceStore((s) => s.activeId);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const insets = useSafeAreaInsets();
  const glass = isLiquidGlassAvailable();

  const onSelect = (id?: number) => {
    if (id != null && id !== activeId) {
      setActive(id);
      qc.invalidateQueries(); // 워크스페이스 스코프 데이터 전체 갱신
    }
    onClose();
  };

  const goManage = () => {
    onClose();
    setTimeout(() => router.push('/workspaces'), 120);
  };

  const Sheet = glass ? GlassView : View;
  const sheetProps = glass ? { glassEffectStyle: 'regular' as const } : { style: { backgroundColor: theme.surface } };

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.fill}>
        {/* 백드롭만 페이드 — GlassView는 부모 opacity<1이면 배경이 사라져 시트엔 적용 안 함 */}
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
          <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
        </Animated.View>
        <Animated.View entering={SlideInUp.duration(260)} exiting={SlideOutUp.duration(200)} style={styles.sheetWrap}>
          <Sheet {...sheetProps} style={[styles.sheet, { paddingTop: insets.top + 10 }, glass ? null : { backgroundColor: theme.surface }]}>
            <ThemedText type="label" style={[styles.title, { color: theme.textSecondary }]}>
              워크스페이스
            </ThemedText>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {workspaces?.map((w) => {
                const sel = w.workspaceId === activeId;
                const name = w.workspaceName ?? '워크스페이스';
                const url = secureUrl(w.iconImageUrl);
                return (
                  <Pressable
                    key={w.workspaceId}
                    onPress={() => onSelect(w.workspaceId)}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
                    {url ? (
                      <Image source={{ uri: url }} style={styles.icon} contentFit="cover" />
                    ) : (
                      <View style={[styles.icon, { backgroundColor: colorFromName(name) }]}>
                        <ThemedText style={styles.iconText}>{name.slice(0, 1)}</ThemedText>
                      </View>
                    )}
                    <View style={styles.body}>
                      <ThemedText type="default" numberOfLines={1} style={styles.name}>
                        {name}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {roleLabel(w.role)} · 멤버 {w.memberCount ?? 1}
                      </ThemedText>
                    </View>
                    {sel ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <Pressable onPress={goManage} style={({ pressed }) => [styles.action, pressed && { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="add" size={20} color={theme.text} />
              <ThemedText type="default">추가 관리</ThemedText>
            </Pressable>
          </Sheet>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  sheet: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  title: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  body: { flex: 1, gap: 1 },
  name: { fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4, marginHorizontal: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
});
