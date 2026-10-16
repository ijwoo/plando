import ExpoModulesCore
import CoreSpotlight
import UniformTypeIdentifiers

/**
 * Spotlight 브릿지 — 할 일을 CoreSpotlight 기본 인덱스에 색인해 시스템 검색에 노출한다.
 * uniqueIdentifier "todo-<id>" / domainIdentifier "todos" 계약.
 * 결과 탭 → PlandoSpotlightAppDelegateSubscriber가 plando://todo/<id> 딥링크로 라우팅.
 */
private struct SpotlightTodoItem: Decodable {
  let id: Int
  let title: String
  let content: String?
  let due: String?
}

public class PlandoSpotlightModule: Module {
  private static let domainIdentifier = "todos"

  public func definition() -> ModuleDefinition {
    Name("PlandoSpotlight")

    /// itemsJson: [{id, title, content?, due?}] — 전체 삭제 후 재색인 (규모가 작아 diff 불필요)
    Function("indexTodos") { (itemsJson: String) in
      guard let data = itemsJson.data(using: .utf8),
            let todos = try? JSONDecoder().decode([SpotlightTodoItem].self, from: data) else {
        return
      }

      let items: [CSSearchableItem] = todos.map { todo in
        let attributes = CSSearchableItemAttributeSet(contentType: UTType.text)
        attributes.title = todo.title
        if let content = todo.content, !content.isEmpty {
          attributes.contentDescription = content
        } else if let due = todo.due, !due.isEmpty {
          attributes.contentDescription = "마감 \(due)"
        }
        var keywords = ["할 일", "todo", "plando"]
        if let due = todo.due, !due.isEmpty {
          keywords.append(due)
        }
        attributes.keywords = keywords

        return CSSearchableItem(
          uniqueIdentifier: "todo-\(todo.id)",
          domainIdentifier: Self.domainIdentifier,
          attributeSet: attributes
        )
      }

      let index = CSSearchableIndex.default()
      // 삭제 완료 후 색인 — 순서 보장을 위해 completion에서 체이닝
      index.deleteSearchableItems(withDomainIdentifiers: [Self.domainIdentifier]) { _ in
        guard !items.isEmpty else { return }
        index.indexSearchableItems(items) { _ in }
      }
    }

    /// 로그아웃 등 — 색인 전체 제거
    Function("clearAll") {
      CSSearchableIndex.default()
        .deleteSearchableItems(withDomainIdentifiers: [Self.domainIdentifier]) { _ in }
    }
  }
}
