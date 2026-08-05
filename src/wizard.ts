import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import type { Answers } from "./answers.ts";
import { generate } from "./generate.ts";
import type { PhaseIO } from "./llm/session.ts";
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

    if (answers.description) {
      await runPhases(answers, targetDir);
    }

    p.note(`cd ${cdTarget}\nmake run`, "Next steps");
    p.outro(`${answers.appName} is ready ✨`);
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function runPhases(answers: Answers, targetDir: string): Promise<void> {
  const spin = p.spinner();
  try {
    const { probeAuth, runAutonomousPhase, runInteractivePhase } = await import("./llm/session.ts");
    const { loadPhasePrompt } = await import("./llm/prompts.ts");

    spin.start("Checking your Claude connection");
    const connected = await probeAuth();
    spin.stop(connected ? "Claude connected" : "Claude not connected");
    if (!connected) {
      p.log.warn(
        "AI phases need a connected Claude account — run `wizzzard setup`. Your app is scaffolded and ready.",
      );
      return;
    }

    const io: PhaseIO = {
      onProgress: (line) => p.log.step(line),
      onAssistantText: (text) => p.log.message(text),
      askPermission: async (summary) => {
        const answer = await p.confirm({ message: `Allow? ${summary}`, initialValue: false });
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
    spin.stop();
    p.log.error(
      `Something went wrong talking to Claude — your app and docs written so far are intact. ` +
        `Continue anytime with Claude Code in ${targetDir}. (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}
