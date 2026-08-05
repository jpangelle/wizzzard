import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src/generate.ts";
import type { Answers } from "../src/answers.ts";

const templateDir = fileURLToPath(new URL("../template", import.meta.url));

const base: Answers = {
  appName: "Clipboard Buddy",
  location: "/unused-by-generate", // generate() takes parentDir as a parameter
  bundleId: "com.jpangelle.clipboard-buddy",
  style: "menubar",
  menuBarUI: "popover",
  launchAtLogin: true,
};

async function generateInTmp(answers: Answers): Promise<string> {
  const parent = await mkdtemp(path.join(tmpdir(), "wizzzard-test-"));
  return generate(answers, parent, templateDir, { git: false });
}

async function listFiles(dir: string, rel = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listFiles(path.join(dir, entry.name), relPath)));
    } else {
      out.push(relPath);
    }
  }
  return out;
}

test("menubar+popover app has expected files with tokens substituted", async () => {
  const dir = await generateInTmp(base);
  const files = await listFiles(dir);

  assert.ok(files.includes("Package.swift"));
  assert.ok(files.includes("Makefile"));
  assert.ok(files.includes(".gitignore"), "template gitignore must be renamed to .gitignore");
  assert.ok(files.includes("Resources/AppIcon.icns"));
  assert.ok(files.includes("Sources/ClipboardBuddy/App.swift"));
  assert.ok(files.includes("Sources/ClipboardBuddy/MenuBar.swift"));
  assert.ok(!files.some((f) => path.basename(f).match(/\.(menubar|windowed|popover|menu)$/)),
    "no variant-suffixed files may leak into output");

  for (const file of files) {
    if (path.extname(file) === ".icns") continue;
    const text = await readFile(path.join(dir, file), "utf8");
    assert.ok(!text.includes("__"), `leftover token in ${file}`);
  }

  const config = await readFile(path.join(dir, "Sources/ClipboardBuddy/AppConfig.swift"), "utf8");
  assert.match(config, /appName = "Clipboard Buddy"/);
  assert.match(config, /dockPolicy: DockPolicy = \.menuBarOnly/);
  assert.match(config, /launchAtLoginDefault = true/);

  const plist = await readFile(path.join(dir, "Resources/Info.plist"), "utf8");
  assert.match(plist, /<key>LSUIElement<\/key>\s*<true\/>/);
  assert.match(plist, /<string>com\.jpangelle\.clipboard-buddy<\/string>/);

  const menuBar = await readFile(path.join(dir, "Sources/ClipboardBuddy/MenuBar.swift"), "utf8");
  assert.match(menuBar, /menuBarExtraStyle\(\.window\)/);
});

test("menu variant picks the .menu MenuBar", async () => {
  const dir = await generateInTmp({ ...base, menuBarUI: "menu" });
  const menuBar = await readFile(path.join(dir, "Sources/ClipboardBuddy/MenuBar.swift"), "utf8");
  assert.match(menuBar, /menuBarExtraStyle\(\.menu\)/);
});

test("regular style omits MenuBar.swift, uses WindowGroup, LSUIElement false", async () => {
  const dir = await generateInTmp({ ...base, style: "regular", menuBarUI: null, launchAtLogin: false });
  const files = await listFiles(dir);
  assert.ok(!files.includes("Sources/ClipboardBuddy/MenuBar.swift"));
  const app = await readFile(path.join(dir, "Sources/ClipboardBuddy/App.swift"), "utf8");
  assert.match(app, /WindowGroup/);
  const plist = await readFile(path.join(dir, "Resources/Info.plist"), "utf8");
  assert.match(plist, /<key>LSUIElement<\/key>\s*<false\/>/);
  const config = await readFile(path.join(dir, "Sources/ClipboardBuddy/AppConfig.swift"), "utf8");
  assert.match(config, /dockPolicy: DockPolicy = \.regular/);
});

test("hide-on-close style maps to .hideOnClose", async () => {
  const dir = await generateInTmp({ ...base, style: "hide-on-close", menuBarUI: null });
  const config = await readFile(path.join(dir, "Sources/ClipboardBuddy/AppConfig.swift"), "utf8");
  assert.match(config, /dockPolicy: DockPolicy = \.hideOnClose/);
});

test("icns is copied byte-identical (no token substitution on binaries)", async () => {
  const dir = await generateInTmp(base);
  const original = await readFile(path.join(templateDir, "Resources/AppIcon.icns"));
  const copied = await readFile(path.join(dir, "Resources/AppIcon.icns"));
  assert.ok(original.equals(copied));
});

test("refuses a non-empty target directory and writes nothing", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "wizzzard-test-"));
  const target = path.join(parent, "clipboard-buddy");
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, "existing.txt"), "hi");
  await assert.rejects(() => generate(base, parent, templateDir, { git: false }), /not empty/);
  assert.deepEqual(await readdir(target), ["existing.txt"]);
});

test("git option creates a repo with an initial commit", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "wizzzard-test-"));
  const dir = await generate(base, parent, templateDir, { git: true });
  const files = await readdir(dir);
  assert.ok(files.includes(".git"));
});
