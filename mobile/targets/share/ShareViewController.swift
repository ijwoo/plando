//
//  ShareViewController.swift
//  PlandoShare
//
//  공유 확장 — 텍스트/링크를 App Group 인박스(plando.share.inbox)에 적재하고
//  짧은 확인 배너 후 닫힌다. 본앱이 다음 포그라운드에서 인박스를 소비해 할 일 작성으로 연결.
//

import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    private let appGroupID = "group.com.imjaewoo.plando"
    private let inboxKey = "plando.share.inbox"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        extractSharedContent { [weak self] text, url in
            guard let self else { return }
            let payload = [text, url].compactMap { $0 }.joined(separator: "\n")
            if !payload.isEmpty {
                self.appendToInbox(text: text, url: url)
                self.showConfirmation("Plan Do!에 저장했어요")
            } else {
                self.finish()
            }
        }
    }

    /// 첫 텍스트/URL 첨부 추출 (인박스 계약: 둘 중 있는 것만 기록)
    private func extractSharedContent(_ done: @escaping (String?, String?) -> Void) {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            done(nil, nil)
            return
        }
        let providers = items.flatMap { $0.attachments ?? [] }

        var text: String?
        var url: String?
        let group = DispatchGroup()

        /* 앱이 넘겨주는 제목. 사파리는 여기에 페이지 제목을 담는다.
           이걸 안 읽어서 기사를 공유해도 제목이 도메인("news.example.com")이 됐다. */
        for item in items {
            if text == nil, let t = item.attributedContentText?.string.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty {
                text = t
            }
        }

        for provider in providers {
            /* URL 과 텍스트를 **둘 다** 본다.
               [고치는 결함] 예전엔 else-if 라 한 항목이 링크와 텍스트를 함께 줘도 링크만 가져왔다.
               그래서 본문이 있는데도 버리고 도메인을 제목으로 쓰는 일이 생겼다. */
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier), url == nil {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.url.identifier) { item, _ in
                    if let u = item as? URL { url = u.absoluteString }
                    group.leave()
                }
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier), text == nil {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, _ in
                    if let s = item as? String { text = s } else if let d = item as? Data { text = String(data: d, encoding: .utf8) }
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) { done(text, url) }
    }

    /// 인박스에 항목 추가 — [{text?, url?, sharedAt}] JSON 배열 (최대 20개 유지)
    private func appendToInbox(text: String?, url: String?) {
        guard let store = UserDefaults(suiteName: appGroupID) else { return }
        var inbox: [[String: String]] = []
        if let data = store.data(forKey: inboxKey),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
            inbox = parsed
        }
        var entry: [String: String] = ["sharedAt": ISO8601DateFormatter().string(from: Date())]
        if let text { entry["text"] = text }
        if let url { entry["url"] = url }
        inbox.append(entry)
        if inbox.count > 20 { inbox.removeFirst(inbox.count - 20) }
        if let data = try? JSONSerialization.data(withJSONObject: inbox) {
            store.set(data, forKey: inboxKey)
        }
    }

    /// 하단 확인 배너 잠깐 표시 후 종료
    private func showConfirmation(_ message: String) {
        let banner = UIView()
        banner.backgroundColor = UIColor(white: 0.08, alpha: 0.95)
        banner.layer.cornerRadius = 14
        banner.translatesAutoresizingMaskIntoConstraints = false

        let label = UILabel()
        label.text = "✓ " + message
        label.textColor = .white
        label.font = .systemFont(ofSize: 15, weight: .semibold)
        label.translatesAutoresizingMaskIntoConstraints = false
        banner.addSubview(label)
        view.addSubview(banner)

        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: banner.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: banner.centerYAnchor),
            banner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            banner.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
            banner.widthAnchor.constraint(equalTo: label.widthAnchor, constant: 36),
            banner.heightAnchor.constraint(equalToConstant: 44),
        ])

        banner.alpha = 0
        UIView.animate(withDuration: 0.18) { banner.alpha = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { [weak self] in
            self?.finish()
        }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
