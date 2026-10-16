import { Component } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

export type SocialBrand = 'kakao' | 'google' | 'apple';

/** 브랜드 로고 SVG (react-native-svg). 빌드에 svg 네이티브가 없으면 vector-icons로 폴백. */
function BrandSvg({ brand, size }: { brand: SocialBrand; size: number }) {
  if (brand === 'kakao') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill="#191600"
          d="M12 3C6.48 3 2 6.48 2 10.8c0 2.78 1.86 5.22 4.66 6.6-.2.72-.74 2.66-.84 3.08-.13.52.19.51.4.37.16-.1 2.6-1.77 3.66-2.49.7.1 1.42.16 2.12.16 5.52 0 10-3.48 10-7.72S17.52 3 12 3z"
        />
      </Svg>
    );
  }
  if (brand === 'google') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
        <Path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
        <Path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
        <Path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#FFFFFF"
        d="M16.36 12.78c.02 2.5 2.19 3.33 2.21 3.34-.02.06-.35 1.2-1.15 2.37-.69 1.02-1.41 2.03-2.54 2.05-1.11.02-1.47-.66-2.74-.66-1.27 0-1.66.64-2.71.68-1.09.04-1.92-1.1-2.62-2.11-1.42-2.07-2.51-5.84-1.05-8.39.72-1.27 2.02-2.07 3.42-2.09 1.07-.02 2.08.72 2.74.72.65 0 1.88-.89 3.17-.76.54.02 2.06.22 3.03 1.64-.08.05-1.81 1.06-1.79 3.15M14.3 5.39c.58-.71.98-1.69.87-2.67-.84.03-1.86.56-2.47 1.26-.54.62-1.01 1.62-.89 2.58.94.07 1.9-.48 2.49-1.17"
      />
    </Svg>
  );
}

const FALLBACK: Record<SocialBrand, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  kakao: { icon: 'chatbubble', color: '#191600' },
  google: { icon: 'logo-google', color: '#4285F4' },
  apple: { icon: 'logo-apple', color: '#FFFFFF' },
};

export class BrandIcon extends Component<{ brand: SocialBrand; size?: number }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    const { brand, size = 18 } = this.props;
    if (this.state.failed) {
      const f = FALLBACK[brand];
      return <Ionicons name={f.icon} size={size} color={f.color} />;
    }
    return <BrandSvg brand={brand} size={size} />;
  }
}
