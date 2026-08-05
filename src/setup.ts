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
