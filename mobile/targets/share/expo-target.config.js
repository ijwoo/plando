/**
 * PlandoShare — 공유 확장 타겟. 사파리/카톡 등에서 텍스트·링크를 공유받아
 * App Group 인박스에 저장하면 본앱이 포그라운드에서 소비해 할 일 작성으로 잇는다.
 */
/** @type {import('@bacons/apple-targets').Config} */
const CUTOVER = process.env.PLANDO_CUTOVER === '1';

module.exports = {
  type: 'share',
  name: 'PlandoShare',
  displayName: 'Plan Do!',
  bundleIdentifier: (CUTOVER ? 'com.imjaewoo.plando' : 'com.imjaewoo.plando.rn') + '.PlandoShare',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.imjaewoo.plando'],
  },
  infoPlist: {
    NSExtension: {
      NSExtensionPointIdentifier: 'com.apple.share-services',
      NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).ShareViewController',
      NSExtensionAttributes: {
        // 텍스트 또는 웹 링크 1개 공유 시에만 노출
        NSExtensionActivationRule: {
          NSExtensionActivationSupportsText: true,
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
        },
      },
    },
  },
  frameworks: ['UIKit'],
};
