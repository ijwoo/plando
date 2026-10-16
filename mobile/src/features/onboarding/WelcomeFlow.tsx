import { useCallback, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { registerForPush } from '@/features/notification/push';
import { useTheme } from '@/hooks/use-theme';
import { tickHaptic } from '@/shared/ui/haptics';
import { GlassButton } from '@/shared/ui/GlassButton';

import { CTA, PERMISSION_STEP, SLIDES } from './tour/slides';
import { useTourReduced } from './tour/useTourReduced';

/**
 * 온보딩 환영 플로우 — 셸만 담당한다(페이저·도트·건너뛰기·CTA·권한 요청).
 * 각 장의 내용과 애니메이션은 tour/slides.tsx 아래에 있다.
 *
 * 5장을 모두 마운트하되 **시계는 지금 보고 있는 장만** 돈다(playing) — 비활성 장까지 돌면
 * 타임라인이 영구히 돌아 배터리를 먹는다.
 */

/**
 * 권한 슬라이드 CTA — 알림·위치 권한 프라이밍 (웹 WelcomeFlow requestPermissions 미러).
 * 알림은 push.ts registerForPush 재사용(권한 요청 + APNs 토큰 등록까지, 거부/모듈 없음은 내부에서 무시).
 * 위치는 포그라운드 권한만. 어느 쪽을 거부해도 그대로 다음 장으로 넘어간다.
 */
async function requestOnboardingPermissions(): Promise<void> {
  await registerForPush(); // 내부 try/catch — 실패해도 throw 없음
  try {
    await Location.requestForegroundPermissionsAsync();
  } catch {
    // 권한 거부/네이티브 모듈 없음 — 무시하고 진행
  }
}

export function WelcomeFlow({ onComplete }: { onComplete: () => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { reduced, ready } = useTourReduced();
  const pagerRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const last = step === SLIDES.length - 1;

  const goTo = useCallback(
    (to: number) => {
      // reduced-motion이면 페이지 전환도 즉시 — 스크롤 애니메이션 자체가 모션이다
      pagerRef.current?.scrollTo({ x: width * to, animated: !reduced });
      setStep(to); // 스크롤 콜백을 기다리지 않고 즉시 갱신 (animated:false면 콜백이 안 온다)
    },
    [reduced, width],
  );

  const next = useCallback(() => {
    if (busy) return;

    // 권한 슬라이드(가운데) — 요청 후에도 온보딩은 계속된다. 여기서 끝나지 않는다.
    if (step === PERMISSION_STEP) {
      setBusy(true);
      void (async () => {
        try {
          await requestOnboardingPermissions();
        } finally {
          setBusy(false);
          goTo(PERMISSION_STEP + 1); // 승인/거부와 무관하게 다음 장으로
        }
      })();
      return;
    }

    if (!last) {
      goTo(step + 1);
      return;
    }

    onComplete(); // 마지막 장 — 기존 완료 플로우(샘플 시딩 포함) 그대로
  }, [busy, goTo, last, onComplete, step]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}>
      {/* 건너뛰기는 마지막 장까지 항상 노출한다. 장마다 있다 없다 하면 상단이 비어 보이고,
          어디서든 빠져나갈 수 있다는 게 온보딩의 기본 예의다. */}
      <View style={styles.top}>
        <Pressable onPress={onComplete} hitSlop={8} style={styles.skip}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            건너뛰기
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) =>
          setStep(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={styles.pager}>
        {SLIDES.map((Slide, i) => (
          <View key={i} style={{ width }}>
            <Slide playing={ready && !reduced && step === i} reduced={reduced} />
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === step ? theme.primary : theme.backgroundSelected },
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.ctaBox}>
          <GlassButton title={CTA[step]} onPress={next} loading={step === PERMISSION_STEP && busy} />
          {/* 보조 버튼 자리는 장과 무관하게 항상 확보한다 — 이 줄이 있다 없다 하면
              CTA·도트가 세로로 튀어 페이지 전환이 지저분해진다.
              권한 장의 보조 선택지: 예전엔 '권한 없이 시작하기'(=온보딩 종료)였지만 권한 장이
              가운데로 옮겨졌으므로, 권한만 건너뛰고 나머지 소개는 이어간다. */}
          <View style={styles.subSlot}>
          {step === PERMISSION_STEP ? (
            <Pressable
              onPress={() => {
                if (busy) return;
                tickHaptic();
                goTo(PERMISSION_STEP + 1);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="나중에 할게요"
              style={styles.noPermBtn}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>
                나중에 할게요
              </ThemedText>
            </Pressable>
          ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { height: 40, justifyContent: 'center', paddingHorizontal: 20 },
  skip: { alignSelf: 'flex-end' },
  pager: { flex: 1 },
  bottom: { paddingHorizontal: 28, paddingBottom: 12, gap: 20 },
  ctaBox: { gap: 12 },
  noPermBtn: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  subSlot: { height: 26, justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22 },
});
