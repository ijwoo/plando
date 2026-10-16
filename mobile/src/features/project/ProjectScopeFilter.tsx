import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useProjects } from '@/features/project/queries';
import { projectIcon } from '@/features/project/projectIcons';
import { useProjectFilter, type ProjectScope } from '@/shared/store/projectStore';
import { tickHaptic } from '@/shared/ui/haptics';
import { radius, shadow } from '@/shared/ui/tokens';
import { sheetBottomInset } from '@/shared/ui/sheetInset';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * 할 일 탭 상단 — 글로벌 프로젝트 스코프(전체/인박스/프로젝트) 드롭다운 + 바텀 시트.
 * 웹 MobileProjectFilter 미러.
 */
export function ProjectScopeFilter({ pendingCount }: { pendingCount?: number }) {
  const theme = useTheme();
  const { data: projects } = useProjects();
  const activeProjectId = useProjectFilter((s) => s.activeProjectId);
  const setActive = useProjectFilter((s) => s.setActive);
  const [open, setOpen] = useState(false);

  const isAll = activeProjectId == null;
  const isInbox = activeProjectId === 'inbox';
  const active = projects?.find((p) => p.id === activeProjectId);
  const scopeLabel = isAll ? '전체 할 일' : isInbox ? '인박스' : (active?.name ?? '프로젝트');

  const pick = (id: ProjectScope) => {
    tickHaptic();
    setOpen(false);
    setActive(id);
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.trigger, { borderBottomColor: theme.divider, backgroundColor: theme.background }]}>
        {isAll ? (
          <Ionicons name="albums-outline" size={15} color={theme.textSecondary} />
        ) : isInbox ? (
          <Ionicons name="file-tray-outline" size={15} color={theme.textSecondary} />
        ) : (
          <View style={[styles.badgeSm, { backgroundColor: active?.color ?? theme.textSecondary }]}>
            <Ionicons name={projectIcon(active?.icon)} size={11} color="#fff" />
          </View>
        )}
        <ThemedText type="label" style={{ fontWeight: '700' }} numberOfLines={1}>
          {scopeLabel}
        </ThemedText>
        {pendingCount != null ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {pendingCount}개 남음
          </ThemedText>
        ) : null}
        <View style={styles.flex} />
        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
      </Pressable>

      <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <Sheet theme={theme} onClose={() => setOpen(false)}>
          <ThemedText type="label" style={styles.sheetTitle}>
            보기 범위
          </ThemedText>

          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
            <SheetRow
              theme={theme}
              icon={<Ionicons name="albums-outline" size={18} color={isAll ? theme.primary : theme.textSecondary} />}
              label="전체 할 일"
              selected={isAll}
              onPress={() => pick(null)}
            />
            <SheetRow
              theme={theme}
              icon={<Ionicons name="file-tray-outline" size={18} color={isInbox ? theme.primary : theme.textSecondary} />}
              label="인박스"
              selected={isInbox}
              onPress={() => pick('inbox')}
            />

            {projects && projects.length > 0 ? (
              <ThemedText type="small" style={[styles.groupLabel, { color: theme.textSecondary }]}>
                프로젝트
              </ThemedText>
            ) : null}
            {(projects ?? []).map((p) => (
              <SheetRow
                key={p.id}
                theme={theme}
                icon={
                  <View style={[styles.badge, { backgroundColor: p.color ?? theme.textSecondary }]}>
                    <Ionicons name={projectIcon(p.icon)} size={13} color="#fff" />
                  </View>
                }
                label={p.name ?? '프로젝트'}
                count={Math.max(0, (p.todoCount ?? 0) - (p.doneCount ?? 0))}
                tint={p.color}
                selected={activeProjectId === p.id}
                onPress={() => pick(p.id ?? null)}
              />
            ))}
          </ScrollView>
        </Sheet>
      </Modal>
    </>
  );
}

function SheetRow({
  theme,
  icon,
  label,
  count,
  selected,
  tint,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  icon: React.ReactNode;
  label: string;
  count?: number;
  selected?: boolean;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, selected && { backgroundColor: (tint ?? theme.primary) + '22' }]}>
      <View style={styles.rowIcon}>{icon}</View>
      <ThemedText type="default" style={[styles.rowLabel, { fontWeight: selected ? '700' : '500' }]} numberOfLines={1}>
        {label}
      </ThemedText>
      {count != null ? (
        <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
          {count}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** 드래그로 닫는 바텀 시트 (Modal 내부). calendar의 DaySheet 패턴과 동일. */
function Sheet({ theme, onClose, children }: { theme: ReturnType<typeof useTheme>; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const ty = useSharedValue(900);
  const [sheetH, setSheetH] = useState(900);

  /* eslint-disable react-hooks/immutability -- Reanimated shared value(.value)는 공식 API */
  useEffect(() => {
    ty.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [ty]);

  const dismiss = () => {
    ty.value = withTiming(sheetH, { duration: 220, easing: Easing.in(Easing.cubic) }, (f) => {
      if (f) runOnJS(onClose)();
    });
  };

  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        ty.value = withTiming(sheetH, { duration: 200 }, (f) => {
          if (f) runOnJS(onClose)();
        });
      } else {
        ty.value = withTiming(0, { duration: 160 });
      }
    });
  /* eslint-enable react-hooks/immutability */

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: sheetH > 0 ? 1 - ty.value / sheetH : 1 }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedPressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} onPress={dismiss} />
      <GestureDetector gesture={pan}>
        <Animated.View
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
          style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: sheetBottomInset(insets.bottom) + 16 }, sheetStyle, shadow.float]}>
          <View style={[styles.handle, { backgroundColor: theme.textSecondary }]} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  badge: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  badgeSm: { width: 16, height: 16, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { textAlign: 'center', fontWeight: '700', marginBottom: 12 },
  // flexShrink: 시트 maxHeight 안에서 줄어들며 스크롤되도록 (없으면 긴 목록이 잘린 채 스크롤 불가)
  sheetScroll: { flexShrink: 1, paddingHorizontal: 10 },
  sheetList: { paddingBottom: 8, gap: 2 },
  groupLabel: { fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md },
  rowIcon: { width: 24, alignItems: 'center' },
  rowLabel: { flex: 1 },
});
