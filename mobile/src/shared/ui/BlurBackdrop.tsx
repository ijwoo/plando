import { Component } from 'react';
import { BlurView, type BlurTint } from 'expo-blur';
import { StyleSheet } from 'react-native';

/**
 * expo-blur는 네이티브 모듈이라 빌드에 포함되기 전(리빌드 전)에는 BlurView 렌더가
 * 'Unimplemented component: ViewManagerAdapter_ExpoBlurView' 에러를 던진다.
 * 에러 바운더리로 잡아 투명(null)으로 폴백 → 리빌드 후엔 정상적으로 블러가 렌더된다.
 */
export class BlurBackdrop extends Component<
  { tint?: BlurTint; intensity?: number },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return (
      <BlurView
        tint={this.props.tint ?? 'systemChromeMaterial'}
        intensity={this.props.intensity ?? 80}
        style={StyleSheet.absoluteFill}
      />
    );
  }
}
