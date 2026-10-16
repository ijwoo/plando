//
//  WeekCalendarWidgetView.swift
//  PlandoWidget
//
//  Medium(주간 달력) 위젯 — 이번 주 일정과 진행 상태.
//  WidgetPreview.jsx 의 LargeCalendarWidget 과 대응. (위젯은 현재 주 고정 — ‹› 네비 없음)
//

import SwiftUI
import WidgetKit

struct WeekCalendarWidgetView: View {
    @Environment(\.colorScheme) var scheme
    let entry: TodoEntry

    private var week: [Date] { CalSupport.currentWeek() }
    private var byDay: [String: [WidgetTodo]] { CalSupport.groupByDay(entry.calendarTodos) }
    private var todayKey: String { CalSupport.dayKey(Date()) }

    /// 이번 주 일정 (날짜순, 최대 2개)
    private var weekItems: [WidgetTodo] {
        let keys = Set(week.map { CalSupport.dayKey($0) })
        let inWeek = entry.calendarTodos.filter {
            guard let k = CalSupport.dayKey(of: $0) else { return false }
            return keys.contains(k)
        }
        return Array(inWeek.prefix(2))
    }

    var body: some View {
        Group {
            if !entry.isLoggedIn {
                loggedOutView
            } else {
                calendarView
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var loggedOutView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Plando")
                .font(.system(size: 16, weight: .heavy, design: .rounded))
                .foregroundStyle(WidgetTokens.Brand.primary)
            Text("앱을 한 번 실행해 주세요")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var calendarView: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 헤더: 범위 라벨 + ＋
            HStack(spacing: 4) {
                Text(CalSupport.weekRangeLabel(week))
                    .font(.system(size: 12.5, weight: .heavy))
                    .foregroundStyle(WidgetTokens.Text.primary(scheme))
                Spacer()
                Link(destination: URL(string: "plando://addTodo")!) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(WidgetTokens.CalendarTone.accent(scheme))
                }
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 4)

            // 주간 스트립
            HStack(spacing: 0) {
                ForEach(Array(week.enumerated()), id: \.offset) { i, d in
                    weekDayCell(index: i, date: d)
                        .frame(maxWidth: .infinity)
                }
            }

            Rectangle()
                .fill(WidgetTokens.Surface.divider(scheme))
                .frame(height: 1)
                .padding(.vertical, 8)

            // 이번 주 일정 (최대 2)
            if weekItems.isEmpty {
                Text("이 주에는 일정이 없어요")
                    .font(.system(size: 11.5))
                    .foregroundStyle(WidgetTokens.Text.secondary(scheme))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(weekItems) { item in
                        weekEventRow(item)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            }
        }
    }

    private func weekDayCell(index i: Int, date d: Date) -> some View {
        let key = CalSupport.dayKey(d)
        let isToday = key == todayKey
        let hasEvent = !(byDay[key] ?? []).isEmpty
        let wdColor = weekendColor(i)
        return VStack(spacing: 2) {
            Text(CalSupport.weekdaySymbols[i])
                .font(.system(size: 8.5, weight: .bold))
                .foregroundStyle(wdColor)
            ZStack {
                if isToday {
                    Circle().fill(WidgetTokens.CalendarTone.accent(scheme)).frame(width: 19, height: 19)
                }
                Text("\(CalSupport.dayNumber(d))")
                    .font(.system(size: 11, weight: isToday ? .heavy : .semibold))
                    .foregroundStyle(isToday ? Color.white : wdColor)
            }
            .frame(height: 19)
            Circle()
                .fill(hasEvent && !isToday ? WidgetTokens.CalendarTone.accent(scheme) : Color.clear)
                .frame(width: 4, height: 4)
        }
    }

    private func weekEventRow(_ item: WidgetTodo) -> some View {
        let isDone = item.status == "DONE"
        let cat = WidgetTokens.CalendarTone.category(projectId: item.projectId, id: item.id, scheme: scheme)
        let key = CalSupport.dayKey(of: item) ?? ""
        return HStack(spacing: 8) {
            Text(CalSupport.relativeDayLabel(key))
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
                .frame(width: 46, alignment: .leading)
            Circle()
                .fill(isDone ? WidgetTokens.CalendarTone.overflow(scheme) : cat.text)
                .frame(width: 6, height: 6)
            Text(item.title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isDone ? WidgetTokens.CalendarTone.overflow(scheme) : WidgetTokens.Text.primary(scheme))
                .strikethrough(isDone, color: WidgetTokens.CalendarTone.overflow(scheme))
                .lineLimit(1)
            Spacer(minLength: 0)
        }
    }

    private func weekendColor(_ i: Int) -> Color {
        if i == 0 { return WidgetTokens.CalendarTone.sun(scheme) }
        if i == 6 { return WidgetTokens.CalendarTone.sat(scheme) }
        return WidgetTokens.Text.secondary(scheme)
    }
}
