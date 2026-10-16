import { registerPlugin } from "@capacitor/core";

/**
 * iOS native Widget Bridge plugin (ios/App/App/WidgetBridge.swift).
 * 메서드:
 *   - updateTodos({ todos, total, done, workspaceName })
 *   - setLoggedIn({ value: boolean })
 *   - clear({})
 *
 * 비 iOS / 비 native 환경에서는 모든 호출이 throw 가능하므로
 * 이 모듈을 직접 쓰지 말고 widgetSync.js 의 가드된 헬퍼를 사용.
 */
const WidgetBridge = registerPlugin("WidgetBridge");

export default WidgetBridge;
