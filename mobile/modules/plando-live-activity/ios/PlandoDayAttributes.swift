import ActivityKit
import Foundation

/**
 * 오늘 진행 Live Activity 속성 — 위젯 익스텐션의 동명 구조체와 반드시 동일해야 한다
 * (targets/widget/PlandoDayAttributes.swift 복제본. ActivityKit은 타입 이름·필드로 프로세스 간 매칭).
 */
struct PlandoDayAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// 오늘 완료/전체
        var done: Int
        var total: Int
        /// 다음 일정 (없으면 nil)
        var nextTitle: String?
        /// "14:00" — 다음 일정 시작 시간
        var nextTime: String?
        /// 다음 일정 todo id — 잠금화면 완료 버튼용 (없으면 nil)
        var nextId: Int?
    }

    /// 활동이 표현하는 날짜 (yyyy-MM-dd) — 날짜가 바뀌면 새 활동으로 교체
    var day: String
}
