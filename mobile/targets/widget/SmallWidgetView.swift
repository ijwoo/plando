//
//  SmallWidgetView.swift
//  PlandoWidget
//
//  Small 위젯 — 토스 톤 강화. featured 1개 강조 + 외 N개 hint.
//

import SwiftUI
import WidgetKit
import AppIntents

struct SmallWidgetView: View {
    @Environment(\.colorScheme) var scheme
    let entry: TodoEntry

    private var featured: WidgetTodo? {
        entry.todos.first(where: { $0.starred }) ?? entry.todos.first
    }

    private var remaining: Int {
        max(0, entry.total - 1)
    }

    var body: some View {
        contentLayer
    }

    private var contentLayer: some View {
        Group {
            if !entry.isLoggedIn {
                loggedOutView
            } else if entry.total == 0 {
                emptyView
            } else {
                listView
            }
        }
        .padding(14)
    }

    // MARK: - 로그인 없음

    private var loggedOutView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Plan Do!")
                .font(.system(size: 13, weight: .heavy, design: .rounded))
                .foregroundStyle(WidgetTokens.Brand.primary)
            Spacer()
            Text("앱을 한 번\n실행해 주세요")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
                .lineSpacing(2)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - 빈 상태

    private var emptyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Spacer()
            Image(systemName: "leaf.fill")
                .font(.system(size: 24))
                .foregroundStyle(WidgetTokens.Status.done)
            Text("오늘은 여유로운\n하루예요")
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(WidgetTokens.Text.primary(scheme))
                .lineSpacing(2)
                .padding(.top, 4)
            Spacer()
            Link(destination: URL(string: "plando://addTodo")!) {
                HStack(spacing: 4) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 11))
                    Text("새 할 일")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(WidgetTokens.Brand.primary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - 일반 상태

    private var listView: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Spacer(minLength: 10)

            if let task = featured {
                featuredCard(task)
            }

            Spacer(minLength: 6)

            if remaining > 0 {
                Text("외 \(remaining)개 더 있어요")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(WidgetTokens.Text.tertiary(scheme))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("오늘")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(WidgetTokens.Text.secondary(scheme))
                Text("\(entry.total)")
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(WidgetTokens.Text.primary(scheme))
            }
            Spacer()
            if entry.total > 0 {
                SlimProgressBar(total: entry.total, done: entry.done, scheme: scheme)
                    .frame(width: 40, height: 5)
            }
        }
    }

    // MARK: - Featured card

    private func featuredCard(_ task: WidgetTodo) -> some View {
        HStack(alignment: .top, spacing: 8) {
            // 체크박스 (iOS 17+ 인터랙티브)
            checkbox(task)

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 5) {
                    if task.starred {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 10, weight: .heavy))
                            .foregroundStyle(WidgetTokens.Brand.primary)
                    }
                    if let dday = task.dDay {
                        Text(dday)
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(WidgetTokens.Brand.primary)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1.5)
                            .background(WidgetTokens.Brand.primarySoft, in: RoundedRectangle(cornerRadius: 4))
                    }
                }

                Text(task.title)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(task.status == "DONE"
                                     ? WidgetTokens.Text.tertiary(scheme)
                                     : WidgetTokens.Text.primary(scheme))
                    .strikethrough(task.status == "DONE", color: WidgetTokens.Text.tertiary(scheme))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private func checkbox(_ task: WidgetTodo) -> some View {
        if task.status == "DONE" {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(WidgetTokens.Status.done)
        } else if #available(iOS 17.0, *) {
            Button(intent: ToggleTodoIntent(todoId: task.id)) {
                Circle()
                    .stroke(priorityColor(task.priority), lineWidth: 1.5)
                    .frame(width: 16, height: 16)
            }
            .buttonStyle(.plain)
        } else {
            Circle()
                .stroke(priorityColor(task.priority), lineWidth: 1.5)
                .frame(width: 16, height: 16)
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

// MARK: - Progress dots

/// 슬림 progress 바 — 미리보기 ProgressBar 와 동일 (track + brand fill).
private struct SlimProgressBar: View {
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
