/**
 * 오늘 동선 구간 시트 — Toss 스타일 하위 컴포넌트 모음.
 * 데이터는 routeProvider의 RouteResult/RouteLeg를 그대로 소비한다(스키마 변경 없음).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';

import type { RouteLeg, RouteMode, RouteResult } from './routeProvider';
import { fmtKm } from './travel';

/** 노선 타입 → 배지/dot/connector 색. 현재 leg 스키마엔 노선 타입이 없어 blue 폴백만 쓰인다. */
export const ROUTE_TYPE_COLORS: Record<string, string> = {
  간선: '#3D5BF6',
  지선: '#42A62A',
  광역: '#E8433B',
  순환: '#F5A623',
  마을: '#42A62A',
  공항: '#4FA9E0',
};

/** leg의 노선색 — RouteLeg에 노선 타입 필드가 없어 현재는 blue 폴백. 필드가 생기면 테이블 매핑. */
function legColor(routeType: string | undefined, fallback: string): string {
  return (routeType && ROUTE_TYPE_COLORS[routeType]) || fallback;
}

// ── 모드 세그먼트 컨트롤 (iOS segmented 방식) ──────────────────────────

export function SegmentedControl({
  modes,
  value,
  onChange,
}: {
  modes: { mode: RouteMode; label: string; icon: string }[];
  value: RouteMode;
  onChange: (m: RouteMode) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segTrack, { backgroundColor: theme.surfaceAlt }]}>
      {modes.map((m) => {
        const active = m.mode === value;
        return (
          <Pressable
            key={m.mode}
            accessibilityLabel={m.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              tickHaptic();
              onChange(m.mode);
            }}
            style={[styles.segTab, active && [styles.segTabActive, { backgroundColor: theme.surface }]]}>
            <Ionicons
              name={m.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={active ? theme.primary : theme.textTertiary}
            />
            <ThemedText type="small" style={[styles.segLabel, { color: active ? theme.primary : theme.textTertiary }]}>
              {m.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── 요약 블록: 큰 시간 + km + 정보 칩 ──────────────────────────────────

/** "1시간 3분" — 숫자 28px, '시간'·'분' 단위는 19px */
function TimeText({ minutes }: { minutes: number }) {
  const parts: { t: string; unit: boolean }[] = [];
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) parts.push({ t: String(h), unit: false }, { t: '시간', unit: true });
  if (m > 0 || h === 0) parts.push({ t: h > 0 ? ` ${m}` : String(m), unit: false }, { t: '분', unit: true });
  return (
    <ThemedText style={styles.timeBig}>
      {parts.map((p, i) => (
        <ThemedText key={i} style={p.unit ? styles.timeUnit : styles.timeBig}>
          {p.t}
        </ThemedText>
      ))}
    </ThemedText>
  );
}

export function RouteSummary({ result }: { result: RouteResult }) {
  const theme = useTheme();
  const chips: { text: string; accent?: boolean }[] = [];
  if (result.transfers != null) chips.push({ text: `환승 ${result.transfers}회` });
  if (result.fareWon != null) chips.push({ text: `${result.fareWon.toLocaleString()}원`, accent: true });
  if (result.tollWon != null) chips.push({ text: `통행료 ${result.tollWon.toLocaleString()}원`, accent: true });
  if (result.taxiWon != null) chips.push({ text: `택시 약 ${result.taxiWon.toLocaleString()}원` });
  if (result.estimated) chips.push({ text: '직선거리 예상' });
  return (
    <View style={styles.summary}>
      <View style={styles.summaryRow}>
        <TimeText minutes={result.minutes ?? 0} />
        {result.distKm != null ? (
          <ThemedText style={[styles.summaryKm, { color: theme.textTertiary }]}>{fmtKm(result.distKm)}</ThemedText>
        ) : null}
      </View>
      {chips.length ? (
        <View style={styles.chipRow}>
          {chips.map((c, i) => (
            <View
              key={i}
              style={[styles.chip, { backgroundColor: c.accent ? theme.primarySoft : theme.surfaceAlt }]}>
              <ThemedText style={[styles.chipText, { color: c.accent ? theme.primary : theme.textSecondary }]}>
                {c.text}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── 대중교통 세로 타임라인 ────────────────────────────────────────────

function DashedConnector({ color }: { color: string }) {
  return (
    <View style={styles.connectorWrap}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function TransitLeg({ leg, last }: { leg: RouteLeg; last: boolean }) {
  const theme = useTheme();
  const walk = leg.kind === 'walk';
  const color = walk ? theme.textTertiary : legColor(undefined, theme.primary);
  const rightText = `${leg.minutes}분${leg.detail ? ` · ${leg.detail}` : ''}`;
  return (
    <View style={styles.leg}>
      {/* 왼쪽 rail: dot + connector */}
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            walk
              ? { backgroundColor: theme.surface, borderWidth: 2.5, borderColor: color }
              : { backgroundColor: color },
          ]}
        />
        {!last ? (
          walk ? (
            <DashedConnector color={color} />
          ) : (
            <View style={[styles.connector, { backgroundColor: color }]} />
          )
        ) : null}
      </View>
      {/* 본문 */}
      <View style={styles.legBody}>
        <View style={styles.legTitleRow}>
          {walk ? (
            <View style={styles.walkTitle}>
              <Ionicons name="walk-outline" size={15} color={theme.textSecondary} />
              <ThemedText style={[styles.walkText, { color: theme.textSecondary }]}>도보 이동</ThemedText>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <ThemedText style={styles.badgeText}>{leg.label}</ThemedText>
            </View>
          )}
          <ThemedText style={[styles.legRight, { color: theme.textTertiary }]}>{rightText}</ThemedText>
        </View>
        {leg.sub ? (
          <ThemedText style={[styles.legSub, { color: theme.textTertiary }]} numberOfLines={1}>
            {leg.sub}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

export function TransitTimeline({ legs }: { legs: RouteLeg[] }) {
  return (
    <ScrollView style={styles.timeline} bounces={false} showsVerticalScrollIndicator={false}>
      {legs.map((leg, i) => (
        <TransitLeg key={i} leg={leg} last={i === legs.length - 1} />
      ))}
    </ScrollView>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────

export function SheetCta({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.cta,
        { backgroundColor: theme.primary, shadowColor: theme.primary },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}>
      <Ionicons name={icon} size={16} color="#fff" />
      <ThemedText style={styles.ctaText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 세그먼트
  segTrack: { flexDirection: 'row', borderRadius: 13, padding: 3, marginTop: 2 },
  segTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10 },
  segTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  segLabel: { fontSize: 12.5, fontWeight: '700' },
  // 요약
  summary: { gap: 7, paddingTop: 8, paddingBottom: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  timeBig: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  timeUnit: { fontSize: 19, lineHeight: 34, fontWeight: '800', letterSpacing: -0.3 },
  summaryKm: { fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
  // 타임라인
  timeline: { maxHeight: 196, marginTop: 4 },
  leg: { flexDirection: 'row', gap: 12 },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  connector: { flex: 1, width: 2.5, borderRadius: 1.25, marginVertical: 3, minHeight: 14 },
  connectorWrap: { flex: 1, width: 2.5, marginVertical: 3, minHeight: 14, gap: 3, alignItems: 'center' },
  dash: { width: 2.5, flex: 1, minHeight: 3.5, borderRadius: 1.25 },
  legBody: { flex: 1, paddingBottom: 12, gap: 3 },
  legTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legSub: { fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 7 },
  badgeText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  walkTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  walkText: { fontSize: 13.5, fontWeight: '600' },
  legRight: { fontSize: 12.5, fontWeight: '600', marginLeft: 'auto' },
  // CTA
  cta: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
});
