enum DockPolicy {
    case menuBarOnly
    case hideOnClose
    case regular
}

/// Decisions made when this app was scaffolded. Edit freely — this file is
/// the knob panel, not generated output you must preserve.
enum AppConfig {
    /// Display name shown in the menu bar and UI.
    static let appName = "__APP_NAME__"
    /// Dock behavior. Note: .menuBarOnly also requires LSUIElement=true in Resources/Info.plist.
    static let dockPolicy: DockPolicy = .__DOCK_POLICY__
    /// Applied once on first launch; the Settings toggle wins after that.
    static let launchAtLoginDefault = __LAUNCH_AT_LOGIN_DEFAULT__
    /// SF Symbol shown in the menu bar.
    static let menuBarIcon = "wand.and.stars"
}
