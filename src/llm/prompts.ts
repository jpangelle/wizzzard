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
