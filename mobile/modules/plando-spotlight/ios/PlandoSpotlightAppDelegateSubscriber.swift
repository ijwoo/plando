import ExpoModulesCore
import CoreSpotlight

/**
 * Spotlight 결과 탭 처리 — CSSearchableItemActionType NSUserActivity를 받아
 * uniqueIdentifier("todo-<id>")를 plando://todo/<id> 딥링크로 변환해 다시 연다.
 * (expo-linking의 LinkingAppDelegateSubscriber가 application(_:open:)에서 URL을 받아
 *  initialURL 저장 + 이벤트 발행 → expo-router가 todo/[id] 화면으로 라우팅)
 */
public class PlandoSpotlightAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([any UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    guard userActivity.activityType == CSSearchableItemActionType,
          let uniqueId = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
          uniqueId.hasPrefix("todo-"),
          let url = URL(string: "plando://todo/\(uniqueId.dropFirst("todo-".count))")
    else {
      return false
    }
    // 자기 자신의 커스텀 스킴을 열어 표준 openURL 경로로 재진입시킨다
    DispatchQueue.main.async {
      UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
    return true
  }
}
