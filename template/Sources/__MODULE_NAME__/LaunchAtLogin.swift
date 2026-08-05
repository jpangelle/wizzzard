import Foundation
import ServiceManagement

/// Wrapper over SMAppService. Reads real registration state — never a cached bool.
/// Requires a real .app bundle: use `make run`, not `swift run`.
enum LaunchAtLogin {
    static var isEnabled: Bool {
        get { SMAppService.mainApp.status == .enabled }
        set {
            do {
                if newValue {
                    try SMAppService.mainApp.register()
                } else {
                    try SMAppService.mainApp.unregister()
                }
            } catch {
                NSLog("LaunchAtLogin: failed to update: \(error)")
            }
        }
    }

    /// Applies AppConfig.launchAtLoginDefault exactly once, so a user who
    /// later unchecks the toggle isn't fought on every launch.
    static func applyDefaultOnFirstRun() {
        let key = "wizzzard.didApplyLaunchAtLoginDefault"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)
        if AppConfig.launchAtLoginDefault {
            isEnabled = true
        }
    }
}
