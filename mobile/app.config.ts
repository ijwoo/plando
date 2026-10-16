import type { ExpoConfig } from 'expo/config';

/**
 * Expo 앱 설정(빌드 시 env를 읽기 위해 app.json을 대체).
 *
 * bundle id는 DEV용(`...plando.rn`)이라 현재 Capacitor 앱과 나란히 설치된다.
 * 컷오버(Phase 8) 시 `com.imjaewoo.plando`로 전환해, 기존 유저가 업데이트로 받고
 * 위젯 / App Group을 그대로 승계하게 한다.
 */
// TestFlight/컷오버 빌드: PLANDO_CUTOVER=1 → 본번들(com.imjaewoo.plando)·v2.0.0 (기존 Capacitor 1.2.1 계승)
const CUTOVER = process.env.PLANDO_CUTOVER === '1';

const config: ExpoConfig = {
  name: 'Plan Do!',
  slug: 'plando',
  owner: process.env.EXPO_OWNER, // 공개 스냅샷: 계정 식별자는 환경변수로 뺐다
  version: CUTOVER ? '2.0.22' : '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'plando',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false, // 기존 스토어 앱과 동일하게 iPhone 전용 (iPad 레이아웃 검증 후 확장)
    // 컷오버 빌드는 기존 스토어 앱 아이콘 + iOS 18 다크/틴트 변형 (다크 홈화면·틴트 모드 대응)
    icon: CUTOVER
      ? {
          light: './assets/images/icon-store.png',
          dark: './assets/images/icon-dark.png',
          tinted: './assets/images/icon-tinted.png',
        }
      : './assets/expo.icon',
    bundleIdentifier: CUTOVER ? 'com.imjaewoo.plando' : 'com.imjaewoo.plando.rn',
    appleTeamId: process.env.APPLE_TEAM_ID, // 위젯 타겟 서명(@bacons/apple-targets 요구)
    infoPlist: {
      // 앱 기본/지원 언어 = 한국어. 이게 없으면 개발 리전이 en으로 잡혀
      // OS 제공 UI(ActionSheet '취소', 날짜/시간 피커 월·요일, 시스템 다이얼로그)가
      // 한국어 기기에서도 영어로 폴백됨. ko를 먼저 선언해 한국어로 렌더링.
      CFBundleDevelopmentRegion: 'ko',
      CFBundleLocalizations: ['ko', 'en'],
      ITSAppUsesNonExemptEncryption: false, // 표준(HTTPS) 암호화만 — TestFlight 규정 질문 자동 응답
      NSSupportsLiveActivities: true, // 오늘 진행 Live Activity (잠금화면·다이나믹 아일랜드)
      CFBundleSpokenName: '플랜두', // VoiceOver 등 발음 안내
      // Siri 앱 이름 별칭 (최대 3개) — "플랜두"로 불러도 우리 앱으로 라우팅
      INAlternativeAppNames: [
        { INAlternativeAppName: '플랜두' },
        { INAlternativeAppName: 'Plan Do' },
        { INAlternativeAppName: '플랜 두', INAlternativeAppNamePronunciationHint: '플랜두' },
      ],
    },
    usesAppleSignIn: true,
    // 유니버설 링크 — 서버에 /.well-known/apple-app-site-association 배포 필요(팀ID.번들ID)
    associatedDomains: ['applinks:plando.imjaewoo.dev'],
    // 원격 푸시(APNs) — 프로비저닝 프로필에 Push Notifications capability 필요
    entitlements: {
      // EAS production 아카이브는 실서비스 APNs — 하드코딩 시 릴리즈에서 푸시가 조용히 죽는다
      'aps-environment': process.env.EAS_BUILD_PROFILE === 'production' ? 'production' : 'development',
      // 위젯과 공유하는 App Group — 기존 Capacitor 앱과 동일 id (컷오버 승계)
      'com.apple.security.application-groups': ['group.com.imjaewoo.plando'],
    },
  },
  android: {
    package: 'com.imjaewoo.plando.rn',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY
      ? { config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY } } }
      : {}),
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    './plugins/withAppShortcuts.js',
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        // 기존 Capacitor 앱 스플래시 재현 — 블루 배경 + 체크/워드마크 (배경색은 원본 그라디언트 중앙값)
        backgroundColor: '#3070EB',
        image: './assets/images/splash-logo.png',
        imageWidth: 150,
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      { photosPermission: '사진을 첨부하려면 사진 보관함 접근 권한이 필요해요.' },
    ],
    [
      'expo-speech-recognition',
      {
        microphonePermission: '음성으로 할 일을 입력하려면 마이크 권한이 필요해요.',
        speechRecognitionPermission: '음성을 텍스트로 바꾸려면 음성 인식 권한이 필요해요.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: '지도 일정의 도착 알림을 위해 위치 접근 권한이 필요해요.',
        locationAlwaysAndWhenInUsePermission: '앱이 꺼져 있어도 장소 도착을 감지해 알림을 보내려면 위치 "항상 허용"이 필요해요.',
        isIosBackgroundLocationEnabled: true,
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: '받은 사진을 저장하려면 사진 라이브러리 접근 권한이 필요해요.',
        savePhotosPermission: '사진을 저장하려면 권한이 필요해요.',
      },
    ],
    ['expo-notifications', { color: '#208AEF' }],
    [
      'expo-local-authentication',
      { faceIDPermission: '앱 잠금을 해제하려면 Face ID가 필요해요.' },
    ],
    'expo-quick-actions',
    'expo-apple-authentication',
    '@bacons/apple-targets', // targets/widget → PlandoWidget 익스텐션 타겟 생성
    // Sentry — EXPO_PUBLIC_SENTRY_DSN 설정 시 크래시 수집. 소스맵 업로드는 SENTRY_ORG/PROJECT/AUTH_TOKEN 필요
    ...(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
      ? [['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }] as [string, object]]
      : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

export default config;
