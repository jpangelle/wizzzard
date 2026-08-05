# wizzzard — CLI wizard for scaffolding macOS QoL utility apps

**Date:** 2026-08-05
**Status:** Approved

## Problem

Every new personal Mac utility requires rebuilding the same scaffolding before any real work starts: launch at login, dock hiding / menu-bar-only behavior, signing so TCC permissions stick, a settings window, build plumbing. wizzzard is an interactive CLI wizard that answers-away that boilerplate so a new idea goes from zero to a running, correctly-behaving menu bar app in under a minute.

## Decisions

| Decision | Choice |
|---|---|
| Generated app stack | Native Swift + SwiftUI, macOS 14+ |
| Build flow for generated apps | CLI-first: Swift Package Manager + Makefile; no `.xcodeproj` |
| v1 feature set | Core four: menu bar app, launch at login, dock policy, settings window |
| Signing | Ad-hoc (`codesign --sign -`) with a stable identifier so TCC grants persist across rebuilds |
| Wizard stack | TypeScript + Node, `@clack/prompts`; run via `npx wizzzard` |
| Generation strategy | Template tree + token substitution, answers mostly land in a generated `AppConfig.swift`; file inclusion only for structural variants |

Out of scope for v1 (deliberately — YAGNI): non-interactive flag mode, Developer ID signing/notarization, global hotkeys, notifications, TCC permission helpers, auto-update, Xcode project generation. The architecture keeps these addable later (new prompts + template files).

## Wizard UX

Run `npx wizzzard` in any directory. Prompts, in order:

1. **App name** — free text, e.g. "Clipboard Buddy". Validated: must derive a valid Swift module name and a non-empty kebab-case directory name.
2. **Bundle ID** — default `com.jpangelle.<kebab-name>`, editable, validated against reverse-DNS format.
3. **App style** — one of:
   - *Menu bar only* — no Dock icon (`LSUIElement = true`)
   - *Dock app that hides when the last window closes* — switches `NSApp.setActivationPolicy(.accessory)` on last-window-close, restores `.regular` on reactivation
   - *Regular Dock app*
4. **Menu bar UI** — *Popover with SwiftUI view* or *plain dropdown menu*. Asked only for the menu-bar-only style (v1: the other two styles get no status item).
5. **Launch at login?** — yes/no. Sets the default; the generated Settings window always contains the toggle regardless.
6. **Summary + confirm** — then generate into `./<kebab-name>/` and print next steps (`cd <dir> && make run`). *(Amended 2026-08-05: no git repo is created — user decision.)*

## Generated app

```
clipboard-buddy/
├── Package.swift              # SPM executable target, macOS 14+
├── Makefile                   # build / run / clean / install
├── Sources/ClipboardBuddy/
│   ├── App.swift              # @main, activation-policy wiring
│   ├── AppConfig.swift        # generated constants from wizard answers
│   ├── MenuBar.swift          # status item + popover OR menu (variant chosen at generation)
│   ├── ContentView.swift      # "your idea goes here" stub — the one file to edit
│   ├── SettingsView.swift     # Settings scene, @AppStorage prefs, launch-at-login toggle
│   └── LaunchAtLogin.swift    # SMAppService.mainApp wrapper (reads real registration state)
├── Resources/
│   ├── Info.plist             # bundle ID, version, LSUIElement per answer
│   └── AppIcon.icns           # placeholder icon
├── CLAUDE.md                  # structure + make targets, for productive Claude Code sessions
├── .gitignore                 # .build/, dist/
└── README.md                  # what was generated, how to change decisions later
```

### Build mechanics (`Makefile`)

- `make build` — `swift build -c release`, then assemble `dist/<AppName>.app` (bundle layout: executable into `Contents/MacOS/`, `Info.plist`, icon into `Contents/Resources/`), then `codesign --force --sign - --identifier <bundle-id>` (stable identifier → TCC grants survive rebuilds).
- `make run` — build, then `open dist/<AppName>.app`.
- `make install` — build, copy to `/Applications`.
- `make clean` — remove `.build/` and `dist/`.

### Behavior wiring

- **Dock policy:** menu-bar-only via `LSUIElement` in Info.plist; hide-on-close via `NSApplicationDelegate` hooks in `App.swift` (accessory policy on last window close, regular on reopen/activate). Regular apps get neither.
- **Launch at login:** `LaunchAtLogin.swift` wraps `SMAppService.mainApp` (`register()`/`unregister()`, status read from the service, not a cached bool). If the wizard answer was "yes", `App.swift` registers on first launch (guarded by an `@AppStorage` first-run flag so a user unchecking it isn't fought).
- **Settings:** SwiftUI `Settings` scene; opened from the menu bar item for menu-bar apps, and via the standard app menu / Cmd-comma for windowed styles; contains launch-at-login toggle and a stub section for app-specific prefs.
- **AppConfig.swift:** `appName`, `dockPolicy` (enum), `launchAtLoginDefault` — flipping a decision later is editing this file (plus `LSUIElement` for dock-icon changes), not re-scaffolding.

## Wizard CLI internals

```
wizzzard/
├── package.json               # bin: "wizzzard"; dep: @clack/prompts; Node 20+
├── src/
│   ├── index.ts               # entry point: prompts → answers → generate → next steps
│   ├── prompts.ts             # question definitions + validation
│   ├── generate.ts            # copy template, substitute tokens, pick variants, git init
│   └── names.ts               # name derivations: display / PascalCase module / kebab dir / bundle ID
├── template/                  # the complete working app with __TOKEN__ placeholders
│   └── ...                    #   MenuBar.popover.swift + MenuBar.menu.swift variants
└── test/
    ├── names.test.ts          # pure-function tests (node:test)
    ├── generate.test.ts       # generate into tmpdir; assert file set + substitutions
    └── smoke.sh               # generate each variant + `swift build` — output must compile
```

### Generation algorithm

1. Copy `template/` to target dir (refuse if target exists and is non-empty).
2. Substitute tokens (`__APP_NAME__`, `__MODULE_NAME__`, `__KEBAB_NAME__`, `__BUNDLE_ID__`) in file contents and in file/directory names.
3. Structural picks: copy the chosen `MenuBar` variant to `MenuBar.swift`, drop the other; omit `MenuBar.swift` entirely for non-menu-bar styles. Write `LSUIElement` and `AppConfig.swift` values from answers.
4. Print next steps. *(Amended 2026-08-05: generation no longer creates a git repo.)*

No template engine, no programmatic Swift generation — token substitution and a file pick. Template complexity lives in real Swift files that compile.

### Error handling

- Validate app name / bundle ID at prompt time with inline error messages; re-prompt.
- Refuse non-empty target directory with a clear message (no `--force` in v1).
- Preflight: check `swift` is on PATH (i.e. Xcode Command Line Tools installed); warn with the `xcode-select --install` remedy but still generate.
- Ctrl-C at any prompt exits cleanly with nothing written (generation is all-or-nothing: build the file plan in memory, write at the end).

## Testing

- **Unit:** `names.ts` derivations (weird inputs: emoji, spaces, leading digits); `generate.ts` output in a tmpdir (file set, no leftover `__TOKEN__` strings, correct variant picked).
- **Smoke (the one that matters):** `test/smoke.sh` generates one app per app-style/menu-UI combination and runs `swift build` on each — guarantees "wizard output always compiles." Run locally via `npm run smoke`; also keeps the template honest since the template *is* the app.
- Runner: Node's built-in `node:test`. No test framework dependency.

## Success criteria

1. `npx wizzzard` → answer the prompts (4–5 questions plus a confirm) → `make run` launches a working, ad-hoc-signed menu bar app in under a minute.
2. Launch-at-login toggle in Settings works and reflects real `SMAppService` state.
3. Menu-bar-only apps show no Dock icon; hide-on-close apps leave the Dock when their window closes and come back on reactivation.
4. All generated variants compile (`smoke.sh` green).
5. Starting the actual utility idea = editing `ContentView.swift`, nothing else.
