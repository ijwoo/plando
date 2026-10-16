import ExpoModulesCore

/**
 * 앱 스위처 스냅샷 보호 — 앱 잠금(Face ID)을 켠 사용자의 화면 내용이
 * 멀티태스킹 스냅샷에 남지 않도록, 비활성화 시 불투명 커버를 덮는다.
 * App Group UserDefaults 키 plando.applock.enabled(Bool)가 true일 때만 동작.
 * (write 주체: PlandoWidgetModule.setAppLockEnabled ← src/shared/store/appLockStore.ts)
 */
public class PlandoPrivacyShieldSubscriber: ExpoAppDelegateSubscriber {
  private let appGroupID = "group.com.imjaewoo.plando"
  /// PlandoWidgetModule.Keys.appLockEnabled 와 동일 값 (모듈 Keys 는 private 이라 리터럴 중복)
  private let appLockEnabledKey = "plando.applock.enabled"
  /// 커버 뷰 식별용 태그 — "PLDS"(Plando Shield)
  private let coverTag = 0x504C_4453

  private var isAppLockEnabled: Bool {
    UserDefaults(suiteName: appGroupID)?.bool(forKey: appLockEnabledKey) ?? false
  }

  private func allWindows(of application: UIApplication) -> [UIWindow] {
    application.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
  }

  public func applicationWillResignActive(_ application: UIApplication) {
    guard isAppLockEnabled else { return }
    let windows = allWindows(of: application)
    guard let window = windows.first(where: { $0.isKeyWindow }) ?? windows.first,
          window.viewWithTag(coverTag) == nil
    else { return }

    let cover = UIView(frame: window.bounds)
    cover.tag = coverTag
    // 브랜드 블루 #3070EB
    cover.backgroundColor = UIColor(red: 0x30 / 255.0, green: 0x70 / 255.0, blue: 0xEB / 255.0, alpha: 1)
    cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    let icon = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))
    icon.tintColor = .white
    icon.contentMode = .scaleAspectFit
    icon.translatesAutoresizingMaskIntoConstraints = false
    cover.addSubview(icon)
    NSLayoutConstraint.activate([
      icon.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
      icon.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
      icon.widthAnchor.constraint(equalToConstant: 72),
      icon.heightAnchor.constraint(equalToConstant: 72),
    ])

    window.addSubview(cover)
  }

  public func applicationDidBecomeActive(_ application: UIApplication) {
    // 설정 on/off 와 무관하게 항상 제거 — 표시 중 설정이 꺼져도 커버가 남지 않게
    for window in allWindows(of: application) {
      window.viewWithTag(coverTag)?.removeFromSuperview()
    }
  }
}
