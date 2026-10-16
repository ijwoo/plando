import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { AUTH } from './AuthUi';

/**
 * 로그인/회원가입/초대 공통 배경 — 웹 AUTH_PAGE_BG_MODERN 1:1 미러 (라이트 고정).
 *   radial-gradient(at 10% -10%, rgba(27,111,245,.10) → transparent)
 *   radial-gradient(at 110% 110%, rgba(124,58,237,.08) → transparent)
 *   linear-gradient(180deg, #F4F7FC → #EAF1FB)
 * 불투명하게 전체를 덮으므로 앱 테마(다크 포함)와 무관하게 동일한 톤을 낸다.
 */
export function AuthBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="authBase" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={AUTH.bgTop} />
            <Stop offset="100%" stopColor={AUTH.bgBottom} />
          </LinearGradient>
          <RadialGradient id="authBlue" cx="10%" cy="-5%" rx="90%" ry="45%">
            <Stop offset="0%" stopColor="#1B6FF5" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#1B6FF5" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authPurple" cx="105%" cy="105%" rx="80%" ry="40%">
            <Stop offset="0%" stopColor="#7C3AED" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authBase)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authBlue)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authPurple)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // SVG가 그려지기 전 첫 프레임에도 같은 톤 유지
  base: { backgroundColor: '#F4F7FC' },
});
