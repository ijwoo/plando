import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { formatHintDate, parseKoreanTask } from '@/features/chat/parseKoreanTask';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';

/**
 * 빈 화면 가운데의 시연.
 *
 * 문장이 한 글자씩 써지고, 다 써지면 거기서 뽑아낸 날짜·장소·우선순위가 칩으로 튀어나온다.
 * 장식이 아니라 **이 화면이 무엇을 하는지 보여주는 것**이다 — 자연어를 넣으면 마감·장소·
 * 우선순위가 채워진다는 게 이 기능의 전부인데, 글로만 적으면 읽지 않는다.
 *
 * 칩은 실제 파서(parseKoreanTask)를 돌려 만든다. 손으로 적어 두면 언젠가 파서와 어긋나서
 * **되지도 않는 걸 된다고 광고하는 화면**이 된다. 시연이 곧 회귀 테스트인 셈이다.
 *
 * 사용자가 입력을 시작하면 멈춘다. 내가 타이핑하는 옆에서 다른 글자가 계속 써지면
 * 그것만으로 거슬린다.
 */

const SENTENCES = [
  '내일 오후 3시 강남역에서 팀 미팅',
  '금요일까지 계약서 검토 급하게',
  '다음주 월요일 아침 회의 준비',
];

const TYPE_MS = 45;
const HOLD_MS = 2400;

export function AiIdleDemo({ paused, onPick }: { paused: boolean; onPick: (s: string) => void }) {
  const theme = useTheme();
  /* 문장 번호(i)와 지금까지 쓴 글자 수(n) 하나로 굴린다.
     매 렌더가 **다음 한 틱만** 예약하는 구조라, 이펙트 본문에서 상태를 바꾸지 않는다
     (그렇게 하면 렌더 도중 상태가 바뀌어 한 프레임이 어긋난다). */
  const [{ i, n }, setState] = useState({ i: 0, n: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // 모션 최소화를 켠 사람에게 글자가 흘러가는 건 그 자체로 불편하다
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const full = SENTENCES[i];
  const typed = reduceMotion ? full : full.slice(0, n);

  const next = () => setState((s) => ({ i: (s.i + 1) % SENTENCES.length, n: 0 }));

  useEffect(() => {
    if (paused) return;
    let timer: ReturnType<typeof setTimeout>;
    if (reduceMotion) {
      timer = setTimeout(next, HOLD_MS + 1200);
    } else if (n < full.length) {
      timer = setTimeout(() => setState((s) => ({ ...s, n: s.n + 1 })), n === 0 ? 350 : TYPE_MS);
    } else {
      timer = setTimeout(next, HOLD_MS);
    }
    return () => clearTimeout(timer);
    // next 는 setState 만 부르는 안정된 클로저다
     
  }, [i, n, full.length, paused, reduceMotion]);

  const done = typed.length === full.length;

  const chips = useMemo(() => {
    if (!done) return [];
    const h = parseKoreanTask(full);
    const out: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [];
    if (h.datetime) {
      out.push({ key: 'd', icon: 'calendar-outline', label: formatHintDate(h.datetime, !!h.hasTime), color: theme.primary });
    }
    if (h.location) out.push({ key: 'l', icon: 'location-outline', label: h.location, color: theme.green });
    if (h.priority) {
      out.push({
        key: 'p',
        icon: 'flag-outline',
        label: h.priority === 'high' ? '높음' : '낮음',
        color: h.priority === 'high' ? theme.orange : theme.textSecondary,
      });
    }
    return out;
  }, [done, full, theme]);

  if (paused) return null;

  return (
    <View style={styles.stage}>

    <Pressable
      onPress={() => {
        tickHaptic();
        onPick(full);
      }}
      accessibilityRole="button"
      accessibilityLabel={`예시 넣기: ${full}`}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.7 }]}>
      <View style={[styles.bubble, { backgroundColor: theme.surfaceAlt }]}>
        <ThemedText type="default" style={{ color: theme.text }}>
          {typed}
          {!done ? <ThemedText type="default" style={{ color: theme.primary }}>|</ThemedText> : null}
        </ThemedText>
      </View>

      {/* 칩 자리는 항상 잡아 둔다 — 나타날 때마다 문장이 위로 튀면 시선이 따라가지 못한다 */}
      <View style={styles.chipRow}>
        {chips.map((c, i) => (
          <Animated.View
            key={c.key}
            entering={ZoomIn.springify().damping(24).stiffness(300).delay(i * 90)}
            exiting={FadeOut.duration(140)}
            style={[styles.chip, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name={c.icon} size={11} color={c.color} />
            <ThemedText type="small" style={[styles.chipText, { color: c.color }]}>
              {c.label}
            </ThemedText>
          </Animated.View>
        ))}
      </View>

      {done ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          <ThemedText type="small" style={{ color: theme.textTertiary }}>
            눌러서 넣어보기
          </ThemedText>
        </Animated.View>
      ) : null}
    </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // 자르지 않는다 — 자르는 순간 그 선이 카드 모서리로 보인다
  stage: { alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 26 },
  wrap: { alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  bubble: { maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, minHeight: 26 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontWeight: '700' },
});
