import { Component } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

/**
 * 네이티브 SF Symbol(expo-symbols). 빌드에 네이티브가 없으면 'Unimplemented component'를
 * 던지므로 에러 바운더리로 잡아 Ionicons로 폴백한다.
 */
export class NativeSymbol extends Component<
  { name: SymbolViewProps['name']; fallback: keyof typeof Ionicons.glyphMap; size: number; color: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    const { name, fallback, size, color } = this.props;
    if (this.state.failed) return <Ionicons name={fallback} size={size} color={color} />;
    return <SymbolView name={name} size={size} tintColor={color} resizeMode="scaleAspectFit" />;
  }
}
