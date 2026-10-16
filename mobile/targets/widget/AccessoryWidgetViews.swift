//
//  AccessoryWidgetViews.swift
//  PlandoWidget
//
//  잠금화면(accessory) 위젯 3종 — 원형(진행률 게이지) / 사각(다음 할 일) / 인라인(한 줄 요약).
//  홈 화면 위젯과 동일한 TodoEntry(App Group 데이터) 사용.
//  잠금화면은 시스템이 톤을 입히므로(모노크롬/틴트) 색을 지정하지 않고
//  opacity 계층과 widgetAccentable 로만 대비를 만든다.
//

import SwiftUI
import WidgetKit

// MARK: - 원형 (진행률 게이지: done/total)

struct AccessoryCircularView: View {
    let entry: TodoEntry

    private var progress: Double {
        entry.total > 0 ? Double(entry.done) / Double(entry.total) : 0
    }

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            if !entry.isLoggedIn || entry.total == 0 {
                // 로그인 없음/할 일 없음 — 게이지 대신 브랜드 마크만
                VStack(spacing: 0) {
                    Image(systemName: entry.isLoggedIn ? "leaf.fill" : "bolt.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .widgetAccentable()
                    Text("오늘")
                        .font(.system(size: 10, weight: .semibold))
                        .opacity(0.75)
                }
            } else {
                Gauge(value: progress) {
                    Text("오늘")
                } currentValueLabel: {
                    VStack(spacing: -1) {
                        Text("\(entry.done)")
                            .font(.system(size: 16, weight: .heavy, design: .rounded))
                        Text("/\(entry.total)")
                            .font(.system(size: 9, weight: .semibold))
                            .opacity(0.7)
                    }
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .widgetAccentable()
            }
        }
    }
}

// MARK: - 사각 (다음 할 일: 제목 1줄 + 남은 개수)

struct AccessoryRectangularView: View {
    let entry: TodoEntry

    /// 다음 할 일 — todos 는 이미 별표 우선 정렬돼 있어 첫 미완료를 쓴다.
    private var next: WidgetTodo? {
        entry.todos.first(where: { $0.status != "DONE" })
    }

    private var remaining: Int {
        max(0, entry.total - entry.done)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 10, weight: .heavy))
                Text("Plan Do!")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
            }
            .widgetAccentable()

            if !entry.isLoggedIn {
                Text("앱을 한 번 실행해 주세요")
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
            } else if let task = next {
                // 체크 버튼(인터랙티브 위젯) + 제목 — 잠금화면에서 바로 완료
                HStack(spacing: 6) {
                    Button(intent: ToggleTodoIntent(todoId: task.id)) {
                        Image(systemName: "circle")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .buttonStyle(.plain)
                    Text(task.title)
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                }
                // 데이터 모델에 시:분이 없어(dDay 만) 시간 대신 D-day/남은 개수를 보조 라인으로.
                Text(task.dDay ?? "오늘 \(remaining)개 남음")
                    .font(.system(size: 12, weight: .medium))
                    .opacity(0.7)
            } else if entry.total > 0 {
                Text("오늘 할 일을 모두 마쳤어요")
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
                Text("오늘 \(entry.done)/\(entry.total) 완료")
                    .font(.system(size: 12, weight: .medium))
                    .opacity(0.7)
            } else {
                Text("오늘은 여유로운 하루예요")
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - 인라인 (한 줄: '오늘 3/7 완료')

struct AccessoryInlineView: View {
    let entry: TodoEntry

    var body: some View {
        if !entry.isLoggedIn {
            Text("Plan Do! 앱을 실행해 주세요")
        } else if entry.total == 0 {
            Text("오늘은 할 일이 없어요")
        } else {
            Text("오늘 \(entry.done)/\(entry.total) 완료")
        }
    }
}

// MARK: - Xcode Preview

#Preview("Circular", as: .accessoryCircular) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Circular · Empty", as: .accessoryCircular) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.empty
}

#Preview("Rectangular", as: .accessoryRectangular) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Rectangular · Empty", as: .accessoryRectangular) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.empty
}

#Preview("Inline", as: .accessoryInline) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.placeholder
}
