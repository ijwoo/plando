//
//  CalendarSupport.swift
//  PlandoWidget
//
//  주간/월간 달력 위젯 공용 날짜 헬퍼.
//  WidgetPreview.jsx 의 ymd / buildMonthCells / 주간 계산을 Swift 로 이식.
//  Plando dueDate 는 날짜(시간 없음)이므로 일자 키("yyyy-MM-dd") 문자열 비교로 처리 (타임존 무관).
//

import Foundation

enum CalSupport {
    static let weekdaySymbols = ["일", "월", "화", "수", "목", "금", "토"]

    private static var dayFormatter: DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }

    static func dayKey(_ date: Date) -> String { dayFormatter.string(from: date) }

    /// todo dueDate("2026-06-20" 또는 ISO datetime) → "yyyy-MM-dd" 일자 키.
    static func dayKey(of todo: WidgetTodo) -> String? {
        guard let raw = todo.dueDate, raw.count >= 10 else { return nil }
        return String(raw.prefix(10))
    }

    /// 일정 일자별 그룹.
    static func groupByDay(_ todos: [WidgetTodo]) -> [String: [WidgetTodo]] {
        var map: [String: [WidgetTodo]] = [:]
        for t in todos { if let k = dayKey(of: t) { map[k, default: []].append(t) } }
        return map
    }

    // MARK: - Week (일요일 시작, 오늘 포함 주)

    static func currentWeek(now: Date = Date()) -> [Date] {
        let cal = Calendar.current
        let weekday = cal.component(.weekday, from: now) // 1 = 일요일
        let start = cal.date(byAdding: .day, value: -(weekday - 1), to: cal.startOfDay(for: now)) ?? now
        return (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
    }

    static func mdLabel(_ d: Date) -> String {
        let cal = Calendar.current
        return "\(cal.component(.month, from: d)).\(cal.component(.day, from: d))"
    }

    static func weekRangeLabel(_ days: [Date]) -> String {
        guard let f = days.first, let l = days.last else { return "" }
        return "\(mdLabel(f)) – \(mdLabel(l))"
    }

    static func dayNumber(_ d: Date) -> Int { Calendar.current.component(.day, from: d) }

    /// 주간 일정 리스트용 라벨: 오늘 / 내일 / "M.D 요일".
    static func relativeDayLabel(_ key: String, now: Date = Date()) -> String {
        let cal = Calendar.current
        guard let date = dayFormatter.date(from: key) else { return key }
        let diff = cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: date)).day ?? 0
        if diff == 0 { return "오늘" }
        if diff == 1 { return "내일" }
        let wd = cal.component(.weekday, from: date) - 1
        return "\(cal.component(.month, from: date)).\(cal.component(.day, from: date)) \(weekdaySymbols[wd])"
    }

    // MARK: - Month grid (현재 달)

    struct MonthGrid {
        let cells: [Int?]      // 선행 nil 패딩 + 1...일수 + 후행 nil
        let monthLabel: String // "2026.06"
        let todayDay: Int      // 현재 달이므로 항상 오늘 일자
        let rows: Int
        let year: Int
        let month: Int
    }

    static func currentMonth(now: Date = Date()) -> MonthGrid {
        let cal = Calendar.current
        let y = cal.component(.year, from: now)
        let m = cal.component(.month, from: now)
        let first = cal.date(from: DateComponents(year: y, month: m, day: 1)) ?? now
        let startWeekday = cal.component(.weekday, from: first) - 1 // 0 = 일요일
        let daysInMonth = cal.range(of: .day, in: .month, for: first)?.count ?? 30
        var cells: [Int?] = Array(repeating: nil, count: startWeekday)
        cells += (1...daysInMonth).map { Optional($0) }
        while cells.count % 7 != 0 { cells.append(nil) }
        return MonthGrid(
            cells: cells,
            monthLabel: String(format: "%04d.%02d", y, m),
            todayDay: cal.component(.day, from: now),
            rows: cells.count / 7,
            year: y, month: m
        )
    }

    /// 월간 그리드 일자 → 일자 키("yyyy-MM-dd").
    static func monthDayKey(year: Int, month: Int, day: Int) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }
}
