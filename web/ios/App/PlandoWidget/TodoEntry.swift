//
//  TodoEntry.swift
//  PlandoWidget
//
//  TimelineEntry + 공유 데이터 모델.
//  JS(React)에서 shared UserDefaults 에 JSON 으로 push 하는 형태와 1:1 매칭.
//

import WidgetKit
import Foundation

/// 단일 task 표시 모델. JS 측 push payload 와 키 1:1 매칭.
/// Plando 데이터 모델에 시간(시:분) 칼럼이 없어 시간은 표시하지 않음. dDay 만 사용.
struct WidgetTodo: Codable, Identifiable, Hashable {
    let id: Int
    let title: String
    let priority: String       // "HIGH" | "MEDIUM" | "LOW"
    let status: String         // "TODO" | "IN_PROGRESS" | "DONE"
    let starred: Bool
    let dueDate: String?       // ISO8601 (날짜)
    let dDay: String?          // "D-1", "D-day", "D+2" 등 미리 포맷된 라벨 (옵션)
    let projectId: Int?        // 달력 위젯 카테고리 색 재현용 (없으면 id 로 대체)

    // JS payload 에 projectId 가 빠진 과거 캐시도 디코딩되도록 옵션 기본값 처리.
    enum CodingKeys: String, CodingKey {
        case id, title, priority, status, starred, dueDate, dDay, projectId
    }
    init(id: Int, title: String, priority: String, status: String,
         starred: Bool, dueDate: String?, dDay: String?, projectId: Int? = nil) {
        self.id = id; self.title = title; self.priority = priority; self.status = status
        self.starred = starred; self.dueDate = dueDate; self.dDay = dDay; self.projectId = projectId
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(Int.self, forKey: .id)) ?? 0
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        priority = (try? c.decode(String.self, forKey: .priority)) ?? "LOW"
        status = (try? c.decode(String.self, forKey: .status)) ?? "TODO"
        starred = (try? c.decode(Bool.self, forKey: .starred)) ?? false
        dueDate = try? c.decodeIfPresent(String.self, forKey: .dueDate)
        dDay = try? c.decodeIfPresent(String.self, forKey: .dDay)
        projectId = try? c.decodeIfPresent(Int.self, forKey: .projectId)
    }
}

/// 위젯 timeline entry. WidgetKit 이 시간 단위로 호출.
struct TodoEntry: TimelineEntry {
    let date: Date
    let total: Int                  // 오늘 task 총 개수
    let done: Int                   // 오늘 완료 개수
    let todos: [WidgetTodo]         // 정렬된 오늘 task. featured(별표 우선) → 시간순
    let calendarTodos: [WidgetTodo] // 달력 위젯(주간/월간)용 — dueDate 기준 일정
    let workspaceName: String?
    let isLoggedIn: Bool

    /// 미리보기/플레이스홀더용 — 오늘 기준 상대 날짜의 yyyy-MM-dd 문자열.
    private static func sampleDate(_ dayOffset: Int) -> String {
        let cal = Calendar.current
        let d = cal.date(byAdding: .day, value: dayOffset, to: Date()) ?? Date()
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    static var placeholder: TodoEntry {
        TodoEntry(
            date: Date(),
            total: 9,
            done: 2,
            todos: [
                WidgetTodo(id: 1, title: "보고서 작성", priority: "HIGH", status: "TODO",
                           starred: true, dueDate: sampleDate(0), dDay: "D-day", projectId: 0),
                WidgetTodo(id: 2, title: "운동", priority: "MEDIUM", status: "IN_PROGRESS",
                           starred: false, dueDate: sampleDate(0), dDay: nil, projectId: 3),
                WidgetTodo(id: 3, title: "디자인 리뷰", priority: "LOW", status: "TODO",
                           starred: false, dueDate: sampleDate(0), dDay: nil, projectId: 1),
                WidgetTodo(id: 8, title: "장보기", priority: "LOW", status: "TODO",
                           starred: false, dueDate: sampleDate(0), dDay: nil, projectId: 2),
                WidgetTodo(id: 9, title: "이메일 회신", priority: "MEDIUM", status: "DONE",
                           starred: false, dueDate: sampleDate(0), dDay: nil, projectId: 0),
                WidgetTodo(id: 10, title: "팀 회의 준비", priority: "HIGH", status: "TODO",
                           starred: false, dueDate: sampleDate(0), dDay: nil, projectId: 1),
                WidgetTodo(id: 11, title: "독서 30분", priority: "LOW", status: "DONE",
                           starred: false, dueDate: sampleDate(0), dDay: nil, projectId: 4),
                WidgetTodo(id: 12, title: "약 복용", priority: "LOW", status: "TODO",
                           starred: false, dueDate: sampleDate(0), dDay: nil, projectId: 5)
            ],
            calendarTodos: [
                WidgetTodo(id: 1, title: "보고서 작성", priority: "HIGH", status: "TODO",
                           starred: true, dueDate: sampleDate(0), dDay: "D-day", projectId: 0),
                WidgetTodo(id: 4, title: "팀 미팅", priority: "MEDIUM", status: "TODO",
                           starred: false, dueDate: sampleDate(1), dDay: "D-1", projectId: 1),
                WidgetTodo(id: 5, title: "점심 약속", priority: "LOW", status: "TODO",
                           starred: false, dueDate: sampleDate(2), dDay: "D-2", projectId: 2),
                WidgetTodo(id: 6, title: "헬스장", priority: "LOW", status: "DONE",
                           starred: false, dueDate: sampleDate(-1), dDay: "D+1", projectId: 3),
                WidgetTodo(id: 7, title: "사이드 프로젝트", priority: "MEDIUM", status: "TODO",
                           starred: false, dueDate: sampleDate(5), dDay: "D-5", projectId: 4)
            ],
            workspaceName: "내 워크스페이스",
            isLoggedIn: true
        )
    }

    static let empty = TodoEntry(
        date: Date(),
        total: 0,
        done: 0,
        todos: [],
        calendarTodos: [],
        workspaceName: "내 워크스페이스",
        isLoggedIn: true
    )

    static let loggedOut = TodoEntry(
        date: Date(),
        total: 0,
        done: 0,
        todos: [],
        calendarTodos: [],
        workspaceName: nil,
        isLoggedIn: false
    )
}
