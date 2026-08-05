# __APP_NAME__

Scaffolded by [wizzzard](https://github.com/jpangelle/wizzzard). Native SwiftUI macOS app — Swift Package Manager + Makefile, no Xcode project.

## Start building

Edit `Sources/__MODULE_NAME__/ContentView.swift` — that's your app.

## Commands

| Command | What it does |
|---|---|
| `make run` | Build, bundle, ad-hoc sign, and launch the app |
| `make build` | Produce `dist/__MODULE_NAME__.app` |
| `make install` | Copy the app to /Applications |
| `make clean` | Delete build products |

Always run via `make run`, not `swift run` — launch-at-login (SMAppService) and dock behavior need a real .app bundle. Ad-hoc signing uses a stable identifier so macOS permission grants (TCC) survive rebuilds.

## Changing scaffold decisions later

| Decision | Where |
|---|---|
| Launch at login | Settings window toggle; `AppConfig.launchAtLoginDefault` is only the first-run default |
| Dock behavior | `AppConfig.dockPolicy` + `LSUIElement` in `Resources/Info.plist` |
| Menu bar icon | `AppConfig.menuBarIcon` (any SF Symbol name) |
| App name / bundle ID | `Resources/Info.plist` and the variables at the top of `Makefile` |
