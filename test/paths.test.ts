import assert from "node:assert/strict";
import { test } from "node:test";
import { homedir } from "node:os";
import path from "node:path";
import { resolveLocation } from "../src/paths.ts";

test("resolveLocation expands ~ to the home directory", () => {
  assert.equal(resolveLocation("~"), homedir());
  assert.equal(resolveLocation("~/projects"), path.join(homedir(), "projects"));
});

test("resolveLocation resolves relative paths against cwd", () => {
  assert.equal(resolveLocation("."), process.cwd());
  assert.equal(resolveLocation("apps"), path.resolve(process.cwd(), "apps"));
});

test("resolveLocation leaves absolute paths alone", () => {
  assert.equal(resolveLocation("/tmp/projects"), path.resolve("/tmp/projects"));
});

test("resolveLocation treats empty or blank input as cwd", () => {
  assert.equal(resolveLocation(""), process.cwd());
  assert.equal(resolveLocation("   "), process.cwd());
});

test("resolveLocation does not expand ~ mid-path", () => {
  assert.equal(resolveLocation("foo/~/bar"), path.resolve(process.cwd(), "foo/~/bar"));
});
