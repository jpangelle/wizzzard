import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Answers } from "./answers.ts";
import { deriveKebabName, deriveModuleName } from "./names.ts";

const BINARY_EXTENSIONS = new Set([".icns", ".png"]);
// npm mangles packaged .gitignore files, so the template stores it undotted.
const RENAMES = new Map([["gitignore", ".gitignore"]]);
const VARIANT_RE = /^(.+)\.(menubar|windowed|popover|menu)$/;

interface PlannedFile {
  relPath: string;
  contents: Buffer;
}

export async function generate(
  answers: Answers,
  parentDir: string,
  templateDir: string,
): Promise<string> {
  const moduleName = deriveModuleName(answers.appName);
  const kebabName = deriveKebabName(answers.appName);
  const targetDir = path.join(parentDir, kebabName);

  const dockPolicy = {
    menubar: "menuBarOnly",
    "hide-on-close": "hideOnClose",
    regular: "regular",
  }[answers.style];

  const tokens: Record<string, string> = {
    __APP_NAME__: answers.appName,
    __MODULE_NAME__: moduleName,
    __KEBAB_NAME__: kebabName,
    __BUNDLE_ID__: answers.bundleId,
    __DOCK_POLICY__: dockPolicy,
    __LAUNCH_AT_LOGIN_DEFAULT__: String(answers.launchAtLogin),
    __LS_UI_ELEMENT__: answers.style === "menubar" ? "true" : "false",
  };

  const variants = new Set<string>(
    answers.style === "menubar" ? ["menubar", answers.menuBarUI ?? "popover"] : ["windowed"],
  );

  // Plan everything in memory first so failures write nothing.
  const plan = await planFiles(templateDir, "", tokens, variants);
  await assertTargetUsable(targetDir);

  for (const file of plan) {
    const dest = path.join(targetDir, file.relPath);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, file.contents);
  }

  return targetDir;
}

export function substituteTokens(input: string, tokens: Record<string, string>): string {
  return input.replace(/__[A-Z_]+?__/g, (match) => {
    const value = tokens[match];
    if (value === undefined) {
      throw new Error(`Unknown template token ${match}`);
    }
    return value;
  });
}

async function planFiles(
  dir: string,
  relBase: string,
  tokens: Record<string, string>,
  variants: Set<string>,
): Promise<PlannedFile[]> {
  const out: PlannedFile[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    let name = entry.name;

    if (!entry.isDirectory()) {
      const variantMatch = name.match(VARIANT_RE);
      if (variantMatch) {
        if (!variants.has(variantMatch[2])) continue;
        name = variantMatch[1];
      }
    }
    name = RENAMES.get(name) ?? name;
    name = substituteTokens(name, tokens);
    const rel = relBase ? path.join(relBase, name) : name;

    if (entry.isDirectory()) {
      out.push(...(await planFiles(abs, rel, tokens, variants)));
    } else if (BINARY_EXTENSIONS.has(path.extname(name))) {
      out.push({ relPath: rel, contents: await readFile(abs) });
    } else {
      const text = substituteTokens(await readFile(abs, "utf8"), tokens);
      out.push({ relPath: rel, contents: Buffer.from(text) });
    }
  }
  return out;
}

async function assertTargetUsable(targetDir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(targetDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (entries.length > 0) {
    throw new Error(`Target directory ${targetDir} already exists and is not empty`);
  }
}
