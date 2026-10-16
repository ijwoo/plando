/**
 * PlandoWidget — WidgetKit 익스텐션 타겟 (@bacons/apple-targets가 prebuild 시 Xcode 타겟 생성).
 * Swift 소스는 기존 Capacitor 앱(frontend-todo/ios/App/PlandoWidget) 재사용 — App Group·키 동일해
 * 컷오버 시 위젯 데이터가 그대로 승계된다.
 */
/** @type {import('@bacons/apple-targets').Config} */
const CUTOVER = process.env.PLANDO_CUTOVER === '1';

module.exports = {
  type: 'widget',
  name: 'PlandoWidget',
  bundleIdentifier: (CUTOVER ? 'com.imjaewoo.plando' : 'com.imjaewoo.plando.rn') + '.PlandoWidget',
  deploymentTarget: '17.0', // ToggleTodoIntent(AppIntents interactive widget) 요구
  entitlements: {
    'com.apple.security.application-groups': ['group.com.imjaewoo.plando'],
  },
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
};
