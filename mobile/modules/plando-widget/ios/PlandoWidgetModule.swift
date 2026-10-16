import ExpoModulesCore
import WidgetKit

/**
 * 위젯 브릿지 — 기존 Capacitor WidgetBridge.swift와 동일한 App Group·키 계약.
 * (컷오버 시 기존 위젯이 새 앱의 데이터를 그대로 읽는다)
 */
public class PlandoWidgetModule: Module {
  private let appGroupID = "group.com.imjaewoo.plando"

  private enum Keys {
    static let todayPayload = "plando.widget.todayPayload"
    static let lastUpdated  = "plando.widget.lastUpdated"
    static let isLoggedIn   = "plando.widget.isLoggedIn"
    /// 구버전(평문 UserDefaults) 토큰 키 — 지금은 키체인(PlandoSharedKeychain)으로 이전됨.
    /// 이전 설치 잔재 정리(삭제)에만 사용하고 새로 쓰지 않는다.
    static let authToken    = "plando.widget.authToken"
    static let workspaceId  = "plando.widget.workspaceId"
    static let apiBase      = "plando.widget.apiBase"
    static let shareInbox   = "plando.share.inbox"
    /// 앱 잠금 설정 — PlandoPrivacyShieldSubscriber 가 읽는다 (기기 설정이라 clear 에서 유지)
    static let appLockEnabled = "plando.applock.enabled"
  }

  private var store: UserDefaults? { UserDefaults(suiteName: appGroupID) }

  private func reloadTimelines() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  public func definition() -> ModuleDefinition {
    Name("PlandoWidget")

    /// payloadJson: {total, done, todos[], calendarTodos[], workspaceName?} — 위젯 Payload(Codable)와 1:1
    Function("updateTodos") { (payloadJson: String) in
      guard let store = self.store, let data = payloadJson.data(using: .utf8) else { return }
      store.set(data, forKey: Keys.todayPayload)
      store.set(ISO8601DateFormatter().string(from: Date()), forKey: Keys.lastUpdated)
      self.reloadTimelines()
    }

    /// 로그인 상태 + 인터랙티브 체크박스용 토큰/워크스페이스/API 베이스
    /// 토큰은 App Group 키체인(PlandoSharedKeychain)에 저장 — 평문 UserDefaults 금지.
    Function("setLoggedIn") { (value: Bool, token: String?, workspaceId: String?, apiBase: String?) in
      guard let store = self.store else { return }
      store.set(value, forKey: Keys.isLoggedIn)
      if let token {
        PlandoSharedKeychain.set(token)
        // 이전 버전이 평문으로 남긴 토큰 제거 — 키체인 이전 완료 후에만 지운다
        store.removeObject(forKey: Keys.authToken)
      }
      if let workspaceId { store.set(workspaceId, forKey: Keys.workspaceId) }
      if let apiBase { store.set(apiBase, forKey: Keys.apiBase) }
      self.reloadTimelines()
    }

    /// 로그아웃 — 스냅샷·토큰 제거
    Function("clear") {
      guard let store = self.store else { return }
      store.removeObject(forKey: Keys.todayPayload)
      store.removeObject(forKey: Keys.lastUpdated)
      store.set(false, forKey: Keys.isLoggedIn)
      PlandoSharedKeychain.delete()
      store.removeObject(forKey: Keys.authToken) // 구버전 평문 잔재도 함께 제거
      store.removeObject(forKey: Keys.workspaceId)
      store.removeObject(forKey: Keys.apiBase)
      store.removeObject(forKey: Keys.shareInbox) // 공유 인박스 잔재가 다음 계정에 프리필되지 않게
      // Keys.appLockEnabled 는 계정이 아니라 "기기" 설정이므로 로그아웃에도 유지
      self.reloadTimelines()
    }

    /// 앱 잠금(Face ID) 설정 동기화 — 앱 스위처 스냅샷 커버(PlandoPrivacyShieldSubscriber)가 읽는다.
    Function("setAppLockEnabled") { (value: Bool) in
      self.store?.set(value, forKey: Keys.appLockEnabled)
    }

    /// 공유 확장 인박스 소비 — JSON 배열 문자열 반환 후 비움 (없으면 nil)
    Function("consumeShareInbox") { () -> String? in
      guard let store = self.store, let data = store.data(forKey: Keys.shareInbox) else { return nil }
      store.removeObject(forKey: Keys.shareInbox)
      return String(data: data, encoding: .utf8)
    }
  }
}
