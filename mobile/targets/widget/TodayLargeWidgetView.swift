//
//  TodayLargeWidgetView.swift
//  PlandoWidget
//
//  Large(오늘) 위젯 — 오늘 할 일 전체를 한 화면에 (체크박스 리스트).
//  MediumWidgetView 확장형. WidgetPreview.jsx 의 TodayLargeWidget 과 대응.
//

import SwiftUI
import WidgetKit
import AppIntents

struct TodayLargeWidgetView: View {
    @Environment(\.colorScheme) var scheme
    let entry: TodoEntry

    /// featured(⚡) 우선 + 최대 8개 (Large 높이에 맞춤)
    private var rows: [WidgetTodo] {
        let starred = entry.todos.filter { $0.starred }
        let rest = entry.todos.filter { !$0.starred }
        return Array((starred + rest).prefix(8))
    }

    var body: some View {
        Group {
            if !entry.isLoggedIn {
                loggedOutView
            } else if entry.total == 0 {
                emptyView
            } else {
                listView
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    // MARK: - 상태별

    private var loggedOutView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Plan Do!")
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(WidgetTokens.Brand.primary)
            Text("앱을 한 번 실행해 주세요")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var emptyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Spacer()
            Image(systemName: "leaf.fill")
                .font(.system(size: 30))
                .foregroundStyle(WidgetTokens.Status.done)
            Text("오늘은 여유로운 하루예요")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(WidgetTokens.Text.primary(scheme))
                .padding(.top, 6)
            Text("새 할 일을 추가해보세요")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
                .padding(.top, 2)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var listView: some View {
        VStack(alignment: .leading, spacing: 10) {
            header

            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, task in
                    todoRow(task)
                    if index < rows.count - 1 {
                        Rectangle()
                            .fill(WidgetTokens.Surface.divider(scheme))
                            .frame(height: 0.5)
                    }
                }
            }

            if entry.total > rows.count {
                Text("외 \(entry.total - rows.count)개 더 있어요")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(WidgetTokens.Text.tertiary(scheme))
                    .padding(.top, 2)
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: - Header (big)

    private var header: some View {
        HStack(alignment: .center, spacing: 6) {
            Text("오늘")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
            Text("\(entry.total)")
                .font(.system(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(WidgetTokens.Text.primary(scheme))

            Spacer()

            if entry.total > 0 {
                ProgressBarLg(total: entry.total, done: entry.done, scheme: scheme)
                    .frame(width: 56, height: 5)
                    .padding(.trailing, 6)
            }
            addButton
        }
    }

    private var addButton: some View {
        Link(destination: URL(string: "plando://addTodo")!) {
            ZStack {
                Circle()
                    .fill(WidgetTokens.Brand.primarySoft)
                    .frame(width: 24, height: 24)
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(WidgetTokens.Brand.primary)
            }
        }
    }

    // MARK: - Row

    private func todoRow(_ task: WidgetTodo) -> some View {
        HStack(alignment: .center, spacing: 10) {
            statusIcon(task)

            // 카테고리 점
            Circle()
                .fill(WidgetTokens.CalendarTone.category(projectId: task.projectId, id: task.id, scheme: scheme).text)
                .frame(width: 7, height: 7)

            Text(task.title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(task.status == "DONE"
                                 ? WidgetTokens.Text.tertiary(scheme)
                                 : WidgetTokens.Text.primary(scheme))
                .lineLimit(1)
                .strikethrough(task.status == "DONE", color: WidgetTokens.Text.tertiary(scheme))

            if task.starred {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(WidgetTokens.Brand.primary)
            }

            Spacer(minLength: 6)

            if let dday = task.dDay {
                Text(dday)
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(WidgetTokens.Brand.primary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(WidgetTokens.Brand.primarySoft, in: RoundedRectangle(cornerRadius: 5))
            }
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func statusIcon(_ task: WidgetTodo) -> some View {
        if task.status == "DONE" {
            // 미완료 체크박스(18×18)와 동일 폭으로 고정 — SF Symbol 고유 폭 차이로 인한 행 밀림 방지
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 18))
                .foregroundStyle(WidgetTokens.Status.done)
                .frame(width: 18, height: 18)
        } else if #available(iOS 17.0, *) {
            Button(intent: ToggleTodoIntent(todoId: task.id)) {
                checkboxView(task)
            }
            .buttonStyle(.plain)
        } else {
            checkboxView(task)
        }
    }

    @ViewBuilder
    private func checkboxView(_ task: WidgetTodo) -> some View {
        if task.status == "IN_PROGRESS" {
            ZStack {
                Circle().stroke(WidgetTokens.Brand.primary, lineWidth: 1.6)
                Circle().fill(WidgetTokens.Brand.primary).frame(width: 6, height: 6)
            }
            .frame(width: 18, height: 18)
        } else {
            Circle()
                .stroke(priorityColor(task.priority), lineWidth: 1.6)
                .frame(width: 18, height: 18)
        }
    }

    private func priorityColor(_ p: String) -> Color {
        switch p {
        case "HIGH": return WidgetTokens.Status.high
        case "MEDIUM": return WidgetTokens.Status.medium
        default: return WidgetTokens.Status.low
        }
    }
}

// MARK: - Progress bar (large)

private struct ProgressBarLg: View {
    let total: Int
    let done: Int
    let scheme: ColorScheme
    var body: some View {
        GeometryReader { geo in
            let pct = total > 0 ? CGFloat(done) / CGFloat(total) : 0
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(WidgetTokens.CalendarTone.track(scheme))
                RoundedRectangle(cornerRadius: 3)
                    .fill(WidgetTokens.Brand.primary)
                    .frame(width: geo.size.width * pct)
            }
        }
    }
}
