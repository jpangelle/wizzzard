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
