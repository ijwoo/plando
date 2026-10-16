//
//  PlandoAppShortcuts.swift
//  PlanDo (메인 앱 타겟 — plugins/withAppShortcuts.ts 가 prebuild 시 주입)
//
//  Siri "플랜두에 할 일 추가" — 앱 실행 없이(백그라운드 앱 프로세스) 백엔드로 할 일 생성.
//  AppShortcutsProvider 와 그 인텐트는 반드시 "메인 앱 타겟"에 있어야 Siri 구문이 등록된다
//  (익스텐션/프레임워크에 두면 Shortcuts/Siri 에 노출되지 않음 — 실측으로 확인된 제약).
//  인증(token/workspaceId/apiBase)은 위젯과 동일한 App Group UserDefaults 키를 읽는다.
//  (write 주체: modules/plando-widget/ios/PlandoWidgetModule.swift — Keys 동일 유지 필수)
//

import AppIntents
import Foundation

/// App Group 공유 UserDefaults 접근 — targets/widget/SharedDefaults.swift 와 동일 값.
enum IntentSharedDefaults {
    static let appGroupID = "group.com.imjaewoo.plando"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupID) ?? .standard
    }

    enum Keys {
        // authToken 은 이제 키체인(PlandoSharedKeychain)에 저장 — 이 키는 구버전 폴백 전용
        static let authToken   = "plando.widget.authToken"
        static let workspaceId = "plando.widget.workspaceId"
        static let apiBase     = "plando.widget.apiBase"
    }

    /// 인증 토큰 — App Group 키체인 우선, 없으면 구버전 평문 UserDefaults 폴백.
    /// (앱이 한 번 실행되면 setLoggedIn 이 키체인으로 이전 + 평문 키 삭제)
    static var authToken: String? {
        PlandoSharedKeychain.get() ?? defaults.string(forKey: Keys.authToken)
    }

    /// 앱이 apiBase 를 아직 안 써놨을 때의 폴백 — src/shared/config/env.ts 의 프로덕션 기본값과 동일.
    static let defaultApiBase = "https://plando.imjaewoo.dev"
}

@available(iOS 17.0, *)
struct AddTodoIntent: AppIntent {
    static var title: LocalizedStringResource = "할 일 추가"
    static var description = IntentDescription("Plan Do!에 새 할 일을 추가합니다.")

    /// 앱 UI를 띄우지 않고 백그라운드에서 수행 (Siri 음성만으로 완결).
    static var openAppWhenRun = false

    @Parameter(title: "할 일", requestValueDialog: "무엇을 추가할까요?")
    var title: String

    init() {}
    init(title: String) {
        self.title = title
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let store = IntentSharedDefaults.defaults

        // 토큰은 키체인 우선(구버전 UserDefaults 폴백)
        guard let token = IntentSharedDefaults.authToken else {
            return .result(dialog: "먼저 Plan Do! 앱에 로그인해주세요")
        }

        let apiBase = store.string(forKey: IntentSharedDefaults.Keys.apiBase)
            ?? IntentSharedDefaults.defaultApiBase
        guard let url = URL(string: "\(apiBase)/api/todos/quick") else {
            return .result(dialog: "추가하지 못했어요. 앱에서 다시 시도해주세요")
        }

        /* POST /api/todos/quick — 문장을 그대로 보내고 서버가 해석한다.
           예전엔 문장을 제목에 통째로 넣어서 "내일 3시 킥오프" 가 제목이 되고 마감은 비었다.
           파싱을 여기(Swift)에 두면 앱의 규칙(parseKoreanTask.ts)과 두 벌이 되어 같은 문장이
           경로마다 다르게 해석된다 — 그래서 서버 한 곳에서만 판단한다. */
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let workspaceId = store.string(forKey: IntentSharedDefaults.Keys.workspaceId) {
            request.setValue(workspaceId, forHTTPHeaderField: "X-Workspace-Id")
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["text": title])
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return .result(dialog: "추가하지 못했어요. 앱에서 다시 시도해주세요")
            }
            /* 서버가 정리한 제목·마감을 되읽어 말해준다. 말한 문장을 그대로 되뇌면
               날짜가 제대로 잡혔는지 알 수 없다 — "내일" 이 마감으로 갔는지 제목에 남았는지. */
            var saved = title
            var when = ""
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let t = json["title"] as? String, !t.isEmpty { saved = t }
                if let d = json["dueDate"] as? String, d.count >= 10 {
                    let m = d.prefix(7).suffix(2), day = d.prefix(10).suffix(2)
                    when = "\(Int(m) ?? 0)월 \(Int(day) ?? 0)일 "
                }
            }
            return .result(dialog: "\(when)'\(saved)' 추가했어요")
        } catch {
            return .result(dialog: "추가하지 못했어요. 앱에서 다시 시도해주세요")
        }
    }
}

@available(iOS 17.0, *)
struct PlandoAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddTodoIntent(),
            // 시스템 도메인(미리알림·캘린더·메모)과 겹치는 범용 구문('일정 추가' 등)은
            // 앱 선택 창을 유발 → 앱 이름이 또렷한 '할 일' 구문만 유지
            phrases: [
                "\(.applicationName)에 할 일 추가",
                "\(.applicationName)에 할 일 추가해줘",
                "\(.applicationName)에서 할 일 추가",
                "\(.applicationName)에서 할 일 추가해줘",
                "\(.applicationName) 할 일 추가",
                "\(.applicationName) 할 일 추가해줘",
                "\(.applicationName)에 할 일 등록해줘",
            ],
            shortTitle: "할 일 추가",
            systemImageName: "plus.circle.fill"
        )
    }
}
