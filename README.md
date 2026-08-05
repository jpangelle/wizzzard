# wizzzard 🧙

Interactive CLI wizard for scaffolding macOS QoL utility apps. Answer ~5 questions, get a complete, buildable, native SwiftUI app — menu bar item, launch at login, dock policy, and settings window pre-wired — so you can work on the idea instead of the scaffolding.

## Use

```sh
npx wizzzard
```

Then:

```sh
cd <your-app>
make run
```

Requires macOS 14+, Node 24+, and the Xcode Command Line Tools (`xcode-select --install`).

## What it asks

1. App name
2. Where to create it (defaults to the current directory; `~` works)
3. Bundle identifier (defaults to `com.jpangelle.<name>`)
4. App style — menu bar only / Dock app that hides on close / regular Dock app
5. Menu bar UI — SwiftUI popover or plain dropdown menu (menu-bar apps only)
6. Launch at login default

## What you get

Swift Package Manager + Makefile (no Xcode project). `make run` builds, assembles the `.app` bundle, ad-hoc signs with a stable identifier (so TCC permission grants survive rebuilds), and launches. `ContentView.swift` is the one file you edit to start building. Scaffold-time decisions live in `AppConfig.swift` and can be changed later.

## Development

- `npm test` — unit tests (name derivation, generator output)
- `npm run smoke` — generates every variant and compiles each with `swift build`; the guarantee that wizard output always builds
- `npm run typecheck`
- Template lives in `template/` with `__TOKEN__` placeholders and variant-suffixed files (`App.swift.menubar`, `MenuBar.swift.popover`, …)
- `scripts/make-icon.sh` regenerates the placeholder icon
