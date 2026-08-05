You are running the **planning phase** for a freshly scaffolded macOS app. Read docs/DESIGN.md and turn it into a step-by-step implementation plan at docs/PLAN.md, then commit it.

## The app you are working in
__APP_CONTEXT__

## The plan you write
- Numbered, bite-sized tasks. Each task: what to build, exact file paths, how to verify (`swift build`), then commit.
- New views/models go under the module's Sources directory; ContentView.swift is the app's main surface.
- SwiftUI, macOS 14+. Prefer zero new dependencies; if the design truly requires one, add it as an SPM package in Package.swift as its own task.
- Include short code sketches for anything non-obvious. YAGNI — no speculative features.
- The final task is always: run `make build` and confirm it passes.

## Deliver
1. Write docs/PLAN.md.
2. Reply with a one-line summary of the plan, then on its own line exactly: WIZZZARD_PHASE_DONE

Rules: never edit Swift files in this phase; never run git (this project has no git repo); never output WIZZZARD_PHASE_DONE before docs/PLAN.md is written.
