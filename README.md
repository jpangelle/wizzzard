# wizzzard 🧙

Answer a few questions, get a complete, buildable, native SwiftUI Mac app — menu bar item, launch at login, dock policy, and settings window pre-wired — so you can work on the idea instead of the scaffolding.

## Install

```sh
npm install -g wizzzard
```

Or run it without installing:

```sh
npx wizzzard
```

**Requirements:** macOS 14+, Node 24+, and the Xcode Command Line Tools (`xcode-select --install`).

## Use

First, connect your Claude account (one time — this powers the optional AI phases; it uses Claude Code's own login, and wizzzard never stores tokens):

```sh
wizzzard setup
```

Then run the wizard anywhere:

```sh
wizzzard
```

Answer the questions, then:

```sh
cd <your-app>
make run
```

Your app builds, signs, and launches. Edit `Sources/<YourApp>/ContentView.swift` — that's the one file where your idea lives. Everything else is pre-wired.

### What it asks

1. App name
2. Where to create it (defaults to the current directory; `~` works)
3. Bundle identifier (defaults to `com.jpangelle.<name>`)
4. App style — menu bar only / Dock app that hides on close / regular Dock app
5. Menu bar UI — SwiftUI popover or plain dropdown menu (menu-bar apps only)
6. Launch at login default
7. Describe your app (optional — enables the AI phases below)

### What you get

A Swift Package Manager project with a Makefile — no Xcode project to maintain.

| Command | What it does |
|---|---|
| `make run` | Build, bundle, sign, and launch the app |
| `make install` | Copy the app to /Applications |
| `make clean` | Delete build products |

The app is ad-hoc signed with a stable identifier, so macOS permission grants (TCC) survive rebuilds. Scaffold-time decisions (dock behavior, menu bar icon, launch-at-login default) live in `AppConfig.swift` and can be changed later — the generated README explains how.

## AI phases (optional)

With your Claude account connected (`wizzzard setup`, from the Use section), answering the wizard's **Describe your app** question kicks off, inside your new app:

1. **Brainstorm** — Claude asks a few questions one at a time, then writes `docs/DESIGN.md`
2. **Plan** (gated) — turns the design into a step-by-step `docs/PLAN.md`
3. **Implement** (gated) — executes the plan task by task, ending with a green `make build`

File edits and build commands inside your new app are auto-allowed; anything else (other paths, other commands, network) asks on-screen first. Skip any gate and pick up later in Claude Code — the docs are plain markdown in your app directory.

## Development

- `npm test` — unit tests; `npm run typecheck`
- `npm run smoke` — generates every variant and compiles each; the guarantee that wizard output always builds
- `npm run e2e-llm` — manual live test of the AI phases (needs a connected Claude account; costs tokens)
- The app template lives in `template/` with `__TOKEN__` placeholders; `npm link` gives you a global `wizzzard` that tracks the working tree
