//
//  MediumWidgetView.swift
//  PlandoWidget
//
//  Medium 위젯 — 토스 톤 강화 (간격/타이포 정돈) + 우상단 추가 버튼.
//

import SwiftUI
import WidgetKit
import AppIntents

struct MediumWidgetView: View {
    @Environment(\.colorScheme) var scheme
    let entry: TodoEntry

    /// featured(⚡) 우선 + 시간순 최대 3개
    private var visibleTodos: [WidgetTodo] {
        let starred = entry.todos.filter { $0.starred }
        let rest = entry.todos.filter { !$0.starred }
        return Array((starred + rest).prefix(3))
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
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    // MARK: - 로그인 없음

    private var loggedOutView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Plan Do!")
                .font(.system(size: 16, weight: .heavy, design: .rounded))
                .foregroundStyle(WidgetTokens.Brand.primary)
            Text("앱을 한 번 실행해 주세요")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - 빈 상태

    private var emptyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Spacer()
            HStack(spacing: 10) {
                Image(systemName: "leaf.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(WidgetTokens.Status.done)
                VStack(alignment: .leading, spacing: 3) {
                    Text("오늘은 여유로운 하루예요")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(WidgetTokens.Text.primary(scheme))
                    Text("새 할 일을 추가해보세요")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(WidgetTokens.Text.secondary(scheme))
                }
                Spacer(minLength: 0)
            }
            Spacer()
        }
    }

    // MARK: - 일반 상태

    private var listView: some View {
        VStack(alignment: .leading, spacing: 10) {
            header

            VStack(spacing: 0) {
                ForEach(Array(visibleTodos.enumerated()), id: \.element.id) { index, task in
                    if index > 0 {
                        Rectangle()
                            .fill(WidgetTokens.Surface.divider(scheme))
                            .frame(height: 0.5)
                            .padding(.leading, 22)
                    }
                    todoRow(task)
                }
            }

            if entry.total > visibleTodos.count {
                Text("외 \(entry.total - visibleTodos.count)개 더 있어요")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(WidgetTokens.Text.tertiary(scheme))
                    .padding(.top, -2)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: 6) {
            Text("오늘")
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(WidgetTokens.Text.secondary(scheme))
            Text("\(entry.total)")
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(WidgetTokens.Text.primary(scheme))

            Spacer()

            if entry.total > 0 {
                ProgressBar(total: entry.total, done: entry.done, scheme: scheme)
                    .frame(width: 40, height: 5)
                    .padding(.trailing, 6)
            }

            addButton(prominent: false)
        }
    }

    // MARK: - 추가 버튼

    /// + 추가. deep link로 메인 앱의 todo 추가 모달 오픈.
    private func addButton(prominent: Bool) -> some View {
        Link(destination: URL(string: "plando://addTodo")!) {
            ZStack {
                Circle()
                    .fill(prominent ? WidgetTokens.Brand.primary : WidgetTokens.Brand.primarySoft)
                    .frame(width: prominent ? 32 : 22, height: prominent ? 32 : 22)
                Image(systemName: "plus")
                    .font(.system(size: prominent ? 14 : 11, weight: .heavy))
                    .foregroundStyle(prominent ? Color.white : WidgetTokens.Brand.primary)
            }
        }
    }

    // MARK: - Todo row

    private func todoRow(_ task: WidgetTodo) -> some View {
        HStack(alignment: .center, spacing: 10) {
            statusIcon(task)

            Text(task.title)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(textColor(task))
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
        .padding(.vertical, 7)
    }

    @ViewBuilder
    private func statusIcon(_ task: WidgetTodo) -> some View {
        if task.status == "DONE" {
            // 완료 — 인터랙션 없음 (이미 완료). 미완료 체크박스(16×16)와 동일 폭 고정 → 행 밀림 방지
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(WidgetTokens.Status.done)
                .frame(width: 16, height: 16)
        } else if #available(iOS 17.0, *) {
            // 미완료 — 탭하면 위젯 안에서 직접 완료 처리 (앱 안 열고)
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
                Circle().stroke(WidgetTokens.Brand.primary, lineWidth: 1.5)
                Circle().fill(WidgetTokens.Brand.primary).frame(width: 5, height: 5)
            }
            .frame(width: 16, height: 16)
        } else {
            Circle()
                .stroke(WidgetTokens.Text.tertiary(scheme), lineWidth: 1.3)
                .frame(width: 16, height: 16)
        }
    }

    private func textColor(_ task: WidgetTodo) -> Color {
        task.status == "DONE"
            ? WidgetTokens.Text.tertiary(scheme)
            : WidgetTokens.Text.primary(scheme)
    }
}

// MARK: - Progress bar

private struct ProgressBar: View {
    let total: Int
    let done: Int
    let scheme: ColorScheme
    var body: some View {
        GeometryReader { geo in
            let pct = total > 0 ? CGFloat(done) / CGFloat(total) : 0
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(WidgetTokens.Surface.divider(scheme))
                RoundedRectangle(cornerRadius: 2)
                    .fill(WidgetTokens.Brand.primary)
                    .frame(width: geo.size.width * pct)
            }
        }
    }
}
