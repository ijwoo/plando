import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { radius, shadow } from '@/shared/ui/tokens';

/** 세그먼트 컨트롤 — 트랙 위에 떠 있는 surface 썸(plando). 상태·우선순위·뷰 선택용 */
export function Segmented<T extends string>({
  disabled,
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** 읽기 전용일 때 탭을 막는다(서버가 403 을 주는 경우) */
  disabled?: boolean;
}) {
  const theme = useTheme();
  const track = theme.isDark ? theme.surfaceAlt : theme.surfaceSelected;
  const thumb = theme.isDark ? theme.surfaceSelected : theme.surface;
  return (
    /* 선택된 칩은 **트랙보다 밝아야** 떠 보인다.
       [고치는 결함] 다크에서 트랙 surfaceSelected(#2A2C33)에 칩 surface(#1E2026)를 얹어
       칩이 트랙보다 어두웠다. 눌린 게 아니라 비활성처럼 보인다.
       가장 밝은 토큰이 테마마다 다르다 — 라이트는 surface(흰색), 다크는 surfaceSelected. */
    <View style={[styles.row, { backgroundColor: track }, disabled && { opacity: 0.5 }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            disabled={disabled}
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.item, active && [{ backgroundColor: thumb }, shadow.card]]}>
            <ThemedText type="label" style={{ color: active ? theme.text : theme.textSecondary }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: radius.sm + 2, padding: 3, gap: 3 },
  item: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
});
