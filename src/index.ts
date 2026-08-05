#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { generate } from "./generate.ts";
import { runPrompts } from "./prompts.ts";

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 24) {
  console.error(`wizzzard requires Node 24+ (you have ${process.versions.node})`);
  process.exit(1);
}

const templateDir = fileURLToPath(new URL("../template", import.meta.url));

const swiftCheck = spawnSync("swift", ["--version"], { stdio: "ignore" });
if (swiftCheck.error || swiftCheck.status !== 0) {
  p.log.warn("Swift toolchain not found — install with: xcode-select --install (generating anyway)");
}

const answers = await runPrompts();

try {
  const targetDir = await generate(answers, process.cwd(), templateDir);
  const rel = path.relative(process.cwd(), targetDir);
  p.note(`cd ${rel}\nmake run`, "Next steps");
  p.outro(`${answers.appName} is ready ✨`);
} catch (error) {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
