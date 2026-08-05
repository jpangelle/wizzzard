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
