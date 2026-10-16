import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

const ICON = require('../../../assets/images/brand-icon.png');

/**
 * Plando 브랜드 마크 — 앱 아이콘 + "Plan Do!" (Do!는 파랑). 웹 BrandMark 미러.
 * 라이트 고정 auth 배경 위에서만 쓰이므로 웹과 동일한 고정색(#000/#3b82f6).
 */
export function BrandMark({ size = 'normal' }: { size?: 'normal' | 'large' }) {
  const mark = size === 'large' ? 52 : 32;
  const text = size === 'large' ? 32 : 22;
  return (
    <View style={styles.row}>
      <Image source={ICON} style={{ width: mark, height: mark, borderRadius: mark * 0.23 }} contentFit="contain" />
      <Text style={[styles.text, { fontSize: text, lineHeight: text * 1.15 }]} numberOfLines={1}>
        Plan <Text style={styles.accent}>Do!</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontWeight: '800', letterSpacing: -0.5, color: '#000000' },
  accent: { color: '#3b82f6' },
});
