import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { API_BASE_URL } from '@/shared/config/env';
import { useTheme } from '@/hooks/use-theme';

const AVATAR_COLORS = ['#5B8CFF', '#FF7EB6', '#34C285', '#F5A524', '#A78BFA', '#FF5A5A', '#22B8CF', '#E8845B'];

/** 프로필 URL 정규화: 상대경로면 API_BASE_URL 부착, http면 https로 승격(iOS ATS가 http 이미지 차단). */
export function secureUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const abs = /^(https?:|data:)/.test(url) ? url : `${API_BASE_URL}${url}`;
  return abs.startsWith('http://') ? 'https://' + abs.slice('http://'.length) : abs;
}

/** 이름 → 고정 컬러 (해시) */
export function colorFromName(name?: string): string {
  const n = name ?? '';
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export type Person = { name?: string; email?: string; profileImageUrl?: string };

/** 프로필 아바타 — 사진 있으면 이미지, 없으면 이름 첫 글자 컬러 원형. */
export function Avatar({ person, size = 28, ring }: { person: Person; size: number; ring?: string }) {
  const label = (person.name ?? person.email ?? '?').trim().charAt(0).toUpperCase();
  const base = {
    width: size,
    height: size,
    borderRadius: size / 2,
    ...(ring ? { borderWidth: 2, borderColor: ring } : null),
  };
  const uri = secureUrl(person.profileImageUrl);
  if (uri) {
    return <Image source={{ uri }} style={base} contentFit="cover" />;
  }
  return (
    <View style={[base, styles.fallback, { backgroundColor: colorFromName(person.name ?? person.email) }]}>
      <ThemedText type="small" style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.55 }]}>
        {label}
      </ThemedText>
    </View>
  );
}

/** 겹치는 아바타 스택 + 초과 인원 +N. 고정 높이라 행이 깨지지 않음. */
export function AvatarStack({ people, size = 26, max = 4 }: { people: Person[]; size?: number; max?: number }) {
  const theme = useTheme();
  // 같은 사람이 중복으로 들어오는 데이터(중복 담당자 행)를 방어 — 이메일/이름 기준 dedupe + 인덱스 결합 key
  const seen = new Set<string>();
  const unique = people.filter((p) => {
    const k = p.email ?? p.name ?? '';
    if (k && seen.has(k)) return false;
    if (k) seen.add(k);
    return true;
  });
  const shown = unique.slice(0, max);
  const extra = unique.length - shown.length;
  const overlap = Math.round(size * 0.32);
  return (
    <View style={styles.stack}>
      {shown.map((p, i) => (
        <View key={`${p.email ?? p.name ?? 'p'}-${i}`} style={{ marginLeft: i === 0 ? 0 : -overlap }}>
          <Avatar person={p} size={size} ring={theme.background} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -overlap, backgroundColor: theme.surfaceSelected, borderWidth: 2, borderColor: theme.background },
          ]}>
          <ThemedText type="small" style={[styles.initial, { fontSize: size * 0.38, lineHeight: size * 0.5, color: theme.textSecondary }]}>
            +{extra}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', alignItems: 'center' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '800' },
});
