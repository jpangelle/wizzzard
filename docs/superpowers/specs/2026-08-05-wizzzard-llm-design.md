# wizzzard LLM piece — setup, describe-your-app, embedded skills

**Date:** 2026-08-05
**Status:** Approved
**Builds on:** `2026-08-05-wizzzard-design.md` (v1 scaffold wizard, shipped)

## Problem

The wizard scaffolds the boilerplate, but the *idea* still starts from a blank `ContentView.swift`. This feature adds an LLM piece: connect your Claude account once (`wizzzard setup`), describe your app in the wizard, and get an embedded brainstorm → design doc → implementation plan → working first implementation, all inside wizzzard's TUI, running in the freshly scaffolded repo.

## Decisions

| Decision | Choice |
|---|---|
| LLM engine | `@anthropic-ai/claude-agent-sdk` — uses Claude Code's own credentials (subscription OAuth via `claude /login`); wizzzard never stores tokens |
| Conversation home | Embedded in wizzzard's TUI (SDK runs the agent loop; wizzzard renders it) |
| Skills source | Bundled, wizzzard-adapted prompts for brainstorming / writing-plans / executing-plans (no superpowers plugin dependency) |
| Auth failure posture | Graceful: wizard always works; AI phases skip with a "run `wizzzard setup`" notice |
| Model/effort knobs | Not exposed in v1 (SDK default model) |

Out of scope for v1: resuming an interrupted phase in a later wizzzard run (use Claude Code on the generated repo instead), custom OAuth implementation, API-key mode, exposing model selection, MCP servers, running phases on pre-existing (non-wizzzard) projects.

## CLI surface

- `wizzzard` — the wizard (existing behavior + new question and phases).
- `wizzzard setup` — connect/verify the Claude account.
- Unknown subcommand — one-line usage message, exit 1.

## `wizzzard setup`

1. **Probe**: run a minimal 1-turn SDK query ("reply with ok", `maxTurns: 1`). Success ⇒ authenticated.
2. **On auth failure**: if `claude` is on PATH, explain and spawn `claude /login` interactively (inherit stdio), then re-probe once. If not on PATH, print install + login instructions (`npm install -g @anthropic-ai/claude-code`, then `claude /login`, then `wizzzard setup` again) and exit 1.
3. **On success**: `p.outro("Connected to your Claude account ✨")`.

No state is written by setup; auth truth lives with Claude Code. The wizard re-probes lazily when a description is entered (cheap), so setup is a convenience/diagnostic, not a gate.

## Wizard flow changes

New optional question, last before the summary:

> **Describe your app** — free text, placeholder "(optional — Enter to skip; enables AI brainstorm → plan → implement)"

- Empty ⇒ exactly current behavior; summary/confirm unchanged (no Description line).
- Non-empty ⇒ summary gains a `Description:` line. After successful generation (files + git init), wizzzard enters the phase flow **in the generated app directory**:

### Phase 1 — Brainstorm (runs automatically when a description was given)

- Auth probe first; on failure: `p.log.warn` "AI phases need a connected Claude account — run `wizzzard setup`. Your app is scaffolded and ready." and stop (exit success).
- Interactive Q&A rendered in the TUI: the agent asks **one question at a time** (adapted superpowers brainstorming); wizzzard shows it and collects the answer via a clack text prompt; loop until the agent presents a short design and asks for approval (yes/no via clack confirm; "no" loops with revisions).
- Output: agent writes `docs/DESIGN.md` in the app repo and commits it (`docs: design from wizzzard brainstorm`).

### Phase 2 — Plan (gated)

- Gate: `p.confirm("Write the implementation plan?")` — decline ⇒ stop here (design committed; outro points at Claude Code for later).
- Adapted writing-plans prompt turns `docs/DESIGN.md` into `docs/PLAN.md`: bite-sized TDD tasks with exact files, scaffold-aware (edit `ContentView.swift`/add files under `Sources/<Module>/`, verify with `swift build` and `make build`, never `swift run`). Committed (`docs: implementation plan`).

### Phase 3 — Implement (gated)

- Gate: `p.confirm("Implement it now?")` — decline ⇒ stop (plan committed).
- Adapted executing-plans prompt: task loop over `docs/PLAN.md` — implement, build, fix, commit per task (`feat: <task>`); finish by running `make build` and reporting.
- wizzzard streams progress from the SDK's structured events: one line per tool use (file edited, command run + ok/fail, task committed). Assistant prose between tool calls renders dimmed and truncated to its first line; the final phase summary renders in full.

### Wrap-up

Outro always prints `cd <path>` + `make run`, and after phase 3, "then see docs/PLAN.md for what was built."

## Permission model

`src/llm/policy.ts` exports a pure function used by the SDK's `canUseTool` hook:

```
decide(toolName, toolInput, appDir) → { verdict: "allow" | "ask", reason: string }
```

- **allow**: Read/Glob/Grep anywhere under `appDir`; Write/Edit under `appDir`; Bash whose command starts with a whitelisted binary (`swift`, `make`, `git`, `plutil`, `codesign`, `mkdir`, `ls`, `cat`) **and** whose `cwd` resolves under `appDir`.
- **ask**: anything else — web tools, Bash outside the whitelist, any path outside `appDir`. wizzzard renders a clack confirm showing tool + exact input; decline ⇒ the agent is told the call was denied.
- Path checks resolve symlinks/`..` before comparing prefixes.

## Architecture

```
src/index.ts        # routing only: "setup" → runSetup(), none → runWizard(), else usage
src/wizard.ts       # existing wizard flow (moved from index.ts) + describe question + phases
src/setup.ts        # probe / login handoff / messaging
src/llm/session.ts  # SDK wrapper: probeAuth(), runInteractivePhase(), runStreamingPhase()
src/llm/policy.ts   # pure permission decisions
src/llm/prompts.ts  # load prompts/<phase>.md, inject app-context tokens
prompts/brainstorm.md, plan.md, implement.md   # bundled adapted skills ("prompts" added to package.json files)
```

- `session.ts` takes the SDK `query` function via a parameter with a default import — unit tests inject fakes; no network in CI.
- Prompt token injection reuses the same `__TOKEN__` style as the template (app name, module, style, dock policy, description) via the existing `substituteTokens`.
- Phase prompts include the scaffold's file map and build rules so the agent never has to rediscover them.

## Error handling

- SDK/API error mid-phase: abort the phase, keep everything committed so far, message: "Something went wrong talking to Claude — your app and docs so far are intact. Continue anytime with Claude Code in <dir>." Exit success (scaffold succeeded).
- Ctrl-C during a phase: same guarantee (phases only produce committed artifacts + working-tree edits; implement phase commits per task).
- Generation itself never depends on any LLM call succeeding.

## Testing

- **Unit (CI):** routing (setup/none/unknown); `policy.ts` decision table (in-dir edit allow; out-of-dir write ask; `rm -rf` ask; `swift build` in-dir allow; `curl` ask; `..`/symlink escapes caught); prompt loading (three files exist in `npm pack` output, tokens fully substituted, unknown tokens throw).
- **Session wrapper:** fake `query` streams scripted agent turns; assert the Q&A loop renders questions, forwards answers, detects the design-approval handshake.
- **Live e2e (manual, not CI):** `npm run e2e-llm` — scripted run with a trivial app description; human confirms brainstorm quality, gates, and that the implemented app passes `make build`.
- Existing unit + smoke suites unchanged and must stay green.

## Success criteria

1. `wizzzard setup` connects an unauthenticated machine end-to-end (via `claude /login`) and reports success; re-running is idempotent.
2. Wizard with empty description behaves byte-identically to today.
3. Describe → brainstorm produces a committed `docs/DESIGN.md` after an interactive one-question-at-a-time session with an approval handshake.
4. Both gates work; accepting them yields committed `docs/PLAN.md`, then per-task commits and a final `make build` pass.
5. The agent cannot touch paths outside the app dir or run non-whitelisted commands without an explicit on-screen confirmation.
6. All CI tests pass offline; auth failure at any point leaves a fully usable scaffolded app.
