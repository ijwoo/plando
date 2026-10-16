//
//  PlandoSharedKeychain.swift
//
//  App Group 공유 키체인 헬퍼 — 위젯/인텐트 인증 토큰(JWT) 저장용.
//  평문 App Group UserDefaults 대신 키체인에 보관한다.
//  iOS는 App Group ID("group.…")를 kSecAttrAccessGroup(키체인 접근 그룹)으로
//  그대로 사용할 수 있어 별도 keychain-access-groups entitlement가 필요 없다.
//
//  ⚠️ 타겟 간 소스 공유가 안 되어 세 곳에 "바이트 동일"하게 복제되어 있다:
//    - modules/plando-widget/ios/PlandoSharedKeychain.swift  (메인 앱 — Expo 모듈)
//    - targets/widget/PlandoSharedKeychain.swift             (위젯 익스텐션)
//    - plugins/app-shortcuts/PlandoSharedKeychain.swift      (메인 앱 타겟 — Siri 인텐트)
//  수정 시 세 파일을 반드시 함께 갱신할 것.
//

import Foundation
import Security

enum PlandoSharedKeychain {
  /// App Group ID를 키체인 접근 그룹으로 그대로 사용 (SharedDefaults.appGroupID 와 동일 값).
  private static let accessGroup = "group.com.imjaewoo.plando"
  private static let service = "plando.auth"
  private static let account = "authToken"

  private static var baseQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrAccessGroup as String: accessGroup,
    ]
  }

  /// 토큰 저장 — 기존 항목은 교체. 실패 silent (다음 setLoggedIn 때 재시도됨).
  static func set(_ value: String) {
    guard let data = value.data(using: .utf8) else { return }
    // update 경로에서 accessible 속성이 갱신되지 않는 엣지를 피하려고 delete 후 add.
    SecItemDelete(baseQuery as CFDictionary)
    var query = baseQuery
    query[kSecValueData as String] = data
    // 첫 잠금 해제 이후 접근 가능 + 이 기기 한정(백업 이전 제외)
    // — 잠금 화면 위젯/백그라운드 인텐트에서도 읽힌다.
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    SecItemAdd(query as CFDictionary, nil)
  }

  /// 토큰 조회 — 없거나 접근 불가면 nil.
  static func get() -> String? {
    var query = baseQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  /// 토큰 삭제 (로그아웃).
  static func delete() {
    SecItemDelete(baseQuery as CFDictionary)
  }
}
