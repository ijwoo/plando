//
//  SharedDefaults.swift
//  PlandoWidget
//
//  App Group 공유 UserDefaults 접근 헬퍼.
//  - main app (Capacitor plugin) 이 write
//  - widget extension 이 read
//
//  App Group ID 는 Apple Developer 콘솔에서 발급 후
//  main app + widget extension 양쪽 entitlement 에 추가해야 동작.
//

import Foundation

enum SharedDefaults {
    /// Apple Developer 콘솔에서 발급한 App Group ID.
    /// 이 값은 main app target / widget extension target 양쪽 entitlement 에 동일하게 등록되어야 함.
    static let appGroupID = "group.com.imjaewoo.plando"

    /// shared UserDefaults 인스턴스. App Group 미설정 시 nil 가능 → fallback .standard.
    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupID) ?? .standard
    }

    /// JS 측 WidgetBridge plugin 이 write, widget extension 이 read.
    /// WidgetBridge.swift 의 Keys 와 동일.
    enum Keys {
        static let todayPayload = "plando.widget.todayPayload"   // JSON encoded TodoEntry payload
        static let lastUpdated  = "plando.widget.lastUpdated"    // ISO8601 timestamp
        static let isLoggedIn   = "plando.widget.isLoggedIn"     // Bool
        // 인터랙티브 위젯(체크박스) 백엔드 호출용
        // authToken 은 이제 키체인(PlandoSharedKeychain)에 저장 — 이 키는 구버전 폴백 전용
        static let authToken    = "plando.widget.authToken"
        static let workspaceId  = "plando.widget.workspaceId"
        static let apiBase      = "plando.widget.apiBase"
    }

    /// 인증 토큰 — App Group 키체인 우선, 없으면 구버전 평문 UserDefaults 폴백.
    /// (앱이 한 번 실행되면 setLoggedIn 이 키체인으로 이전 + 평문 키 삭제)
    static var authToken: String? {
        PlandoSharedKeychain.get() ?? defaults.string(forKey: Keys.authToken)
    }

    /// JS push payload (TodoEntry 와 매칭되는 형태).
    struct Payload: Codable {
        let total: Int
        let done: Int
        let todos: [WidgetTodo]
        let calendarTodos: [WidgetTodo]?   // 구버전 캐시 호환을 위해 옵션
        let workspaceName: String?
    }

    /// shared defaults 에서 payload 를 읽어 TodoEntry 로 변환.
    /// 데이터 없거나 디코딩 실패 시 placeholder/empty 반환.
    static func loadEntry() -> TodoEntry {
        let store = defaults
        let isLoggedIn = store.bool(forKey: Keys.isLoggedIn)
        guard isLoggedIn else { return .loggedOut }

        guard
            let raw = store.data(forKey: Keys.todayPayload),
            let payload = try? JSONDecoder().decode(Payload.self, from: raw)
        else {
            return .empty
        }

        return TodoEntry(
            date: Date(),
            total: payload.total,
            done: payload.done,
            todos: payload.todos,
            calendarTodos: payload.calendarTodos ?? [],
            workspaceName: payload.workspaceName,
            isLoggedIn: true
        )
    }
}
