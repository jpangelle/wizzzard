# __APP_NAME__

macOS utility app scaffolded by wizzzard. Swift + SwiftUI, macOS 14+, built with SPM — there is deliberately no Xcode project.

## Build & run
- `make run` — build, assemble `dist/__MODULE_NAME__.app`, ad-hoc sign, launch. This is the only correct way to test: SMAppService (launch at login) and LSUIElement (dock hiding) require a real bundle, so `swift run` will misbehave.
- `make build`, `make clean`, `make install` (copies to /Applications).
- `swift build` alone is fine for a quick compile check.

## Structure
- `Sources/__MODULE_NAME__/ContentView.swift` — the app's actual UI and logic. App-specific work happens here.
- `Sources/__MODULE_NAME__/AppConfig.swift` — scaffold-time decisions as constants (dock policy, launch-at-login default, menu bar icon). Edit to change behavior.
- `Sources/__MODULE_NAME__/App.swift` + `AppDelegate.swift` — scene setup and dock/activation-policy wiring. Rarely needs changes.
- `Sources/__MODULE_NAME__/SettingsView.swift` — Settings window (Cmd-,), includes the launch-at-login toggle.
- `Sources/__MODULE_NAME__/LaunchAtLogin.swift` — SMAppService wrapper reading real registration state.
- `Resources/Info.plist` — bundle ID, LSUIElement.
