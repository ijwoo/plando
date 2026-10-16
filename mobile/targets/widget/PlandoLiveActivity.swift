//
//  PlandoLiveActivity.swift
//  PlandoWidget
//
//  오늘 진행 Live Activity — 잠금화면 배너 + 다이나믹 아일랜드.
//  상태는 앱(PlandoLiveActivityModule)이 시작/갱신/종료한다.
//

import ActivityKit
import SwiftUI
import WidgetKit

private let brandBlue = Color(red: 0.13, green: 0.54, blue: 0.94)

struct PlandoLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PlandoDayAttributes.self) { context in
            // 잠금화면 배너
            LockBannerView(state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.55))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        ProgressRing(done: context.state.done, total: context.state.total)
                            .frame(width: 28, height: 28)
                        Text("\(context.state.done)/\(context.state.total)")
                            .font(.system(size: 15, weight: .bold))
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let time = context.state.nextTime {
                        Text(time)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(brandBlue)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let next = context.state.nextTitle {
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.right.circle.fill")
                                .foregroundStyle(brandBlue)
                            Text("다음: \(next)")
                                .font(.system(size: 13, weight: .semibold))
                                .lineLimit(1)
                            if let nextId = context.state.nextId {
                                Spacer()
                                Button(intent: ToggleTodoIntent(todoId: nextId)) {
                                    Image(systemName: "checkmark.circle")
                                        .font(.system(size: 18, weight: .semibold))
                                        .foregroundStyle(brandBlue)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    } else {
                        Text("오늘 일정을 모두 마쳤어요 🎉")
                            .font(.system(size: 13, weight: .semibold))
                    }
                }
            } compactLeading: {
                ProgressRing(done: context.state.done, total: context.state.total)
                    .frame(width: 18, height: 18)
            } compactTrailing: {
                if let time = context.state.nextTime {
                    Text(time)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(brandBlue)
                } else {
                    Text("\(context.state.done)/\(context.state.total)")
                        .font(.system(size: 12, weight: .bold))
                }
            } minimal: {
                ProgressRing(done: context.state.done, total: context.state.total)
                    .frame(width: 18, height: 18)
            }
            .widgetURL(URL(string: "plando://today"))
        }
    }
}

/// 잠금화면 배너 — 진행 링 + 카운트 + 다음 일정 한 줄
private struct LockBannerView: View {
    let state: PlandoDayAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            ProgressRing(done: state.done, total: state.total)
                .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text("오늘 \(state.done)/\(state.total) 완료")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                if let next = state.nextTitle {
                    HStack(spacing: 4) {
                        if let time = state.nextTime {
                            Text(time)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(brandBlue)
                        }
                        Text(next)
                            .font(.system(size: 13))
                            .foregroundStyle(.white.opacity(0.85))
                            .lineLimit(1)
                    }
                } else {
                    Text("남은 일정을 모두 마쳤어요 🎉")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            Spacer()
            if let nextId = state.nextId {
                // 다음 일정 바로 완료 — 인터랙티브 Live Activity (ToggleTodoIntent 재사용)
                Button(intent: ToggleTodoIntent(todoId: nextId)) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 26))
                        .foregroundStyle(brandBlue)
                }
                .buttonStyle(.plain)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(brandBlue)
            }
        }
        .padding(14)
    }
}

/// 진행 링 — done/total 비율 (0이면 빈 링)
private struct ProgressRing: View {
    let done: Int
    let total: Int

    private var progress: Double { total > 0 ? Double(done) / Double(total) : 0 }

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.25), lineWidth: 3.5)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(brandBlue, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}
