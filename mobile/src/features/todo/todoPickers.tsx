import { useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { ListRow } from '@/shared/ui/List';
import { tickHaptic } from '@/shared/ui/haptics';
import { radius, shadow } from '@/shared/ui/tokens';
import { sheetBottomInset } from '@/shared/ui/sheetInset';
import { toDateString } from '@/shared/utils/datetime';
import { formatMonthDay } from './todoFilters';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type Option<T> = { value: T; label: string; color?: string; icon?: keyof typeof Ionicons.glyphMap };

/** 드래그로 닫는 공용 바텀 시트 (Modal로 감싸 사용). dim은 시트 이동과 분리된 독립 페이드. */
export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose}>
      <Sheet theme={theme} onClose={onClose}>
        {children}
      </Sheet>
    </Modal>
  );
}

/** 내부 시트 본체 (애니메이션). */
function Sheet({ theme, onClose, children }: { theme: ReturnType<typeof useTheme>; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const ty = useSharedValue(900);
  const op = useSharedValue(0); // backdrop 투명도 — 시트 이동과 분리(고정 오버레이 페이드)
  const [sheetH, setSheetH] = useState(900);
  const [kb, setKb] = useState(0); // 키보드 높이 — 입력 시 시트를 키보드 위로 올림

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /* eslint-disable react-hooks/immutability -- Reanimated shared value(.value)는 공식 API */
  useEffect(() => {
    ty.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    op.value = withTiming(1, { duration: 180 });
  }, [ty, op]);
  const dismiss = () => {
    op.value = withTiming(0, { duration: 180 });
    ty.value = withTiming(sheetH, { duration: 200, easing: Easing.in(Easing.cubic) }, (f) => f && runOnJS(onClose)());
  };
  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 800) {
        op.value = withTiming(0, { duration: 180 });
        ty.value = withTiming(sheetH, { duration: 190 }, (f) => f && runOnJS(onClose)());
      } else {
        ty.value = withTiming(0, { duration: 150 });
      }
    });
  /* eslint-enable react-hooks/immutability */

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: op.value }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedPressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} onPress={dismiss} />
      <GestureDetector gesture={pan}>
        <Animated.View
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              bottom: kb,
              paddingBottom: kb > 0 ? 16 : sheetBottomInset(insets.bottom) + 16,
              // 시트는 bottom:kb 만큼 떠오르므로, 기본 70%를 그대로 두면 키보드가 올라왔을 때
              // 상단이 노치/상태바를 침범한다. 남은 화면 안에 들어오도록 상한을 함께 건다.
              maxHeight: Math.min(winH * 0.7, winH - kb - insets.top - 12),
            },
            sheetStyle,
            shadow.float,
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.textSecondary }]} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** 옵션 단일 선택 시트 — 제목 + 행(아이콘/색점 + 라벨 + 체크). */
export function OptionSheet<T extends string | number>({
  open,
  onClose,
  title,
  value,
  options,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  value: T;
  options: Option<T>[];
  onSelect: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose}>
      <Sheet theme={theme} onClose={onClose}>
        <ThemedText type="label" style={styles.sheetTitle}>
          {title}
        </ThemedText>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => {
                  tickHaptic();
                  onSelect(o.value);
                  onClose();
                }}
                style={[styles.optRow, selected && { backgroundColor: (o.color ?? theme.primary) + '22' }]}>
                {o.icon ? (
                  <Ionicons name={o.icon} size={18} color={o.color ?? theme.textSecondary} style={styles.optIcon} />
                ) : o.color ? (
                  <View style={[styles.dot, { backgroundColor: o.color }]} />
                ) : (
                  <View style={styles.optIcon} />
                )}
                <ThemedText type="default" style={[styles.optLabel, { fontWeight: selected ? '700' : '500' }]} numberOfLines={1}>
                  {o.label}
                </ThemedText>
                {selected ? <Ionicons name="checkmark" size={18} color={o.color ?? theme.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </Modal>
  );
}

/** 메타 칩 (추가 모달) — 아이콘 + 라벨 + chevron-down. */
export function Chip({
  icon,
  label,
  color,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  active?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: active ? theme.primary : theme.border }]}>
      <Ionicons name={icon} size={15} color={color ?? theme.textSecondary} />
      <ThemedText type="small" style={[styles.chipLabel, { color: active ? theme.text : theme.textSecondary, fontWeight: '700' }]} numberOfLines={1}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-down" size={13} color={theme.textSecondary} />
    </Pressable>
  );
}

/** 단일 선택 칩 — Chip + OptionSheet 결합. */
export function SelectChip<T extends string | number>({
  icon,
  value,
  options,
  onChange,
  title,
  color,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  title: string;
  color?: string;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <Chip icon={icon} label={cur?.label ?? title} color={color} active={active} onPress={() => setOpen(true)} />
      <OptionSheet open={open} onClose={() => setOpen(false)} title={title} value={value} options={options} onSelect={onChange} />
    </>
  );
}

/**
 * 네이티브 compact 데이트피커 — 한 번 탭하면 iOS 캘린더 팝오버가 바로 뜸(시트/인라인 X).
 * 항상 compact 핀을 렌더(빈 값은 오늘 표시) → 더블탭 없이 한 번에 달력. 값 있으면 ✕로 비우기.
 */
export function CompactDate({ value, onChange, onClear }: { value?: string; onChange: (d?: string) => void; onClear?: () => void }) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  // 값이 없으면 네이티브 피커가 '오늘'을 보여줘 설정된 것처럼 오해됨 → '없음'으로 표시(탭하면 오늘로 설정)
  if (!value) {
    return (
      <Pressable onPress={() => onChange(toDateString(new Date()))} hitSlop={6}>
        <ThemedText type="default" style={{ color: theme.textSecondary }}>
          없음
        </ThemedText>
      </Pressable>
    );
  }
  return (
    <View style={styles.compactRow}>
      <DateTimePicker
        value={new Date(`${value}T00:00:00`)}
        mode="date"
        display="compact"
        locale="ko-KR"
        themeVariant={scheme}
        accentColor={theme.primary}
        onChange={(e, d) => {
          if (e.type === 'set' && d) onChange(toDateString(d));
        }}
      />
      {onClear ? (
        <Pressable onPress={() => onClear()} hitSlop={6}>
          <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 네이티브 시간 피커 — value는 "HH:mm". CompactDate의 time 버전. */
export function CompactTime({ value, onChange, onClear }: { value?: string; onChange: (t?: string) => void; onClear?: () => void }) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (!value) {
    return (
      <Pressable onPress={() => onChange(fmt(new Date()))} hitSlop={6}>
        <ThemedText type="default" style={{ color: theme.textSecondary }}>
          없음
        </ThemedText>
      </Pressable>
    );
  }
  const [h, m] = value.split(':');
  const dv = new Date();
  dv.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return (
    <View style={styles.compactRow}>
      <DateTimePicker
        value={dv}
        mode="time"
        display="compact"
        locale="ko-KR"
        themeVariant={scheme}
        accentColor={theme.primary}
        onChange={(e, d) => {
          if (e.type === 'set' && d) onChange(fmt(d));
        }}
      />
      {onClear ? (
        <Pressable onPress={() => onClear()} hitSlop={6}>
          <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 단일 선택 행 — ListRow + OptionSheet 결합. */
export function SelectRow<T extends string | number>({
  icon,
  label,
  value,
  options,
  onChange,
  title,
  valueColor,
  last,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  title: string;
  valueColor?: string;
  last?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <ListRow dense
        icon={icon}
        label={label}
        value={cur?.label}
        valueColor={valueColor}
        last={last}
        onPress={disabled ? undefined : () => setOpen(true)}
      />
      <OptionSheet open={open} onClose={() => setOpen(false)} title={title} value={value} options={options} onSelect={onChange} />
    </>
  );
}

/** 날짜 선택 행 (상세) — 우측에 네이티브 compact 데이트피커(탭 시 캘린더 팝오버). */
export function DateRow({
  icon = 'calendar-outline',
  label,
  value,
  onChange,
  last,
  disabled,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onChange: (d?: string) => void;
  last?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <ListRow dense
      icon={icon}
      label={label}
      last={last}
      right={
        disabled ? (
          <ThemedText type="default" style={{ color: theme.textSecondary }}>
            {value ? formatMonthDay(value) : '없음'}
          </ThemedText>
        ) : (
          <View style={styles.dateRight}>
            <CompactDate value={value} onChange={onChange} onClear={() => onChange(undefined)} />
          </View>
        )
      }
    />
  );
}

/** 시간 선택 행 (상세) — 우측에 네이티브 compact 타임피커. value는 "HH:mm". */
export function TimeRow({
  icon = 'time-outline',
  label,
  value,
  onChange,
  last,
  disabled,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onChange: (t?: string) => void;
  last?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <ListRow dense
      icon={icon}
      label={label}
      last={last}
      right={
        disabled ? (
          <ThemedText type="default" style={{ color: theme.textSecondary }}>
            {value ?? '없음'}
          </ThemedText>
        ) : (
          <View style={styles.dateRight}>
            <CompactTime value={value} onChange={onChange} onClear={() => onChange(undefined)} />
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { textAlign: 'center', fontWeight: '700', marginBottom: 12 },
  // flexShrink: 시트 maxHeight 안에서 줄어들며 스크롤되도록 (없으면 긴 목록이 잘린 채 스크롤 불가)
  sheetScroll: { flexShrink: 1, paddingHorizontal: 10 },
  sheetList: { paddingBottom: 8, gap: 2 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md },
  optIcon: { width: 18, textAlign: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 4 },
  optLabel: { flex: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, height: 40 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateRight: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  chipLabel: { maxWidth: 130 },
});
