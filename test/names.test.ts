import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultBundleId,
  deriveKebabName,
  deriveModuleName,
  isValidBundleId,
  validateAppName,
} from "../src/names.ts";

test("deriveModuleName turns display names into PascalCase", () => {
  assert.equal(deriveModuleName("Clipboard Buddy"), "ClipboardBuddy");
  assert.equal(deriveModuleName("clip2go now"), "Clip2goNow");
  assert.equal(deriveModuleName("Wi-Fi Watcher"), "WiFiWatcher");
});

test("deriveModuleName strips emoji and punctuation", () => {
  assert.equal(deriveModuleName("🧙 Wizard!!"), "Wizard");
});

test("deriveKebabName lowercases and hyphenates", () => {
  assert.equal(deriveKebabName("Clipboard Buddy"), "clipboard-buddy");
  assert.equal(deriveKebabName("  Wi-Fi   Watcher "), "wi-fi-watcher");
});

test("defaultBundleId uses com.jpangelle prefix", () => {
  assert.equal(defaultBundleId("Clipboard Buddy"), "com.jpangelle.clipboard-buddy");
});

test("validateAppName rejects empty, digit-leading, and symbol-only names", () => {
  assert.ok(validateAppName(""));
  assert.ok(validateAppName("   "));
  assert.ok(validateAppName("2Do"));
  assert.ok(validateAppName("!!!"));
  assert.equal(validateAppName("Clipboard Buddy"), undefined);
});

test("isValidBundleId requires reverse-DNS shape", () => {
  assert.ok(isValidBundleId("com.jpangelle.clipboard-buddy"));
  assert.ok(!isValidBundleId("no-dots"));
  assert.ok(!isValidBundleId("has spaces.com"));
  assert.ok(!isValidBundleId(""));
});
