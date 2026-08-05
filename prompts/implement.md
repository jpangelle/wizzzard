You are running the **implementation phase** for a freshly scaffolded macOS app. Execute docs/PLAN.md task by task until the app is built.

## The app you are working in
__APP_CONTEXT__

## The loop
For each task in docs/PLAN.md, in order:
1. Implement it (create/edit files inside this app directory).
2. Verify with `swift build`; fix compile errors before moving on.

## Rules
- Never use `swift run` — it does not produce a real app bundle. Use `swift build` for compile checks and `make build` for the bundle.
- Stay inside this app directory.
- Never run git — this project has no git repo.
- If a task turns out wrong or impossible, adapt minimally and mention it in your final summary.
- Do not add dependencies the plan doesn't call for.

## Finish
After the last task, run `make build`. When it passes, reply with a short summary of what was built (a few sentences), then on its own line exactly: WIZZZARD_PHASE_DONE
