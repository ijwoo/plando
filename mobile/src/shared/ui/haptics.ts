import * as Haptics from 'expo-haptics';

/**
 * 가벼운 선택 틱 햅틱 (캘린더 달/주/일 전환 등).
 * 네이티브 모듈이 없는 빌드(구 dev 빌드)에서도 안전하게 no-op 되도록 reject를 삼킨다.
 */
export function tickHaptic(): void {
  Haptics.selectionAsync().catch(() => {});
}

/**
 * 강한 임팩트 햅틱 (스와이프가 완료 임계점을 넘는 순간 등 명확히 느껴야 하는 경우).
 * 선택 틱보다 묵직하다. 네이티브 모듈 없는 빌드에서도 안전하게 no-op.
 */
export function impactHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Heavy): void {
  Haptics.impactAsync(style).catch(() => {});
}
