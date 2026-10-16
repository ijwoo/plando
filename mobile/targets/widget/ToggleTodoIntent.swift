//
//  ToggleTodoIntent.swift
//  PlandoWidgetExtension
//
//  Created by jaewoo on 5/10/26.
//

import Foundation

import AppIntents
  import WidgetKit
                                                                                                                          
  @available(iOS 17.0, *)
  struct ToggleTodoIntent: AppIntent {
      static var title: LocalizedStringResource = "할 일 완료"
      static var description = IntentDescription("위젯에서 할 일을 완료 처리합니다.")
                                                                                                                        
      @Parameter(title: "Todo ID")
      var todoId: Int
                                                           
      init() {}
      init(todoId: Int) {
          self.todoId = todoId
      }
                                                                                                                          
      func perform() async throws -> some IntentResult {
        let store = SharedDefaults.defaults

        // 1) Optimistic UI — SharedDefaults 의 payload 를 즉시 수정해서 위젯에 바로 반영.
        //    메인 앱이 다음에 켜지면 updateTodos 로 정정됨.
        markTodoDoneInSharedDefaults(store: store)

        // 2) 위젯 즉시 reload — 사용자에게 즉각 피드백
        WidgetCenter.shared.reloadAllTimelines()

        // 3) 백엔드 호출 (백그라운드) — 토큰은 키체인 우선(구버전 UserDefaults 폴백)
        guard
            let token = SharedDefaults.authToken,
            let apiBase = store.string(forKey: SharedDefaults.Keys.apiBase),
            let url = URL(string: "\(apiBase)/api/todos/\(todoId)/status")
        else {
            return .result()
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let workspaceId = store.string(forKey: SharedDefaults.Keys.workspaceId) {
            request.setValue(workspaceId, forHTTPHeaderField: "X-Workspace-Id")
        }
        request.httpBody = #"{"status":"DONE"}"#.data(using: .utf8)
        request.timeoutInterval = 10

        do {
            _ = try await URLSession.shared.data(for: request)
        } catch {
            // 실패 silent — 다음 sync 때 보정됨
        }

        return .result()
    }

    /// SharedDefaults 의 payload 에서 해당 todo 의 status 를 DONE 으로 마킹.
    /// done count 도 같이 갱신.
    private func markTodoDoneInSharedDefaults(store: UserDefaults) {
        guard
            let raw = store.data(forKey: SharedDefaults.Keys.todayPayload),
            var payload = try? JSONSerialization.jsonObject(with: raw, options: []) as? [String: Any],
            var todos = payload["todos"] as? [[String: Any]]
        else { return }

        var changed = false
        for i in 0..<todos.count {
            if let id = todos[i]["id"] as? Int, id == todoId,
               (todos[i]["status"] as? String) != "DONE" {
                todos[i]["status"] = "DONE"
                changed = true
            }
        }
        guard changed else { return }

        let doneCount = todos.filter { ($0["status"] as? String) == "DONE" }.count
        payload["todos"] = todos
        payload["done"] = doneCount

        if let newRaw = try? JSONSerialization.data(withJSONObject: payload, options: []) {
            store.set(newRaw, forKey: SharedDefaults.Keys.todayPayload)
        }
    }
  }        
