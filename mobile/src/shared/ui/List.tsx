import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { shadow } from '@/shared/ui/tokens';

/**
 * 리스트 시스템 — 슬랙식 평면 풀블리드.
 * 카드 박스 대신 배경 위 플랫 행 + hairline 구분선, 모노크롬 라인 아이콘, 넉넉한 행 높이,
 * 크고 굵은 섹션 헤더. iconBg(구 컬러 뱃지)는 API 호환을 위해 받지만 모노크롬으로 렌더한다.
 */
export function ListGroup({
  children,
  style,
  card,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 편집기·상세 화면용 — 기존 iOS 그룹 카드(둥근 surface 박스)로 렌더 */
  card?: boolean;
}) {
  const theme = useTheme();
  if (card) return <View style={[styles.cardGroup, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
  // 라이트: iOS 설정식 그룹 카드 — 둥근 흰 박스가 회색 캔버스 위로 부양(그림자)해 '서비스 앱' 위계를 만든다.
  // 다크: bg≈surface(차콜)라 평면(슬랙식)이 정답 → 카드/그림자 없이 그대로.
  if (!theme.isDark) return <View style={[styles.lightCard, { backgroundColor: theme.surface }, shadow.card, style]}>{children}</View>;
  return <View style={style}>{children}</View>;
}

/** 섹션 헤더 — 크고 굵게 (슬랙 '알림/모양/접근성' 헤더 톤). */
export function ListSectionHeader({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ThemedText type="default" style={[styles.sectionHeader, { color: theme.text }]}>
      {children}
    </ThemedText>
  );
}

/** 아이콘 이름을 라인(outline) 변형으로 — 없으면 원본 유지 */
function outlineName(name: keyof typeof Ionicons.glyphMap): keyof typeof Ionicons.glyphMap {
  if (name.endsWith('-outline') || name.endsWith('-sharp')) return name;
  const candidate = `${name}-outline` as keyof typeof Ionicons.glyphMap;
  return candidate in Ionicons.glyphMap ? candidate : name;
}

/** 리스트 행 — 아이콘? + 라벨(+설명) + 값/우측 컨트롤 + (onPress 시) chevron. */
export function ListRow({
  icon,
  iconColor,
  iconBg: _iconBg, // 구 API 호환 — 컬러 뱃지는 모노크롬으로 통일 렌더
  label,
  desc,
  value,
  valueColor,
  right,
  onPress,
  onLongPress,
  last,
  destructive,
  vertical,
  hideChevron,
  left,
  dense,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** @deprecated 컬러 뱃지 — 모노크롬 라인 아이콘으로 렌더됨 */
  iconBg?: string;
  label: string;
  desc?: string;
  value?: string;
  valueColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  last?: boolean;
  destructive?: boolean;
  /** 컨트롤(세그먼트 등)이 넓을 때 아래로 배치 */
  vertical?: boolean;
  /** 액션 행 등에서 chevron 숨김 */
  hideChevron?: boolean;
  /** 아이콘 대신 커스텀 리딩 요소 (아바타 등) */
  left?: ReactNode;
  /** 편집기·상세 화면용 — 기존 콤팩트 행 규격(카드 그룹과 세트) */
  dense?: boolean;
}) {
  const theme = useTheme();
  const labelColor = destructive ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress ? () => { tickHaptic(); onPress(); } : undefined}
      onLongPress={onLongPress ? () => { tickHaptic(); onLongPress(); } : undefined}
      delayLongPress={onLongPress ? 300 : undefined}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [
        dense ? styles.rowDense : styles.row,
        // 라이트 카드 안에서는 행이 가로 패딩을 가져 눌림 하이라이트가 카드 폭 전체를 채운다
        !dense && !theme.isDark ? styles.rowLightPad : null,
        { borderBottomColor: theme.divider, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
        // 라이트: 흰 카드 위에서 surfaceSelected(웜 베이지)는 탁해 보인다 → 한 단계 옅은 surfaceAlt.
        // 다크: 카드와 대비가 필요해 기존 surfaceSelected 유지.
        pressed && onPress ? { backgroundColor: theme.isDark ? theme.surfaceSelected : theme.surfaceAlt } : null,
      ]}>
      <View style={dense ? styles.rowMainDense : styles.rowMain}>
        {left ?? null}
        {icon && _iconBg && !destructive ? (
          // 컬러 라운드 뱃지 (iOS 설정·ClickUp 톤) — iconBg 넘어온 곳(더보기·설정)만 컬러로 살아난다
          <View style={[dense ? styles.badgeDense : styles.badge, { backgroundColor: _iconBg }]}>
            <Ionicons name={icon} size={dense ? 14 : 16} color="#fff" />
          </View>
        ) : icon ? (
          <Ionicons
            name={outlineName(icon)}
            size={dense ? 18 : 22}
            color={destructive ? theme.danger : (iconColor ?? theme.textSecondary)}
            style={dense ? styles.iconDense : styles.icon}
          />
        ) : null}
        <View style={styles.body}>
          <ThemedText type="default" style={[dense ? null : styles.label, { color: labelColor }]}>
            {label}
          </ThemedText>
          {desc ? (
            <ThemedText type="small" style={[styles.desc, { color: theme.textSecondary }]}>
              {desc}
            </ThemedText>
          ) : null}
        </View>
        {!vertical
          ? right ?? (
              <>
                {value != null ? (
                  <ThemedText type="default" style={[styles.value, { color: valueColor ?? theme.textSecondary }]} numberOfLines={1}>
                    {value}
                  </ThemedText>
                ) : null}
                {onPress && !hideChevron ? <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} /> : null}
              </>
            )
          : null}
      </View>
      {vertical && right ? <View style={styles.controlBelow}>{right}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 슬랙 톤 — 큰 헤더, 위 여백 넉넉·아래 살짝
  sectionHeader: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, marginTop: 24, marginBottom: 4 },
  // 행 호흡 — 2줄 구조 기준 ~68pt
  row: { paddingHorizontal: 4, paddingVertical: 11, gap: 8 },
  // 라이트 카드 내부 행 가로 패딩(카드 자체 패딩 대신) — 하이라이트가 모서리까지 참
  rowLightPad: { paddingHorizontal: 14 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 32 },
  icon: { width: 26, textAlign: 'center' },
  body: { flex: 1, gap: 3 },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  desc: { lineHeight: 18 },
  value: { flexShrink: 1, textAlign: 'right' },
  controlBelow: { width: '100%', marginTop: 2 },
  // 라이트 그룹 카드 — 회색 캔버스 위 부양(그림자는 인라인 shadow.card).
  // 가로 패딩은 행이 갖는다 → 눌림 하이라이트가 카드 전체 폭을 채우고, overflow로 라운드 모서리에 클리핑.
  lightCard: { borderRadius: 16, overflow: 'hidden' },
  // 컬러 아이콘 뱃지
  badge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeDense: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  // 기존(카드 그룹) 규격 — 편집기·상세 화면 전용
  cardGroup: { borderRadius: 12, overflow: 'hidden' },
  rowDense: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  rowMainDense: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  iconDense: { width: 20, textAlign: 'center' },
});
