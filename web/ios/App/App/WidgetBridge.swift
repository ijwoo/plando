//
//  WidgetBridge.swift
//  App  (메인 앱 타겟)
//
//  Capacitor 플러그인 — JS 에서 호출해 위젯에 데이터/로그인 상태를 push.
//
//  JS 사용 예:
//      import { registerPlugin } from "@capacitor/core";
//      const WidgetBridge = registerPlugin("WidgetBridge");
//      await WidgetBridge.updateTodos({ todos, total, done, workspaceName });
//      await WidgetBridge.setLoggedIn({ value: true });
//      await WidgetBridge.clear({});
//
//  Capacitor 6+ 의 CAPBridgedPlugin 패턴 (Objective-C .m 브릿지 불필요).
//  app group 은 main app + widget extension 양쪽 entitlement 에 동일하게 등록되어야 함.
//

import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridge)
public class WidgetBridge: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridge"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateTodos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLoggedIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    /// PlandoWidget/SharedDefaults.swift 와 동일해야 함.
    private let appGroupID = "group.com.imjaewoo.plando"

    private enum Keys {
        static let todayPayload = "plando.widget.todayPayload"
        static let lastUpdated  = "plando.widget.lastUpdated"
        static let isLoggedIn   = "plando.widget.isLoggedIn"
        // 위젯 인터랙티브 액션(체크박스)에서 백엔드 호출 시 사용
        static let authToken    = "plando.widget.authToken"
        static let workspaceId  = "plando.widget.workspaceId"
        static let apiBase      = "plando.widget.apiBase"
    }

    private var sharedStore: UserDefaults? {
        UserDefaults(suiteName: appGroupID)
    }

    /// JS 가 보낸 todos / 통계 / 워크스페이스 이름을 shared UserDefaults 에 저장 후 위젯 timeline reload.
    @objc func updateTodos(_ call: CAPPluginCall) {
        guard let store = sharedStore else {
            call.reject("App Group 설정 누락 — entitlement 확인 필요")
            return
        }

        let total = call.getInt("total") ?? 0
        let done  = call.getInt("done") ?? 0
        let workspaceName = call.getString("workspaceName")
        // JS 측 mapToWidgetTodo 결과 — Swift 위젯의 WidgetTodo 와 키 1:1 매칭
        let todosArray = call.getArray("todos") ?? []
        // 달력 위젯(주간/월간)용 — dueDate 기준 일정. 미존재 시 빈 배열.
        let calendarArray = call.getArray("calendarTodos") ?? []

        var payload: [String: Any] = [
            "total": total,
            "done":  done,
            "todos": todosArray,
            "calendarTodos": calendarArray
        ]
        if let name = workspaceName {
            payload["workspaceName"] = name
        }

        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
            call.reject("payload JSON encode 실패")
            return
        }

        store.set(data, forKey: Keys.todayPayload)
        store.set(ISO8601DateFormatter().string(from: Date()), forKey: Keys.lastUpdated)

        reloadWidgets()
        call.resolve()
    }

    /// 로그인 상태 토글 + 위젯 인터랙티브 액션용 토큰/워크스페이스/apiBase 저장.
    /// JS: setLoggedIn({ value: true, token, workspaceId, apiBase })
    @objc func setLoggedIn(_ call: CAPPluginCall) {
        guard let store = sharedStore else {
            call.reject("App Group 설정 누락 — entitlement 확인 필요")
            return
        }
        let value = call.getBool("value") ?? false
        store.set(value, forKey: Keys.isLoggedIn)

        if let token = call.getString("token") {
            store.set(token, forKey: Keys.authToken)
        }
        if let workspaceId = call.getString("workspaceId") {
            store.set(workspaceId, forKey: Keys.workspaceId)
        }
        if let apiBase = call.getString("apiBase") {
            store.set(apiBase, forKey: Keys.apiBase)
        }

        reloadWidgets()
        call.resolve()
    }

    /// 로그아웃 시 호출. payload + login 상태 + 토큰까지 모두 정리.
    @objc func clear(_ call: CAPPluginCall) {
        guard let store = sharedStore else {
            call.reject("App Group 설정 누락 — entitlement 확인 필요")
            return
        }
        store.removeObject(forKey: Keys.todayPayload)
        store.removeObject(forKey: Keys.lastUpdated)
        store.set(false, forKey: Keys.isLoggedIn)
        store.removeObject(forKey: Keys.authToken)
        store.removeObject(forKey: Keys.workspaceId)
        reloadWidgets()
        call.resolve()
    }

    private func reloadWidgets() {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
