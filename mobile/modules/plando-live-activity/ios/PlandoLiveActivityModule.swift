import ActivityKit
import ExpoModulesCore

/**
 * Live Activity 브릿지 — 오늘 진행(완료/전체 + 다음 일정)을 잠금화면·다이나믹 아일랜드에 표시.
 * UI는 위젯 익스텐션(PlandoLiveActivity.swift)이 그린다. 날짜가 바뀌면 이전 활동을 끝내고 새로 시작.
 */
public class PlandoLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlandoLiveActivity")

    /// 시작 또는 갱신 — day(yyyy-MM-dd)의 진행 상황. 사용자가 시스템에서 껐으면 조용히 무시.
    Function("startOrUpdate") { (day: String, done: Int, total: Int, nextTitle: String?, nextTime: String?, nextId: Int?) in
      guard #available(iOS 16.2, *) else { return }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
      let state = PlandoDayAttributes.ContentState(done: done, total: total, nextTitle: nextTitle, nextTime: nextTime, nextId: nextId)
      let content = ActivityContent(state: state, staleDate: nil)

      // 같은 날짜 활동이 있으면 갱신, 다른 날짜 활동은 종료
      var updated = false
      for activity in Activity<PlandoDayAttributes>.activities {
        if activity.attributes.day == day {
          Task { await activity.update(content) }
          updated = true
        } else {
          Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
      }
      if updated { return }

      do {
        _ = try Activity.request(attributes: PlandoDayAttributes(day: day), content: content, pushType: nil)
      } catch {
        // 활동 한도 초과/비활성 — 조용히 무시
      }
    }

    /// 종료 — 모든 진행 중인 오늘 활동 제거 (하루 끝/전부 완료/로그아웃)
    Function("end") {
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<PlandoDayAttributes>.activities {
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
      }
    }
  }
}
