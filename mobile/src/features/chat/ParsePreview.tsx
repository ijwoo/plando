import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, withTiming, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { formatHintDate, parseKoreanTask, type ParsedHints } from '@/features/chat/parseKoreanTask';
import { useTheme } from '@/hooks/use-theme';
import { impactHaptic } from '@/shared/ui/haptics';

/**
 * 입력창 위 실시간 파싱 프리뷰.
 *
 * 보내기 전에 **"알아듣고 있다"** 를 보여주는 것이 전부다. 저장되는 값은 서버 파싱
 * 결과이고 여기 칩은 낙관적 추측이다. 그래서 세 가지를 지킨다:
 *  - AI 를 부르지 않는다(순수 로컬). 일일 사용량에 손대면 프리뷰 하나가 대화를 잡아먹는다.
 *  - 실패하면 조용히 아무것도 안 띄운다. 못 알아들은 걸 굳이 알릴 이유가 없다.
 *  - 칩이 떴다 사라져도 입력창은 그 자리에 있어야 한다 — 높이를 0↔ROW_HEIGHT 로만 움직인다.
 *    타이핑 중에 입력창이 아래위로 흔들리면 그것만으로 쓰기가 어려워진다.
 */

const DEBOUNCE_MS = 250;
const ROW_HEIGHT = 40;

type HintKey = 'datetime' | 'location' | 'priority';

const PRIORITY_LABEL: Record<'high' | 'low', string> = { high: '높음', low: '낮음' };

export function ParsePreview({ text }: { text: string }) {
  const theme = useTheme();
  const [hints, setHints] = useState<ParsedHints>({});
  /* 지운 칩은 **어느 문장에서 지웠는지**까지 같이 들고 있는다.
     문장이 바뀌면 저절로 무효가 되므로 초기화 이펙트가 필요 없다 — 렌더 중에 계산된다. */
  const [dismissed, setDismissed] = useState<{ forText: string; keys: HintKey[] }>({ forText: '', keys: [] });
  const seenRef = useRef<string>('');

  const prevLenRef = useRef(0);

  /* 타이핑마다 돌리지 않는다 — 250ms 쉬었을 때만.
     다만 **한 번에 확 바뀐 입력은 기다리지 않는다.** 예시를 눌러 채우거나 붙여넣기를 하면
     이미 완성된 문장이라 늦출 이유가 없다. 예시를 누르고 바로 보내면 칩이 뜨자마자
     사라져서, 정작 "알아듣고 있다" 를 보여줘야 할 순간에 아무것도 안 보였다. */
  useEffect(() => {
    const jumped = Math.abs(text.length - prevLenRef.current) > 1;
    prevLenRef.current = text.length;
    const run = () => {
      try {
        setHints(parseKoreanTask(text));
      } catch {
        // 파싱은 부가 기능이다. 여기서 화면이 죽으면 입력 자체를 못 하게 된다.
        setHints({});
      }
    };
    const t = setTimeout(run, jumped ? 0 : DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const hiddenKeys = useMemo(
    () => (dismissed.forText === text ? dismissed.keys : []),
    [dismissed, text],
  );

  const chips = useMemo(() => {
    const out: { key: HintKey; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [];
    if (hints.datetime && !hiddenKeys.includes('datetime')) {
      out.push({
        key: 'datetime',
        icon: 'calendar-outline',
        label: formatHintDate(hints.datetime, !!hints.hasTime),
        color: theme.primary,
      });
    }
    if (hints.location && !hiddenKeys.includes('location')) {
      out.push({ key: 'location', icon: 'location-outline', label: hints.location, color: theme.green });
    }
    if (hints.priority && !hiddenKeys.includes('priority')) {
      out.push({
        key: 'priority',
        icon: 'flag-outline',
        label: PRIORITY_LABEL[hints.priority],
        color: hints.priority === 'high' ? theme.orange : theme.textSecondary,
      });
    }
    return out;
  }, [hints, hiddenKeys, theme]);

  /* 햅틱은 **새 칩이 생겼을 때 한 번**만.
     칩 개수만큼 때리면 세 개가 한 번에 뜰 때 드르륵 하고 울려서 오류처럼 느껴진다. */
  useEffect(() => {
    const key = chips.map((c) => c.key).join(',');
    const prev = seenRef.current;
    const isNew = chips.some((c) => !prev.split(',').includes(c.key));
    seenRef.current = key;
    if (isNew && chips.length > 0) impactHaptic(Haptics.ImpactFeedbackStyle.Light);
  }, [chips]);

  const rowStyle = useAnimatedStyle(() => ({
    height: withTiming(chips.length ? ROW_HEIGHT : 0, { duration: 160 }),
    opacity: withTiming(chips.length ? 1 : 0, { duration: 160 }),
  }));

  return (
    <Animated.View style={[styles.row, rowStyle]} pointerEvents={chips.length ? 'auto' : 'none'}>
      {chips.map((c) => (
        <Animated.View
          key={c.key}
          /* damping 0.7 은 "감쇠비" 다. Reanimated 의 damping 은 감쇠 계수(기본 10)라
             그대로 넣으면 몇 번씩 튄다. ζ=0.7, k=300, m=1 → c = 2ζ√(km) ≈ 24. */
          entering={ZoomIn.springify().damping(24).stiffness(300).mass(1)}
          exiting={FadeOut.duration(120)}>
          <Pressable
            onPress={() => setDismissed({ forText: text, keys: [...hiddenKeys, c.key] })}
            accessibilityRole="button"
            accessibilityLabel={`${c.label} 인식 취소`}
            hitSlop={6}
            style={({ pressed }) => [styles.chip, { backgroundColor: theme.surfaceAlt }, pressed && { opacity: 0.6 }]}>
            <Ionicons name={c.icon} size={12} color={c.color} />
            <ThemedText type="small" style={[styles.chipText, { color: c.color }]} numberOfLines={1}>
              {c.label}
            </ThemedText>
            <Ionicons name="close" size={11} color={theme.textTertiary} />
          </Pressable>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, overflow: 'hidden' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontWeight: '700', maxWidth: 130 },
});
