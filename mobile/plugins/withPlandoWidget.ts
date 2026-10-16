import type { ConfigPlugin } from 'expo/config-plugins';

/**
 * 기존 WidgetKit 익스텐션을 prebuild 결과물에 주입하는 config plugin — 스텁(Phase 5).
 * 아직 app.config.ts에 연결하지 않음.
 *
 * 구현 시 (withXcodeProject / withEntitlements로):
 *   1. frontend-todo/ios/App/PlandoWidget/* 를 새 app-extension 타겟으로 복사.
 *   2. App Group entitlement(group.com.imjaewoo.plando)를 메인 앱과 위젯 타겟 양쪽에 추가.
 *   3. deployment target / Swift 버전을 Expo iOS 프로젝트에 맞춤.
 *   4. 위젯 bundle id는 <appBundleId>.PlandoWidget로 유지.
 *
 * 그 전까지는 부작용 없이 참조 가능하도록 no-op이다.
 */
const withPlandoWidget: ConfigPlugin = (config) => {
  return config;
};

export default withPlandoWidget;
