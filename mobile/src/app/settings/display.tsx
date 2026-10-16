import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import type { UserSettingsUpdate } from '@/features/settings/api';
import { useSettings, useUpdateSettings } from '@/features/settings/queries';
import { THEME_MODES, SettingsShell } from '@/features/settings/shared';
import { ThemePreview } from '@/features/settings/ThemePreview';
import { useTheme } from '@/hooks/use-theme';
import { hydrateCompletionSound, setCompletionSound } from '@/shared/ui/completionFeedback';
import { useCustomThemeStore } from '@/shared/store/customThemeStore';
import { hydrateThemeMode } from '@/shared/store/themeStore';
import { ListGroup, ListRow, ListSectionHeader } from '@/shared/ui/List';
import { Segmented } from '@/shared/ui/Segmented';
import { tickHaptic } from '@/shared/ui/haptics';
import { readableOn } from '@/shared/ui/tone';
import { CUSTOM_ACCENTS } from '@/shared/ui/tokens';

/** 설정 > 화면 — 테마·콤팩트·완료 사운드 */
export default function DisplaySettingsScreen() {
  const { data: s, isLoading, isError, error } = useSettings();
  const update = useUpdateSettings();
  const set = (payload: UserSettingsUpdate) => update.mutate(payload);

  const [completionSound, setCompletionSoundState] = useState(false);
  useEffect(() => {
    void hydrateCompletionSound().then(setCompletionSoundState);
  }, []);
  const onCompletionSoundToggle = async (v: boolean) => {
    setCompletionSoundState(v);
    await setCompletionSound(v);
  };

  const onThemeChange = (mode: string) => {
    // 선택 표시(낙관적 캐시)를 먼저 그리고, 앱 전체 리테마(무거운 동기 렌더)는 다음 프레임으로
    set({ themeMode: mode });
    requestAnimationFrame(() => hydrateThemeMode(mode));
  };

  return (
    <SettingsShell title="화면" loading={isLoading} error={isError ? error : undefined}>
      {s ? (
        <>
          <ListSectionHeader>테마</ListSectionHeader>
          <ListGroup>
            <ListRow
              label="색상 테마"
              // 서버(계정 설정)에 저장 — 같은 계정으로 로그인한 다른 기기·웹에도 따라간다
              desc="계정에 저장돼 로그인한 모든 기기에 적용돼요. 미드나잇·오션은 다크 계열, 커스텀은 원하는 색으로."
              vertical
              last
              right={
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>
                  {THEME_MODES.map((m) => (
                    <ThemePreview key={m} mode={m} selected={(s.themeMode ?? 'system') === m} onPress={() => onThemeChange(m)} />
                  ))}
                </ScrollView>
              }
            />
          </ListGroup>

          {/* 커스텀 테마 에디터 — themeMode='custom'일 때만 */}
          {s.themeMode === 'custom' ? <CustomThemeEditor /> : null}

          <ListSectionHeader>표시</ListSectionHeader>
          <ListGroup>
            {/* 예전 라벨은 '콤팩트 모드 / 목록을 더 촘촘하게'였다. 실제로는 여백만 줄여
                메타 줄의 혼잡을 더 빽빽하게 만들 뿐이었다. 줄이는 대상을 정보량으로 바꾸고
                라벨도 그에 맞춘다. 적용 범위(할 일 목록)를 문구에 명시 — 보드는 해당 없다. */}
            <ListRow
              label="간단히 보기"
              desc="할 일 목록에 제목과 마감만 표시"
              right={<Switch value={!!s.compactMode} onValueChange={(v) => set({ compactMode: v })} />}
            />
            <ListRow
              label="완료 사운드"
              // 기기 로컬(SecureStore) — 계정 설정이 아니라 이 기기에만 저장된다
              desc="할 일을 완료할 때 짧은 알림음 재생 (이 기기에서만)"
              last
              right={<Switch value={completionSound} onValueChange={(v) => void onCompletionSoundToggle(v)} />}
            />
          </ListGroup>
        </>
      ) : null}
    </SettingsShell>
  );
}

/** 커스텀 테마 편집 — 밝게/어둡게 베이스 + 강조색 선택. 전체 팔레트는 accent에서 조화롭게 파생. */
function CustomThemeEditor() {
  const theme = useTheme();
  const base = useCustomThemeStore((st) => st.base);
  const accent = useCustomThemeStore((st) => st.accent);
  const setCustom = useCustomThemeStore((st) => st.set);

  return (
    <>
      <ListSectionHeader>커스텀</ListSectionHeader>
      <ListGroup>
        <ListRow
          label="배경"
          // 커스텀 색 자체는 기기 로컬(SecureStore) — 테마 이름('커스텀')만 계정에 저장된다.
          // 다른 기기에서는 그 기기에 저장된 색으로 보이므로 오해하지 않게 밝혀 둔다.
          desc="밝은 배경 또는 어두운 배경 (커스텀 색은 이 기기에만 저장돼요)"
          right={
            <Segmented
              options={[
                { value: 'light', label: '밝게' },
                { value: 'dark', label: '어둡게' },
              ]}
              value={base}
              onChange={(v) => setCustom({ base: v as 'light' | 'dark' })}
            />
          }
        />
        <ListRow
          label="강조색"
          desc="버튼·강조에 쓰이는 색 — 배경과 카드도 이 색으로 은은하게 맞춰져요"
          vertical
          last
          right={
            <View style={styles.swatchGrid}>
              {CUSTOM_ACCENTS.map((c) => {
                const on = accent.toLowerCase() === c.toLowerCase();
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      tickHaptic();
                      setCustom({ accent: c });
                    }}
                    accessibilityLabel={`강조색 ${c}`}
                    style={[styles.swatch, { backgroundColor: c }, on && { borderWidth: 3, borderColor: theme.text }]}>
                    {on ? <Ionicons name="checkmark" size={16} color={readableOn(c)} /> : null}
                  </Pressable>
                );
              })}
            </View>
          }
        />
      </ListGroup>
    </>
  );
}

const styles = StyleSheet.create({
  themeRow: { flexDirection: 'row', gap: 10, marginTop: 8, paddingRight: 4 },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
