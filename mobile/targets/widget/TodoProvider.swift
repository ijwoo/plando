//
//  TodoProvider.swift
//  PlandoWidget
//
//  WidgetKit TimelineProvider.
//  네트워크 호출 없이 shared UserDefaults 에서 데이터를 읽어
//  현재 시각 기준 entry 1개 + 30분 뒤 reload 정책으로 동작.
//
//  실시간 동기화는 main app 이 데이터 변경 시
//  WidgetCenter.shared.reloadAllTimelines() 호출로 처리.
//

import WidgetKit
import SwiftUI

struct TodoProvider: TimelineProvider {

    /// 위젯 갤러리 미리보기 (사용자 위젯 추가 화면).
    func placeholder(in context: Context) -> TodoEntry {
        TodoEntry.placeholder
    }

    /// 스냅샷 (홈 화면 미리보기).
    func getSnapshot(in context: Context, completion: @escaping (TodoEntry) -> Void) {
        let entry = context.isPreview ? TodoEntry.placeholder : SharedDefaults.loadEntry()
        completion(entry)
    }

    /// 실제 timeline. 30분마다 reload 시도.
    /// 실시간성은 앱이 reloadAllTimelines() 호출로 보강.
    func getTimeline(in context: Context, completion: @escaping (Timeline<TodoEntry>) -> Void) {
        let entry = SharedDefaults.loadEntry()
        let nextReload = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextReload))
        completion(timeline)
    }
}
