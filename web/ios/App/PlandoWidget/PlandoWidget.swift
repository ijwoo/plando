//
//  PlandoWidget.swift
//  PlandoWidget
//
//  Widget bundle entry point.
//  2종: 오늘(Small/Medium/Large) + 달력(Medium=주간 / Large=월간).
//  탭 시 deep link 로 main app 의 해당 컨텍스트 열기.
//

import SwiftUI
import WidgetKit

@main
struct PlandoWidgetBundle: WidgetBundle {
    var body: some Widget {
        PlandoTodayWidget()
        PlandoCalendarWidget()
    }
}

// MARK: - 오늘 위젯 (Small / Medium / Large)

struct PlandoTodayWidget: Widget {
    let kind: String = "PlandoTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodoProvider()) { entry in
            PlandoTodayWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("오늘의 할 일")
        .description("오늘 해야 할 일을 한눈에 확인하세요.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct PlandoTodayWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme
    let entry: TodoEntry

    /// 탭 시 main app 의 해당 화면으로 이동시킬 deep link.
    /// Capacitor 측에서 `appUrlOpen` 이벤트로 받아 라우팅 처리.
    private var deepLink: URL? {
        // featured (bolt) / 첫 번째 task 가 있으면 그 상세로, 없으면 today 보드로.
        if let first = entry.todos.first(where: { $0.starred }) ?? entry.todos.first {
            return URL(string: "plando://todo/\(first.id)")
        }
        return URL(string: "plando://today")
    }

    var body: some View {
        Group {
            switch family {
            case .systemSmall:  SmallWidgetView(entry: entry)
            case .systemMedium: MediumWidgetView(entry: entry)
            case .systemLarge:  TodayLargeWidgetView(entry: entry)
            default:            SmallWidgetView(entry: entry)
            }
        }
        .widgetURL(deepLink)
        .containerBackground(for: .widget) {
            PlandoGlassBackground(scheme: colorScheme)
        }
    }
}

// MARK: - 달력 위젯 (Medium=주간 / Large=월간)

struct PlandoCalendarWidget: Widget {
    let kind: String = "PlandoCalendarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodoProvider()) { entry in
            PlandoCalendarWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("달력")
        .description("이번 주·이번 달 일정을 캘린더로 확인하세요.")
        .supportedFamilies([.systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct PlandoCalendarWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme
    let entry: TodoEntry

    var body: some View {
        Group {
            switch family {
            case .systemMedium: WeekCalendarWidgetView(entry: entry)
            case .systemLarge:  MonthCalendarWidgetView(entry: entry)
            default:            WeekCalendarWidgetView(entry: entry)
            }
        }
        // 전체 탭 → 앱 캘린더 (위젯은 현재 주/월 고정, 상세 네비는 앱에서)
        .widgetURL(URL(string: "plando://calendar"))
        .containerBackground(for: .widget) {
            PlandoGlassBackground(scheme: colorScheme)
        }
    }
}

/// 위젯 컨테이너 배경 — Frosted Glass.
/// - iOS 26+ : Liquid Glass (.glassEffect) 적용 (진짜 유리)
/// - iOS 17~25 : ultraThinMaterial + 옅은 가독성 backing + 미세 brand tint
/// 텍스트 가독성 유지하면서 wallpaper 가 부드럽게 비치는 톤.
struct PlandoGlassBackground: View {
    let scheme: ColorScheme

    var body: some View {
        if #available(iOSApplicationExtension 26.0, *) {
            // iOS 26 Liquid Glass — 진짜 유리. material 보다 정확한 굴절/반사.
            ZStack {
                Rectangle()
                    .glassEffect(.regular, in: Rectangle())
                // brand tint overlay (매우 옅게)
                LinearGradient(
                    colors: [
                        WidgetTokens.Brand.primary.opacity(0.07),
                        Color.clear
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        } else {
            // iOS 17~25 fallback — Material + readability backing + brand tint
            ZStack {
                // 1) 가독성 backing — 머티리얼만으로는 wallpaper 색이 강해 흔들리는 걸 보강
                Rectangle()
                    .fill(scheme == .dark
                          ? Color(red: 0x0B / 255.0, green: 0x12 / 255.0, blue: 0x20 / 255.0).opacity(0.45)
                          : Color.white.opacity(0.45))
                // 2) Frosted material — wallpaper blur
                Rectangle()
                    .fill(.ultraThinMaterial)
                // 3) Brand tint (매우 옅게) — Plando 색감 유지
                LinearGradient(
                    colors: [
                        WidgetTokens.Brand.primary.opacity(0.06),
                        Color.clear
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
    }
}

// MARK: - Xcode Preview

#Preview("Small · Light", as: .systemSmall) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Small · Dark", as: .systemSmall) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Small · Empty", as: .systemSmall) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.empty
}

#Preview("Medium · Light", as: .systemMedium) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Medium · Dark", as: .systemMedium) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Medium · Empty", as: .systemMedium) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.empty
}

#Preview("Today Large · Light", as: .systemLarge) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Today Large · Empty", as: .systemLarge) {
    PlandoTodayWidget()
} timeline: {
    TodoEntry.empty
}

#Preview("Week · Light", as: .systemMedium) {
    PlandoCalendarWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Week · Dark", as: .systemMedium) {
    PlandoCalendarWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Month · Light", as: .systemLarge) {
    PlandoCalendarWidget()
} timeline: {
    TodoEntry.placeholder
}

#Preview("Month · Dark", as: .systemLarge) {
    PlandoCalendarWidget()
} timeline: {
    TodoEntry.placeholder
}
