# wizzzard LLM Piece Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `wizzzard setup` (Claude account connection via the Agent SDK / Claude Code credentials) and an optional "Describe your app" question that triggers embedded brainstorm → design doc → plan → implementation phases inside the freshly scaffolded app repo.

**Architecture:** `src/index.ts` becomes a router (`setup` vs wizard). The wizard (moved to `src/wizard.ts`) gains a description question; when answered, phase orchestration runs in the generated app dir via `src/llm/session.ts`, a thin wrapper over `@anthropic-ai/claude-agent-sdk`'s streaming-input mode with a `canUseTool` permission hook backed by the pure `src/llm/policy.ts`. Phase behavior comes from bundled prompt files (`prompts/*.md`) with app context injected by `src/llm/prompts.ts`.

**Tech Stack:** Existing stack + `@anthropic-ai/claude-agent-sdk` (the only new dependency).

**Spec:** `docs/superpowers/specs/2026-08-05-wizzzard-llm-design.md`

## Global Constraints

- Commit **directly to `main`** and `git push` after each task.
- Node ≥ 24 native type-stripping: erasable-only TS (no `enum`/`namespace`/parameter properties), `.ts` extensions on relative imports, `import type` for types.
- Runtime deps after this plan: `@clack/prompts` + `@anthropic-ai/claude-agent-sdk` — nothing else. Tests stay on `node:test`, offline (fake `query` injection; no network in CI).
- The phase-done protocol marker is exactly `WIZZZARD_PHASE_DONE`.
- Bash whitelist (exact): `swift`, `make`, `plutil`, `codesign`, `mkdir`, `ls`, `cat` — `git` was removed by user decision (2026-08-05): **generated apps get no git repo**; phase docs live uncommitted in `docs/`. (Task 2 shipped with `git` whitelisted before this change; a standalone amendment commit removes it — see ledger.)
- Empty description ⇒ wizard behavior byte-identical to today. Generation never depends on any LLM call.
- SDK API note: code below targets the documented Agent SDK surface (`query({prompt, options})`, streaming-input `AsyncIterable` prompts, `canUseTool`, `systemPrompt: {type:"preset", preset:"claude_code", append}`, per-turn `result` messages). If the installed SDK version differs in type shapes (e.g. `SDKUserMessage` fields), adapt **minimally**, keep the observable contract, and document the deviation in your report.

---

### Task 1: CLI routing + module split

**Files:**
- Modify: `src/index.ts` (becomes router only)
- Create: `src/wizard.ts` (receives everything index.ts currently does after the Node guard)
- Create: `src/setup.ts` (stub until Task 5)
- Modify: `package.json` (add SDK dep; add `"prompts"` to `files`)
- Test: `test/cli.test.ts`

**Interfaces:**
- Consumes: existing `src/index.ts` content.
- Produces: `runWizard(): Promise<void>` from `src/wizard.ts`; `runSetup(): Promise<void>` from `src/setup.ts` (stub). Router contract: no args → wizard; `setup` → setup; anything else → usage on stderr, exit 1 — checked **before** any dynamic import so the unknown-command path never loads heavy modules.

- [ ] **Step 1: Write the failing test**

Create `test/cli.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));

test("unknown subcommand prints usage and exits 1", () => {
  const result = spawnSync(process.execPath, [entry, "bogus"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command: bogus/);
  assert.match(result.stderr, /Usage: wizzzard \[setup\]/);
});

test("setup subcommand routes to the setup module", () => {
  const result = spawnSync(process.execPath, [entry, "setup"], {
    encoding: "utf8",
    env: { ...process.env, WIZZZARD_SETUP_STUB: "1" },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /setup stub/);
});
```

Note: the second test relies on the Task 1 stub honoring `WIZZZARD_SETUP_STUB`; Task 5's real implementation MUST keep this env-var early-exit so the routing test stays offline forever.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: `cli` tests FAIL (index.ts currently starts the wizard prompts for any argv). Others PASS.

- [ ] **Step 3: Create `src/wizard.ts`**

Move the current body of `src/index.ts` (everything except the shebang and the Node-version guard) into an exported function. The file becomes:

```ts
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { generate } from "./generate.ts";
import { runPrompts } from "./prompts.ts";

export async function runWizard(): Promise<void> {
  const templateDir = fileURLToPath(new URL("../template", import.meta.url));

  const swiftCheck = spawnSync("swift", ["--version"], { stdio: "ignore" });
  if (swiftCheck.error || swiftCheck.status !== 0) {
    p.log.warn("Swift toolchain not found — install with: xcode-select --install (generating anyway)");
  }

  const answers = await runPrompts();

  try {
    const targetDir = await generate(answers, answers.location, templateDir);
    const rel = path.relative(process.cwd(), targetDir);
    const cdTarget = rel && !rel.startsWith("..") ? rel : targetDir;
    p.note(`cd ${cdTarget}\nmake run`, "Next steps");
    p.outro(`${answers.appName} is ready ✨`);
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
```

- [ ] **Step 4: Create the `src/setup.ts` stub**

```ts
export async function runSetup(): Promise<void> {
  if (process.env.WIZZZARD_SETUP_STUB === "1") {
    console.error("setup stub");
    process.exit(2);
  }
  console.error("wizzzard setup is not implemented yet");
  process.exit(1);
}
```

- [ ] **Step 5: Rewrite `src/index.ts` as the router**

```ts
#!/usr/bin/env node
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 24) {
  console.error(`wizzzard requires Node 24+ (you have ${process.versions.node})`);
  process.exit(1);
}

const subcommand: string | undefined = process.argv[2];

if (subcommand === "setup") {
  const { runSetup } = await import("./setup.ts");
  await runSetup();
} else if (subcommand === undefined) {
  const { runWizard } = await import("./wizard.ts");
  await runWizard();
} else {
  console.error(`Unknown command: ${subcommand}\nUsage: wizzzard [setup]`);
  process.exit(1);
}
```

(Keep the executable bit on `src/index.ts`.)

- [ ] **Step 6: Add the SDK dependency and pack the prompts dir**

Run: `npm install @anthropic-ai/claude-agent-sdk`
Edit `package.json` `files` to `["src", "template", "prompts"]`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all PASS (cli tests green; wizard behavior untouched).

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "refactor: CLI router with setup subcommand; add agent SDK dep"
git push
```

---

### Task 2: Permission policy (`policy.ts`)

**Files:**
- Create: `src/llm/policy.ts`
- Test: `test/policy.test.ts`

**Interfaces:**
- Consumes: nothing project-specific.
- Produces: `decide(toolName: string, input: Record<string, unknown>, appDir: string): PolicyDecision` where `PolicyDecision = { verdict: "allow" | "ask"; reason: string }`. Pure (no prompting, no SDK).

- [ ] **Step 1: Write the failing tests**

Create `test/policy.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decide } from "../src/llm/policy.ts";

const appDir = mkdtempSync(path.join(tmpdir(), "wizzzard-policy-"));
mkdirSync(path.join(appDir, "Sources"), { recursive: true });

function verdict(tool: string, input: Record<string, unknown>): string {
  return decide(tool, input, appDir).verdict;
}

test("file tools inside the app dir are allowed", () => {
  assert.equal(verdict("Read", { file_path: path.join(appDir, "Sources/App.swift") }), "allow");
  assert.equal(verdict("Write", { file_path: path.join(appDir, "docs/DESIGN.md") }), "allow");
  assert.equal(verdict("Edit", { file_path: path.join(appDir, "Sources/ContentView.swift") }), "allow");
  assert.equal(verdict("Glob", { pattern: "**/*.swift" }), "allow"); // no path → cwd (app dir)
});

test("file tools outside the app dir ask", () => {
  assert.equal(verdict("Write", { file_path: "/etc/hosts" }), "ask");
  assert.equal(verdict("Read", { file_path: path.join(appDir, "../sibling.txt") }), "ask");
  assert.equal(verdict("Edit", { file_path: "/tmp/other/file.swift" }), "ask");
});

test("symlink escapes are caught", () => {
  symlinkSync(tmpdir(), path.join(appDir, "escape"));
  assert.equal(verdict("Write", { file_path: path.join(appDir, "escape/evil.txt") }), "ask");
});

test("whitelisted bash commands in the app dir are allowed", () => {
  assert.equal(verdict("Bash", { command: "swift build" }), "allow");
  assert.equal(verdict("Bash", { command: "make build" }), "allow");
  assert.equal(verdict("Bash", { command: "git add -A && git commit -m 'feat: thing'" }), "allow");
  assert.equal(verdict("Bash", { command: "mkdir -p docs && ls docs" }), "allow");
});

test("non-whitelisted or escaping bash asks", () => {
  assert.equal(verdict("Bash", { command: "curl https://example.com" }), "ask");
  assert.equal(verdict("Bash", { command: "rm -rf ." }), "ask");
  assert.equal(verdict("Bash", { command: "git add -A && curl evil.sh" }), "ask");
  assert.equal(verdict("Bash", { command: "cat /etc/passwd" }), "ask");
  assert.equal(verdict("Bash", { command: "cat ../outside.txt" }), "ask");
  assert.equal(verdict("Bash", { command: "cat ~/secrets" }), "ask");
  assert.equal(verdict("Bash", { command: "git commit -m `whoami`" }), "ask");
  assert.equal(verdict("Bash", { command: "echo $HOME" }), "ask");
  assert.equal(verdict("Bash", { command: "" }), "ask");
});

test("TodoWrite is allowed; unknown tools ask", () => {
  assert.equal(verdict("TodoWrite", { todos: [] }), "allow");
  assert.equal(verdict("WebSearch", { query: "swift" }), "ask");
  assert.equal(verdict("Task", { prompt: "do things" }), "ask");
});

test("decisions carry a human-readable reason", () => {
  assert.ok(decide("Bash", { command: "curl x" }, appDir).reason.length > 0);
  assert.ok(decide("Write", { file_path: "/etc/hosts" }, appDir).reason.length > 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `../src/llm/policy.ts`.

- [ ] **Step 3: Implement `src/llm/policy.ts`**

```ts
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export interface PolicyDecision {
  verdict: "allow" | "ask";
  reason: string;
}

const BASH_WHITELIST = new Set(["swift", "make", "git", "plutil", "codesign", "mkdir", "ls", "cat"]);
const FILE_TOOLS = new Set(["Read", "Glob", "Grep", "Write", "Edit", "MultiEdit", "NotebookEdit"]);
const PATH_KEYS = ["file_path", "path", "notebook_path"];

export function decide(
  toolName: string,
  input: Record<string, unknown>,
  appDir: string,
): PolicyDecision {
  const root = resolveExisting(appDir);

  if (toolName === "TodoWrite") {
    return { verdict: "allow", reason: "task-list bookkeeping only" };
  }

  if (FILE_TOOLS.has(toolName)) {
    const paths = PATH_KEYS.map((key) => input[key]).filter(
      (value): value is string => typeof value === "string",
    );
    const escaped = paths.find((p) => !isUnder(resolveAgainst(root, p), root));
    if (escaped !== undefined) {
      return { verdict: "ask", reason: `touches a path outside the app directory (${escaped})` };
    }
    return { verdict: "allow", reason: "file operation inside the app directory" };
  }

  if (toolName === "Bash") {
    const command = String(input.command ?? "");
    const problem = bashProblem(command, root);
    if (problem === null) {
      return { verdict: "allow", reason: "whitelisted command inside the app directory" };
    }
    return { verdict: "ask", reason: problem };
  }

  return { verdict: "ask", reason: `tool ${toolName} is not auto-allowed` };
}

/** Returns null when allowed, or a reason string when the command needs confirmation. */
function bashProblem(command: string, root: string): string | null {
  if (!command.trim()) return "empty command";
  if (/[`$]/.test(command)) return "contains shell expansion ($ or backticks)";

  const segments = command
    .split(/&&|\|\||;|\|/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return "empty command";

  for (const segment of segments) {
    const words = segment.split(/\s+/);
    if (!BASH_WHITELIST.has(words[0])) return `\`${words[0]}\` is not in the command whitelist`;
    for (const raw of words.slice(1)) {
      const word = raw.replace(/^['"]|['"]$/g, "");
      if (word.startsWith("~")) return "references the home directory";
      if (path.isAbsolute(word) && !isUnder(resolveExisting(word), root)) {
        return `absolute path outside the app directory (${word})`;
      }
      if (word.includes("..")) {
        const resolved = resolveExisting(path.isAbsolute(word) ? word : path.resolve(root, word));
        if (!isUnder(resolved, root)) return `path escapes the app directory (${word})`;
      }
    }
  }
  return null;
}

/** Resolve to an absolute, symlink-free path even if the leaf doesn't exist yet. */
function resolveExisting(p: string): string {
  let current = path.resolve(p);
  const suffix: string[] = [];
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    suffix.unshift(path.basename(current));
    current = parent;
  }
  try {
    current = realpathSync(current);
  } catch {
    // keep the lexically-resolved path
  }
  return path.join(current, ...suffix);
}

function resolveAgainst(root: string, p: string): string {
  return resolveExisting(path.isAbsolute(p) ? p : path.resolve(root, p));
}

function isUnder(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/llm/policy.ts test/policy.test.ts
git commit -m "feat: pure permission policy for LLM phases"
git push
```

---

### Task 3: Phase prompts + loader + async queue

**Files:**
- Create: `prompts/brainstorm.md`, `prompts/plan.md`, `prompts/implement.md`
- Create: `src/llm/prompts.ts`
- Create: `src/llm/queue.ts`
- Modify: `src/answers.ts` (add `description`)
- Modify: `src/prompts.ts` (collect description — wiring into phases happens in Task 6)
- Modify: `test/generate.test.ts` (fixture gains `description: null`)
- Test: `test/llm-prompts.test.ts`, `test/queue.test.ts`

**Interfaces:**
- Consumes: `Answers` from `src/answers.ts`; `substituteTokens` from `src/generate.ts` (already exported); `deriveModuleName` from `src/names.ts`.
- Produces:
  - `Answers` gains `description: string | null`.
  - `type Phase = "brainstorm" | "plan" | "implement"` and `loadPhasePrompt(phase: Phase, answers: Answers): string` from `src/llm/prompts.ts` — reads `prompts/<phase>.md`, substitutes the single token `__APP_CONTEXT__`, throws on any other token.
  - `class AsyncQueue<T> implements AsyncIterable<T>` with `push(value: T): void` and `end(): void` from `src/llm/queue.ts`.

- [ ] **Step 1: Write the failing tests**

Create `test/queue.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { AsyncQueue } from "../src/llm/queue.ts";

test("delivers pushed values in order and ends", async () => {
  const q = new AsyncQueue<number>();
  q.push(1);
  q.push(2);
  const seen: number[] = [];
  const consumer = (async () => {
    for await (const v of q) seen.push(v);
  })();
  q.push(3);
  q.end();
  await consumer;
  assert.deepEqual(seen, [1, 2, 3]);
});

test("consumer blocks until a value arrives", async () => {
  const q = new AsyncQueue<string>();
  const it = q[Symbol.asyncIterator]();
  const pending = it.next();
  q.push("late");
  assert.deepEqual(await pending, { value: "late", done: false });
  q.end();
  assert.equal((await it.next()).done, true);
});
```

Create `test/llm-prompts.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Answers } from "../src/answers.ts";
import { loadPhasePrompt } from "../src/llm/prompts.ts";

const answers: Answers = {
  appName: "Clipboard Buddy",
  location: "/unused",
  bundleId: "com.jpangelle.clipboard-buddy",
  style: "menubar",
  menuBarUI: "popover",
  launchAtLogin: true,
  description: "keeps clipboard history",
};

for (const phase of ["brainstorm", "plan", "implement"] as const) {
  test(`${phase} prompt loads with app context injected`, () => {
    const prompt = loadPhasePrompt(phase, answers);
    assert.ok(prompt.includes("Clipboard Buddy"), "app name present");
    assert.ok(prompt.includes("keeps clipboard history"), "description present");
    assert.ok(prompt.includes("WIZZZARD_PHASE_DONE"), "done marker present");
    assert.ok(!prompt.includes("__"), "no leftover tokens");
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: new tests FAIL (missing modules). `generate` tests also FAIL typecheck-wise once `description` is added — do Step 3 first, then re-run.

- [ ] **Step 3: Add `description` to `Answers` and the wizard prompt**

In `src/answers.ts` add to the interface (after `launchAtLogin`):

```ts
  description: string | null; // optional app description; enables the AI phases
```

In `src/prompts.ts` (the wizard questions), after the `launchAtLogin` prompt and before the summary:

```ts
  const descriptionInput = guard(
    await p.text({
      message: "Describe your app",
      placeholder: "(optional — Enter to skip; enables AI brainstorm → plan → implement)",
      defaultValue: "",
    }),
  );
  const description = descriptionInput.trim() || null;
```

Add to the summary array (after the launch-at-login line):

```ts
    ...(description ? [`Description:     ${description.length > 60 ? description.slice(0, 57) + "..." : description}`] : []),
```

Change the return to `return { appName, location, bundleId, style, menuBarUI, launchAtLogin, description };`

In `test/generate.test.ts`, add `description: null,` to the `base` fixture object.

- [ ] **Step 4: Write the three prompt files**

`prompts/brainstorm.md`:

````markdown
You are running the **brainstorm phase** for a freshly scaffolded macOS app. Turn the owner's description into a concrete, approved design and write it to docs/DESIGN.md.

## The app you are working in
__APP_CONTEXT__

## How to run the conversation
- Ask exactly ONE question per reply, and nothing else — no preamble, no summaries.
- Prefer multiple-choice questions with a recommended option; keep them short.
- Ask about what the app actually does: key behaviors, data/state, what appears in the UI, edge cases. Do NOT ask about things the scaffold already decides (dock policy, launch at login, settings plumbing, bundle ID).
- 3–6 questions is usually right. Stop when more answers wouldn't change the design.
- Then present a compact design — under 400 words covering purpose, behavior, UI described in words, state/data, error handling — and ask "Approve this design?" as your one question.
- If the owner declines or wants changes, revise and re-present.

## When the design is approved
1. Write the design to docs/DESIGN.md (the same content you presented, as markdown).
2. Reply with exactly: WIZZZARD_PHASE_DONE

Rules: never edit Swift files in this phase; never run git (this project has no git repo); never output WIZZZARD_PHASE_DONE before docs/DESIGN.md is written.
````

`prompts/plan.md`:

````markdown
You are running the **planning phase** for a freshly scaffolded macOS app. Read docs/DESIGN.md and turn it into a step-by-step implementation plan at docs/PLAN.md.

## The app you are working in
__APP_CONTEXT__

## The plan you write
- Numbered, bite-sized tasks. Each task: what to build, exact file paths, how to verify (`swift build`).
- New views/models go under the module's Sources directory; ContentView.swift is the app's main surface.
- SwiftUI, macOS 14+. Prefer zero new dependencies; if the design truly requires one, add it as an SPM package in Package.swift as its own task.
- Include short code sketches for anything non-obvious. YAGNI — no speculative features.
- The final task is always: run `make build` and confirm it passes.

## Deliver
1. Write docs/PLAN.md.
2. Reply with a one-line summary of the plan, then on its own line exactly: WIZZZARD_PHASE_DONE

Rules: never edit Swift files in this phase; never run git (this project has no git repo); never output WIZZZARD_PHASE_DONE before docs/PLAN.md is written.
````

`prompts/implement.md`:

````markdown
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
````

- [ ] **Step 5: Implement `src/llm/queue.ts`**

```ts
export class AsyncQueue<T> implements AsyncIterable<T> {
  private values: T[] = [];
  private resolvers: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  push(value: T): void {
    const resolve = this.resolvers.shift();
    if (resolve) resolve({ value, done: false });
    else this.values.push(value);
  }

  end(): void {
    this.closed = true;
    for (const resolve of this.resolvers.splice(0)) {
      resolve({ value: undefined as never, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.values.length > 0) {
          return Promise.resolve({ value: this.values.shift() as T, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined as never, done: true });
        }
        return new Promise((resolve) => this.resolvers.push(resolve));
      },
    };
  }
}
```

- [ ] **Step 6: Implement `src/llm/prompts.ts`**

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Answers } from "../answers.ts";
import { substituteTokens } from "../generate.ts";
import { deriveModuleName } from "../names.ts";

export type Phase = "brainstorm" | "plan" | "implement";

const STYLE_DESCRIPTIONS = {
  menubar: "menu bar only (no Dock icon)",
  "hide-on-close": "Dock app that hides when its window closes",
  regular: "regular Dock app",
} as const;

export function loadPhasePrompt(phase: Phase, answers: Answers): string {
  const file = fileURLToPath(new URL(`../../prompts/${phase}.md`, import.meta.url));
  const moduleName = deriveModuleName(answers.appName);
  const menuBarNote = answers.menuBarUI ? `, ${answers.menuBarUI} menu bar UI` : "";
  const appContext = [
    `- Name: ${answers.appName} (Swift module ${moduleName})`,
    `- Style: ${STYLE_DESCRIPTIONS[answers.style]}${menuBarNote}`,
    `- Owner's description: ${answers.description ?? "(none given)"}`,
    `- Layout: SwiftUI + Swift Package Manager, no Xcode project. Sources/${moduleName}/ContentView.swift is the main surface for app UI and logic; AppConfig.swift holds scaffold decisions; the Settings window and launch-at-login are pre-wired (SettingsView.swift, LaunchAtLogin.swift).`,
    "- Build commands: `swift build` to compile-check, `make build` to produce the bundle; never `swift run`.",
  ].join("\n");
  return substituteTokens(readFileSync(file, "utf8"), { __APP_CONTEXT__: appContext });
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all PASS (including the updated generate fixture).

- [ ] **Step 8: Commit and push**

```bash
git add prompts src/llm/queue.ts src/llm/prompts.ts src/answers.ts src/prompts.ts test/queue.test.ts test/llm-prompts.test.ts test/generate.test.ts
git commit -m "feat: bundled phase prompts, prompt loader, async queue, describe question"
git push
```

---

### Task 4: SDK session wrapper (`session.ts`)

**Files:**
- Create: `src/llm/session.ts`
- Test: `test/session.test.ts`

**Interfaces:**
- Consumes: `AsyncQueue` (Task 3), `decide` (Task 2), `query` from `@anthropic-ai/claude-agent-sdk`.
- Produces:

```ts
export type QueryFn = typeof query; // fakes cast via `as unknown as QueryFn`

export interface PhaseIO {
  onProgress: (line: string) => void;        // one line per tool use
  onAssistantText: (text: string) => void;   // assistant prose
  askPermission: (summary: string) => Promise<boolean>;
}

export function probeAuth(queryFn?: QueryFn): Promise<boolean>;

export function runInteractivePhase(opts: {
  systemPrompt: string;
  initialMessage: string;
  appDir: string;
  io: PhaseIO;
  askUser: (question: string) => Promise<string>;
  queryFn?: QueryFn;
}): Promise<void>;

export function runAutonomousPhase(opts: {
  systemPrompt: string;
  message: string;
  appDir: string;
  io: PhaseIO;
  queryFn?: QueryFn;
}): Promise<string>; // resolves with the final assistant text; rejects on error result
```

Contract: interactive phase = send `initialMessage`; after each agent turn (`result` message), if the accumulated turn text contains `WIZZZARD_PHASE_DONE` → emit remaining text via `onAssistantText` (marker stripped) and finish; otherwise pass the turn text to `askUser` and send the answer as the next user message. Autonomous phase = one user message, stream progress, resolve at the success `result` (reject on non-success subtypes with the subtype in the error message).

- [ ] **Step 1: Write the failing tests**

Create `test/session.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhaseIO, QueryFn } from "../src/llm/session.ts";
import { probeAuth, runAutonomousPhase, runInteractivePhase } from "../src/llm/session.ts";

interface FakeTurn {
  blocks: Array<{ type: "text"; text: string } | { type: "tool_use"; name: string; input: Record<string, unknown> }>;
  resultSubtype?: string;
}

/** Scripted query fake: consumes one user message per turn, emits the scripted blocks + a result. */
function fakeQuery(turns: FakeTurn[], receivedUserTexts: string[]): QueryFn {
  const impl = (args: { prompt: string | AsyncIterable<{ message: { content: Array<{ text: string }> } }> }) => {
    async function* gen() {
      const iterator =
        typeof args.prompt === "string"
          ? (async function* () {
              yield { message: { content: [{ text: args.prompt as string }] } };
            })()[Symbol.asyncIterator]()
          : args.prompt[Symbol.asyncIterator]();
      for (const turn of turns) {
        const next = await iterator.next();
        if (next.done) return;
        receivedUserTexts.push(next.value.message.content[0].text);
        yield {
          type: "assistant",
          message: { content: turn.blocks },
        };
        yield {
          type: "result",
          subtype: turn.resultSubtype ?? "success",
          result: turn.blocks.map((b) => (b.type === "text" ? b.text : "")).join(""),
        };
      }
    }
    return gen();
  };
  return impl as unknown as QueryFn;
}

const silentIO: PhaseIO = {
  onProgress: () => {},
  onAssistantText: () => {},
  askPermission: async () => true,
};

test("probeAuth resolves true on a success result", async () => {
  const ok = await probeAuth(fakeQuery([{ blocks: [{ type: "text", text: "ok" }] }], []));
  assert.equal(ok, true);
});

test("probeAuth resolves false when the query throws", async () => {
  const throwing = (() => {
    // eslint-disable-next-line require-yield
    async function* gen(): AsyncGenerator<never> {
      throw new Error("not authenticated");
    }
    return gen();
  }) as unknown as QueryFn;
  assert.equal(await probeAuth(throwing), false);
});

test("interactive phase loops Q&A until the done marker", async () => {
  const received: string[] = [];
  const answers = ["it shows unix time", "yes"];
  const askedQuestions: string[] = [];
  await runInteractivePhase({
    systemPrompt: "sys",
    initialMessage: "begin",
    appDir: "/tmp/fake-app",
    io: silentIO,
    askUser: async (q) => {
      askedQuestions.push(q);
      return answers[askedQuestions.length - 1];
    },
    queryFn: fakeQuery(
      [
        { blocks: [{ type: "text", text: "What does the app do?" }] },
        { blocks: [{ type: "text", text: "Approve this design?" }] },
        {
          blocks: [
            { type: "tool_use", name: "Write", input: { file_path: "/tmp/fake-app/docs/DESIGN.md" } },
            { type: "text", text: "Design committed. WIZZZARD_PHASE_DONE" },
          ],
        },
      ],
      received,
    ),
  });
  assert.deepEqual(received, ["begin", "it shows unix time", "yes"]);
  assert.deepEqual(askedQuestions, ["What does the app do?", "Approve this design?"]);
});

test("interactive phase strips the marker from the final text", async () => {
  const finalTexts: string[] = [];
  await runInteractivePhase({
    systemPrompt: "sys",
    initialMessage: "begin",
    appDir: "/tmp/fake-app",
    io: { ...silentIO, onAssistantText: (t) => finalTexts.push(t) },
    askUser: async () => {
      throw new Error("should not ask");
    },
    queryFn: fakeQuery([{ blocks: [{ type: "text", text: "All done here. WIZZZARD_PHASE_DONE" }] }], []),
  });
  assert.deepEqual(finalTexts, ["All done here."]);
});

test("autonomous phase reports tool progress and resolves with final text", async () => {
  const progress: string[] = [];
  const result = await runAutonomousPhase({
    systemPrompt: "sys",
    message: "go",
    appDir: "/tmp/fake-app",
    io: { ...silentIO, onProgress: (line) => progress.push(line) },
    queryFn: fakeQuery(
      [
        {
          blocks: [
            { type: "tool_use", name: "Bash", input: { command: "swift build" } },
            { type: "text", text: "Built everything. WIZZZARD_PHASE_DONE" },
          ],
        },
      ],
      [],
    ),
  });
  assert.equal(progress.length, 1);
  assert.match(progress[0], /swift build/);
  assert.match(result, /Built everything/);
  assert.ok(!result.includes("WIZZZARD_PHASE_DONE"));
});

test("autonomous phase rejects on a non-success result", async () => {
  await assert.rejects(
    runAutonomousPhase({
      systemPrompt: "sys",
      message: "go",
      appDir: "/tmp/fake-app",
      io: silentIO,
      queryFn: fakeQuery([{ blocks: [{ type: "text", text: "ran out" }], resultSubtype: "error_max_turns" }], []),
    }),
    /error_max_turns/,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `../src/llm/session.ts`.

- [ ] **Step 3: Implement `src/llm/session.ts`**

```ts
import { query as defaultQuery } from "@anthropic-ai/claude-agent-sdk";
import { decide } from "./policy.ts";
import { AsyncQueue } from "./queue.ts";

export type QueryFn = typeof defaultQuery;

export interface PhaseIO {
  onProgress: (line: string) => void;
  onAssistantText: (text: string) => void;
  askPermission: (summary: string) => Promise<boolean>;
}

const DONE_MARKER = "WIZZZARD_PHASE_DONE";

interface UserMessage {
  type: "user";
  message: { role: "user"; content: Array<{ type: "text"; text: string }> };
  parent_tool_use_id: null;
}

function userMessage(text: string): UserMessage {
  return {
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
    parent_tool_use_id: null,
  };
}

function describeToolUse(name: string, input: Record<string, unknown>): string {
  if (name === "Bash") return `$ ${String(input.command ?? "").slice(0, 100)}`;
  const target = input.file_path ?? input.path ?? input.notebook_path;
  if (typeof target === "string") return `${name.toLowerCase()} ${target}`;
  return name;
}

function buildOptions(systemPrompt: string, appDir: string, io: PhaseIO) {
  return {
    cwd: appDir,
    systemPrompt: { type: "preset" as const, preset: "claude_code" as const, append: systemPrompt },
    canUseTool: async (toolName: string, input: Record<string, unknown>) => {
      const decision = decide(toolName, input, appDir);
      if (decision.verdict === "allow") {
        return { behavior: "allow" as const, updatedInput: input };
      }
      const approved = await io.askPermission(
        `${describeToolUse(toolName, input)} — ${decision.reason}`,
      );
      return approved
        ? { behavior: "allow" as const, updatedInput: input }
        : { behavior: "deny" as const, message: "The owner declined this action." };
    },
  };
}

export async function probeAuth(queryFn: QueryFn = defaultQuery): Promise<boolean> {
  try {
    const stream = queryFn({
      prompt: "Reply with only: ok",
      options: { maxTurns: 1, allowedTools: [] },
    });
    for await (const message of stream as AsyncIterable<{ type: string; subtype?: string }>) {
      if (message.type === "result") return message.subtype === "success";
    }
    return false;
  } catch {
    return false;
  }
}

interface StreamMessage {
  type: string;
  subtype?: string;
  result?: string;
  message?: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; name: string; input: Record<string, unknown> }
      | { type: string; [key: string]: unknown }
    >;
  };
}

export async function runInteractivePhase(opts: {
  systemPrompt: string;
  initialMessage: string;
  appDir: string;
  io: PhaseIO;
  askUser: (question: string) => Promise<string>;
  queryFn?: QueryFn;
}): Promise<void> {
  const queryFn = opts.queryFn ?? defaultQuery;
  const inputs = new AsyncQueue<UserMessage>();
  inputs.push(userMessage(opts.initialMessage));

  const stream = queryFn({
    prompt: inputs as AsyncIterable<never>,
    options: buildOptions(opts.systemPrompt, opts.appDir, opts.io),
  });

  let turnText = "";
  for await (const raw of stream as AsyncIterable<StreamMessage>) {
    if (raw.type === "assistant" && raw.message) {
      for (const block of raw.message.content) {
        if (block.type === "text") turnText += (block as { text: string }).text;
        else if (block.type === "tool_use") {
          const b = block as { name: string; input: Record<string, unknown> };
          opts.io.onProgress(describeToolUse(b.name, b.input));
        }
      }
    } else if (raw.type === "result") {
      if (turnText.includes(DONE_MARKER)) {
        const finalText = turnText.replace(DONE_MARKER, "").trim();
        if (finalText) opts.io.onAssistantText(finalText);
        inputs.end();
        return;
      }
      const answer = await opts.askUser(turnText.trim());
      turnText = "";
      inputs.push(userMessage(answer));
    }
  }
  inputs.end();
}

export async function runAutonomousPhase(opts: {
  systemPrompt: string;
  message: string;
  appDir: string;
  io: PhaseIO;
  queryFn?: QueryFn;
}): Promise<string> {
  const queryFn = opts.queryFn ?? defaultQuery;
  const inputs = new AsyncQueue<UserMessage>();
  inputs.push(userMessage(opts.message));
  inputs.end();

  const stream = queryFn({
    prompt: inputs as AsyncIterable<never>,
    options: buildOptions(opts.systemPrompt, opts.appDir, opts.io),
  });

  let text = "";
  for await (const raw of stream as AsyncIterable<StreamMessage>) {
    if (raw.type === "assistant" && raw.message) {
      for (const block of raw.message.content) {
        if (block.type === "text") text += (block as { text: string }).text;
        else if (block.type === "tool_use") {
          const b = block as { name: string; input: Record<string, unknown> };
          opts.io.onProgress(describeToolUse(b.name, b.input));
        }
      }
    } else if (raw.type === "result") {
      if (raw.subtype !== "success") {
        throw new Error(`phase ended abnormally: ${raw.subtype}`);
      }
      return text.replace(DONE_MARKER, "").trim();
    }
  }
  return text.replace(DONE_MARKER, "").trim();
}
```

If the installed SDK's types reject any of these shapes (e.g. `SDKUserMessage` requires a `session_id`), adapt minimally (add the field, cast at the boundary) and note it in your report — the tests define the behavioral contract.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/llm/session.ts test/session.test.ts
git commit -m "feat: agent SDK session wrapper with permission hook"
git push
```

---

### Task 5: Real `wizzzard setup`

**Files:**
- Modify: `src/setup.ts` (replace stub body — KEEP the `WIZZZARD_SETUP_STUB` early-exit, Task 1's routing test depends on it)

**Interfaces:**
- Consumes: `probeAuth` from `src/llm/session.ts`.
- Produces: `runSetup(): Promise<void>` — probe → optional `claude /login` handoff → re-probe → report; sets `process.exitCode = 1` on failure paths.

- [ ] **Step 1: Implement `src/setup.ts`**

```ts
import { spawnSync } from "node:child_process";
import * as p from "@clack/prompts";

export async function runSetup(): Promise<void> {
  if (process.env.WIZZZARD_SETUP_STUB === "1") {
    console.error("setup stub");
    process.exit(2);
  }

  const { probeAuth } = await import("./llm/session.ts");

  p.intro("wizzzard setup — connect your Claude account");
  const spin = p.spinner();
  spin.start("Checking for an authenticated Claude account");
  let connected = await probeAuth();
  spin.stop(connected ? "Already connected" : "Not connected yet");

  if (!connected) {
    const hasCli = spawnSync("claude", ["--version"], { stdio: "ignore" }).status === 0;
    if (!hasCli) {
      p.log.error(
        [
          "Claude Code isn't installed, and it handles the account login.",
          "Run:",
          "  npm install -g @anthropic-ai/claude-code",
          "  claude /login",
          "then run `wizzzard setup` again.",
        ].join("\n"),
      );
      p.outro("Setup incomplete");
      process.exitCode = 1;
      return;
    }
    p.log.info("Handing off to Claude Code's login — your browser will open.");
    spawnSync("claude", ["/login"], { stdio: "inherit" });
    spin.start("Re-checking the connection");
    connected = await probeAuth();
    spin.stop(connected ? "Connected" : "Still not connected");
  }

  if (connected) {
    p.outro("Connected to your Claude account ✨");
  } else {
    p.outro("Couldn't verify the connection — try running `claude /login` manually, then `wizzzard setup`.");
    process.exitCode = 1;
  }
}
```

- [ ] **Step 2: Verify offline behavior and suite**

Run: `npm test && npm run typecheck`
Expected: all PASS — in particular `test/cli.test.ts`'s stub-env test still exits 2 without touching the SDK (the dynamic import of `session.ts` happens after the stub check).

- [ ] **Step 3: Live sanity check (this machine is authenticated)**

Run: `node src/index.ts setup`
Expected: intro → spinner → "Already connected" → "Connected to your Claude account ✨", exit 0. Paste the output in your report. (If this machine unexpectedly reports not-connected, do NOT run `claude /login` non-interactively — report DONE_WITH_CONCERNS with the probe output instead.)

- [ ] **Step 4: Commit and push**

```bash
git add src/setup.ts
git commit -m "feat: wizzzard setup — Claude account connection via Claude Code login"
git push
```

---

### Task 6: Phase orchestration in the wizard

**Files:**
- Modify: `src/wizard.ts`

**Interfaces:**
- Consumes: `runPrompts` (now returns `description`), `generate`, `loadPhasePrompt`, `probeAuth`, `runInteractivePhase`, `runAutonomousPhase`, `PhaseIO`.
- Produces: after successful generation, when `answers.description` is non-null, runs the phase flow **in the generated app dir**. All LLM modules are loaded lazily (dynamic import inside the phase path) so a description-less run never loads the SDK.

- [ ] **Step 1: Add the phase flow to `src/wizard.ts`**

Replace the current success path of `runWizard` (the `try` block after `generate`) with:

```ts
  try {
    const targetDir = await generate(answers, answers.location, templateDir);
    const rel = path.relative(process.cwd(), targetDir);
    const cdTarget = rel && !rel.startsWith("..") ? rel : targetDir;

    if (answers.description) {
      await runPhases(answers, targetDir);
    }

    p.note(`cd ${cdTarget}\nmake run`, "Next steps");
    p.outro(`${answers.appName} is ready ✨`);
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
```

Add below `runWizard` (same file):

```ts
async function runPhases(answers: Answers, targetDir: string): Promise<void> {
  const { probeAuth, runAutonomousPhase, runInteractivePhase } = await import("./llm/session.ts");
  const { loadPhasePrompt } = await import("./llm/prompts.ts");

  const spin = p.spinner();
  spin.start("Checking your Claude connection");
  const connected = await probeAuth();
  spin.stop(connected ? "Claude connected" : "Claude not connected");
  if (!connected) {
    p.log.warn("AI phases need a connected Claude account — run `wizzzard setup`. Your app is scaffolded and ready.");
    return;
  }

  const io: PhaseIO = {
    onProgress: (line) => p.log.step(line),
    onAssistantText: (text) => p.log.message(text),
    askPermission: async (summary) => {
      const answer = await p.confirm({ message: `Allow? ${summary}` });
      return !p.isCancel(answer) && answer === true;
    },
  };
  const askUser = async (question: string): Promise<string> => {
    p.log.message(question);
    const answer = await p.text({ message: "Your answer" });
    if (p.isCancel(answer)) {
      p.cancel("Stopping here — your app and any docs written so far are intact.");
      process.exit(0);
    }
    return answer;
  };

  try {
    p.log.info("Brainstorming your app — Claude will ask a few questions");
    await runInteractivePhase({
      systemPrompt: loadPhasePrompt("brainstorm", answers),
      initialMessage: "Begin the brainstorm now. Ask your first question.",
      appDir: targetDir,
      io,
      askUser,
    });
    p.log.success("Design written to docs/DESIGN.md");

    const wantPlan = await p.confirm({ message: "Write the implementation plan?" });
    if (p.isCancel(wantPlan) || !wantPlan) {
      p.log.info("Skipping — continue anytime with Claude Code using docs/DESIGN.md.");
      return;
    }
    await runAutonomousPhase({
      systemPrompt: loadPhasePrompt("plan", answers),
      message: "Read docs/DESIGN.md and write the implementation plan now.",
      appDir: targetDir,
      io,
    });
    p.log.success("Plan written to docs/PLAN.md");

    const wantImplement = await p.confirm({ message: "Implement it now?" });
    if (p.isCancel(wantImplement) || !wantImplement) {
      p.log.info("Skipping — continue anytime with Claude Code using docs/PLAN.md.");
      return;
    }
    const summary = await runAutonomousPhase({
      systemPrompt: loadPhasePrompt("implement", answers),
      message: "Execute docs/PLAN.md now, task by task.",
      appDir: targetDir,
      io,
    });
    if (summary) p.note(summary, "Implementation summary");
  } catch (error) {
    p.log.error(
      `Something went wrong talking to Claude — your app and docs written so far are intact. ` +
        `Continue anytime with Claude Code in ${targetDir}. (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}
```

Add the needed imports at the top of `src/wizard.ts`:

```ts
import type { Answers } from "./answers.ts";
import type { PhaseIO } from "./llm/session.ts";
```

(`import type` keeps the SDK out of the static import graph — verify with Step 2 that a description-less run stays SDK-free.)

- [ ] **Step 2: Verify laziness + suite**

Run: `npm test && npm run typecheck`
Expected: all PASS.
Then confirm the wizard path doesn't statically load the SDK: `node -e "process.argv[2]=undefined" ` is not sufficient — instead run `node --input-type=module -e "await import('./src/wizard.ts'); console.log('loaded without SDK side effects')"` from the repo root.
Expected: prints the message without error (the SDK import only happens inside `runPhases`).

- [ ] **Step 3: Commit and push**

```bash
git add src/wizard.ts
git commit -m "feat: embedded brainstorm/plan/implement phases after scaffolding"
git push
```

---

### Task 7: Docs, packaging check, e2e script

**Files:**
- Modify: `README.md`
- Create: `test/e2e-llm.sh`
- Modify: `package.json` (add `e2e-llm` script)

**Interfaces:**
- Consumes: everything.
- Produces: documented v2 + a manual live-test script.

- [ ] **Step 1: Full automated check + packaging sanity**

Run: `npm run typecheck && npm test && npm run smoke`
Expected: everything green.
Run: `npm pack --dry-run 2>&1 | grep -E "prompts/"`
Expected: `prompts/brainstorm.md`, `prompts/plan.md`, `prompts/implement.md` all listed. If missing, fix `package.json` `files` before proceeding.

- [ ] **Step 2: Write `test/e2e-llm.sh`** (manual live test — costs tokens, needs TTY; never CI)

```bash
#!/usr/bin/env bash
# Manual live test of the AI phases. Run from a real terminal; costs tokens.
set -euo pipefail
cd "$(dirname "$0")/.."

cat <<'EOF'
── wizzzard live LLM test ─────────────────────────────
1. Suggested app name:  Time Peek
2. Suggested description: menu bar app that shows the current unix timestamp,
   click to copy it
3. Answer the brainstorm questions, approve the design,
   accept both gates (plan + implement).
4. PASS criteria: docs/DESIGN.md and docs/PLAN.md written in the
   generated app's docs/, `make build` green, app runs. No git repo created.
───────────────────────────────────────────────────────
EOF

scratch=$(mktemp -d)
echo "Scratch dir: $scratch"
cd "$scratch"
exec node "$OLDPWD/src/index.ts"
```

Add to `package.json` scripts: `"e2e-llm": "bash test/e2e-llm.sh"`.

- [ ] **Step 3: Update `README.md`**

Replace the "What it asks" section's list with the six-question version plus the description question, and add a new section after "What you get":

```markdown
## AI phases (optional)

Connect your Claude account once:

```sh
wizzzard setup
```

This uses Claude Code's own login (`claude /login`) — wizzzard never stores tokens. Then, when the wizard asks **Describe your app**, answering it kicks off, inside your new repo:

1. **Brainstorm** — Claude asks a few questions one at a time, then writes `docs/DESIGN.md`
2. **Plan** (gated) — turns the design into a step-by-step `docs/PLAN.md`
3. **Implement** (gated) — executes the plan task by task, ending with a green `make build`

File edits and build commands inside your new app are auto-allowed; anything else (other paths, other commands, network) asks on-screen first. Skip any gate and pick up later in Claude Code — the docs are plain markdown in your repo.
```

Update the "What it asks" list to:

```markdown
1. App name
2. Where to create it (defaults to the current directory; `~` works)
3. Bundle identifier (defaults to `com.jpangelle.<name>`)
4. App style — menu bar only / Dock app that hides on close / regular Dock app
5. Menu bar UI — SwiftUI popover or plain dropdown menu (menu-bar apps only)
6. Launch at login default
7. Describe your app (optional — enables the AI phases below)
```

Also add to the Development list: `- \`npm run e2e-llm\` — manual live test of the AI phases (needs a connected Claude account; costs tokens; never CI)`

- [ ] **Step 4: Human verification checkpoint**

The live AI flow needs the user: run `npm run e2e-llm` in a real terminal and follow the on-screen pass criteria. This is reported to the user at the end — not performed by an agent.

- [ ] **Step 5: Commit and push**

```bash
git add README.md test/e2e-llm.sh package.json
git commit -m "docs: AI phases documentation and manual live-test script"
git push
```
