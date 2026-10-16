//
//  MonthCalendarWidgetView.swift
//  PlandoWidget
//
//  Large(월간 달력) 위젯 — 한 달 일정을 캘린더 그대로 + 색상 이벤트 바.
//  WidgetPreview.jsx 의 MonthlyCalendarWidget 과 대응. (위젯은 현재 달 고정 — ‹› 네비 없음)
//

import SwiftUI
import WidgetKit

struct MonthCalendarWidgetView: View {
    @Environment(\.colorScheme) var scheme
    let entry: TodoEntry

    private var grid: CalSupport.MonthGrid { CalSupport.currentMonth() }
    private var byDay: [String: [WidgetTodo]] { CalSupport.groupByDay(entry.calendarTodos) }

    /// 6주 그리드면 셀당 1개, 그 외 2개까지 표시 (미리보기 MAX 규칙).
    private var maxPerCell: Int { grid.rows >= 6 ? 1 : 2 }

    var body: some View {
        Group {
            if !entry.isLoggedIn {
                loggedOutView
            } else {
                calendarView
            }
        }
        .padding(EdgeInsets(top: 16, leading: 16, bottom: 12, trailing: 16))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var loggedOutView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Plando")
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(WidgetTokens.Brand.primary)
            Text("앱을 한 번 실행해 주세요")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var calendarView: some View {
        VStack(spacing: 2) {
            // 헤더: 월 라벨 + ＋
            HStack {
                Text(grid.monthLabel)
                    .font(.system(size: 19, weight: .heavy))
                    .foregroundStyle(WidgetTokens.Text.primary(scheme))
                Spacer()
                Link(destination: URL(string: "plando://addTodo")!) {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .regular))
                        .foregroundStyle(WidgetTokens.CalendarTone.accent(scheme))
                }
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 4)

            // 요일 헤더
            HStack(spacing: 0) {
                ForEach(Array(CalSupport.weekdaySymbols.enumerated()), id: \.offset) { i, w in
                    Text(w)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(weekdayHeaderColor(i))
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.bottom, 2)

            // 월 그리드
            GeometryReader { geo in
                let rowH = geo.size.height / CGFloat(grid.rows)
                VStack(spacing: 0) {
                    ForEach(0..<grid.rows, id: \.self) { row in
                        HStack(spacing: 0) {
                            ForEach(0..<7, id: \.self) { col in
                                let idx = row * 7 + col
                                dayCell(cellIndex: idx, day: grid.cells[idx])
                                    .frame(maxWidth: .infinity)
                                    .frame(height: rowH)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func dayCell(cellIndex idx: Int, day: Int?) -> some View {
        if let day {
            let key = CalSupport.monthDayKey(year: grid.year, month: grid.month, day: day)
            let items = byDay[key] ?? []
            let isToday = day == grid.todayDay
            VStack(spacing: 1) {
                // 일자
                if isToday {
                    ZStack {
                        Circle().fill(WidgetTokens.CalendarTone.accent(scheme)).frame(width: 14, height: 14)
                        Text("\(day)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.white)
                    }
                    .frame(height: 14)
                    .padding(.bottom, 1)
                } else {
                    Text("\(day)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(dayColor(cellIndex: idx))
                        .frame(height: 14)
                        .padding(.bottom, 1)
                }

                // 이벤트 바
                ForEach(items.prefix(maxPerCell)) { item in
                    eventBar(item)
                }
                if items.count > maxPerCell {
                    Text("+\(items.count - maxPerCell)")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(WidgetTokens.CalendarTone.overflow(scheme))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, 3)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .top)
            .padding(.horizontal, 1)
        } else {
            Color.clear
        }
    }

    private func eventBar(_ item: WidgetTodo) -> some View {
        let isDone = item.status == "DONE"
        let cat = WidgetTokens.CalendarTone.category(projectId: item.projectId, id: item.id, scheme: scheme)
        return Text(item.title)
            .font(.system(size: 8.5, weight: .semibold))
            .lineLimit(1)
            .strikethrough(isDone, color: WidgetTokens.CalendarTone.overflow(scheme))
            .foregroundStyle(isDone ? WidgetTokens.CalendarTone.overflow(scheme) : cat.text)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                isDone ? WidgetTokens.CalendarTone.track(scheme) : cat.bg,
                in: RoundedRectangle(cornerRadius: 4)
            )
    }

    private func weekdayHeaderColor(_ i: Int) -> Color {
        if i == 0 { return WidgetTokens.CalendarTone.sun(scheme) }
        if i == 6 { return WidgetTokens.CalendarTone.sat(scheme) }
        return WidgetTokens.Text.secondary(scheme)
    }

    private func dayColor(cellIndex idx: Int) -> Color {
        let col = idx % 7
        if col == 0 { return WidgetTokens.CalendarTone.sun(scheme) }
        if col == 6 { return WidgetTokens.CalendarTone.sat(scheme) }
        return WidgetTokens.Text.primary(scheme)
    }
}
