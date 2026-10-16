import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { space, type } from '@/shared/ui/tokens';

import { AiCaptureMock } from './AiCaptureMock';
import { CalendarDragMock } from './CalendarDragMock';
import { DmExtractMock } from './DmExtractMock';
import { GeofenceMock } from './GeofenceMock';
import { TodoSwipeMock } from './TodoSwipeMock';
import { CYCLE, HOLD } from './timeline';
import { useTourClock } from './useTourClock';

/**
 * 온보딩 3장 — 카피 블록 + 목업.
 *
 * 장수는 3장으로 고정이다. 마지막 장이 위치·알림 권한 프라이밍이라, 장을 늘리면 권한 승인
 * 화면에 닿기 전 이탈이 늘고 지오펜스·위젯이 통째로 죽는다. 새 기능을 알리고 싶어도
 * 여기 4번째 장을 추가하지 말 것 — 더보기 탭이나 기능 내 힌트로 알린다.
 *
 * 각 슬라이드는 자기 시계를 갖고, 지금 보고 있는 장만 돈다(playing). 비활성 장의 시계까지
 * 돌면 타임라인 3개 + 앰비언트 루프가 영구히 돌아 배터리를 먹는다.
 */

export type SlideProps = { playing: boolean; reduced: boolean };

/**
 * 목업이 차지할 높이. 목업 자체는 고정 기하(컴파일 타임 상수)로 그려지므로 크기를 바꾸지 않고,
 * **위쪽부터 보여주고 아래를 잘라낸다** — "실제 화면의 한 조각"이라는 컨셉과 어긋나지 않는다.
 * SE(667pt)에서 카피 + 목업이 한계라, 작은 기기에서는 잘라내야 CTA가 밀려나지 않는다.
 */
function useMockHeight(): number {
  const { height } = useWindowDimensions();
  if (height < 700) return 168; // SE 계열
  if (height < 820) return 220;
  return 260;
}

/** 카피 블록 — 3장 공통 골격. 목업 상단선이 장마다 흔들리지 않게 높이를 맞춘다. */
function Copy({
  brand,
  headline,
  sub,
}: {
  brand?: boolean;
  headline: React.ReactNode;
  sub: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.copy}>
      {brand ? (
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: theme.backgroundElement }]}>
            <Image
              /* icon.png은 Expo 기본 아이콘(A 로고)이다 — 실제 앱 아이콘은 icon-store.png */
              source={require('../../../../assets/images/icon-store.png')}
              style={styles.brandImg}
              contentFit="cover"
            />
          </View>
          <ThemedText type="small" style={styles.brandText}>
            Plan <ThemedText type="small" style={{ color: theme.primary }}>Do!</ThemedText>
          </ThemedText>
        </View>
      ) : null}

      {/* 슬라이드 본문 카피는 접근성 글자 크기를 따른다 — 목업 안 마이크로 카피만 고정 */}
      <ThemedText type="title" style={styles.headline}>
        {headline}
      </ThemedText>
      <ThemedText type="default" style={[styles.sub, { color: theme.textSecondary }]}>
        {sub}
      </ThemedText>
    </View>
  );
}

/** 슬라이드 1 — 브랜드 + 밀어서 완료 */
function BrandTodoSlide({ playing, reduced }: SlideProps) {
  const clock = useTourClock(CYCLE.swipe, playing, HOLD.swipe);
  const mockH = useMockHeight();
  return (
    <View style={styles.slide}>
      <Copy
        brand
        headline={<>계획하고,{'\n'}함께 해내는 곳</>}
        sub={'밀어서 완료, 길게 눌러 상태 이동.\n손끝에서 바로 정리돼요.'}
      />
      <View style={[styles.mock, { height: mockH }]}>
        <TodoSwipeMock clock={clock} reduced={reduced} />
      </View>
    </View>
  );
}

/** 슬라이드 2 — AI 빠른 추가 */
function AiSlide({ playing, reduced }: SlideProps) {
  const clock = useTourClock(CYCLE.ai, playing, HOLD.ai);
  const theme = useTheme();
  const mockH = useMockHeight();
  return (
    <View style={styles.slide}>
      <Copy
        headline={
          <>
            한 줄이면{'\n'}
            <ThemedText type="title" style={[styles.headline, { color: theme.primary }]}>
              할 일이 완성
            </ThemedText>
            돼요
          </>
        }
        sub="날짜·시간·장소·우선순위까지 알아서 채워 넣어요."
      />
      <View style={[styles.mock, { height: mockH }]}>
        <AiCaptureMock clock={clock} reduced={reduced} />
      </View>
    </View>
  );
}

/** 슬라이드 3 — 위치·알림 권한 프라이밍. CTA가 실제 권한 요청이라 목업도 그 결과를 보여준다. */
function PermissionSlide({ playing, reduced }: SlideProps) {
  const clock = useTourClock(CYCLE.geofence, playing, HOLD.geofence);
  const mockH = useMockHeight();
  return (
    <View style={styles.slide}>
      <Copy
        headline={<>장소를 정해두면{'\n'}근처에서 알려드려요</>}
        sub={'도착하면 알림으로 바로 시작할 수 있어요.\n나중에 설정에서 바꿀 수 있어요.'}
      />
      <View style={[styles.mock, { height: mockH }]}>
        <GeofenceMock clock={clock} reduced={reduced} />
      </View>
    </View>
  );
}

/** 슬라이드 4 — 캘린더에서 끌어서 일정 만들기 */
function CalendarSlide({ playing, reduced }: SlideProps) {
  const clock = useTourClock(CYCLE.calendar, playing, HOLD.calendar);
  const mockH = useMockHeight();
  return (
    <View style={styles.slide}>
      <Copy
        headline={<>일정은{'\n'}끌어서 만들어요</>}
        sub={'빈 시간을 길게 눌러 쓱 끌면 그 시간에 일정이 잡혀요.'}
      />
      <View style={[styles.mock, { height: mockH }]}>
        <CalendarDragMock clock={clock} reduced={reduced} />
      </View>
    </View>
  );
}

/** 슬라이드 5 — 대화에서 할 일 추출 */
function DmSlide({ playing, reduced }: SlideProps) {
  const clock = useTourClock(CYCLE.dm, playing, HOLD.dm);
  const mockH = useMockHeight();
  return (
    <View style={styles.slide}>
      <Copy
        headline={<>대화가 그대로{'\n'}할 일이 돼요</>}
        sub={'주고받은 메시지에서 할 일만 골라 한 번에 담아요.'}
      />
      <View style={[styles.mock, { height: mockH }]}>
        <DmExtractMock clock={clock} reduced={reduced} />
      </View>
    </View>
  );
}

export const SLIDES = [BrandTodoSlide, AiSlide, PermissionSlide, CalendarSlide, DmSlide];

/**
 * 권한 요청 슬라이드의 위치(0-based). **끝이 아니라 가운데다.**
 * 장을 5장으로 늘리면서도 권한 화면 노출률을 지키려면 이 자리를 유지해야 한다 —
 * 마지막으로 밀면 거기 닿기 전에 이탈한 만큼 지오펜스·위젯·푸시가 통째로 죽는다.
 * 앞의 두 장(캡처·완료)이 가치를 먼저 보여주는 프라이밍 역할을 한다.
 */
export const PERMISSION_STEP = 2;

export const CTA = ['시작하기', '다음', '위치 · 알림 허용하기', '다음', 'Plan Do! 시작하기'];

const styles = StyleSheet.create({
  slide: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  copy: { flexShrink: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  brandMark: { width: 34, height: 34, borderRadius: 10, overflow: 'hidden' },
  brandImg: { width: '100%', height: '100%' },
  brandText: { fontWeight: '800' },
  headline: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  sub: { ...type.body, lineHeight: 23, marginTop: 12 },
  // 목업과 CTA 사이 여백 — GlassButton(실시간 블러)이 움직이는 목업을 계속 샘플링하면 비싸다
  mock: { marginTop: space[6], marginBottom: space[5], overflow: 'hidden' },
});
