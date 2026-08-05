import path from "node:path";
import * as p from "@clack/prompts";
import type { Answers, AppStyle, MenuBarUI } from "./answers.ts";
import { defaultBundleId, deriveKebabName, isValidBundleId, validateAppName } from "./names.ts";
import { resolveLocation } from "./paths.ts";

function guard<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Cancelled — nothing was written.");
    process.exit(0);
  }
  return value as T;
}

export async function runPrompts(): Promise<Answers> {
  p.intro("wizzzard 🧙 — scaffold a Mac app");

  const appName = guard(
    await p.text({
      message: "App name",
      placeholder: "Clipboard Buddy",
      validate: (value) => validateAppName(value ?? ""),
    }),
  ).trim();

  const location = resolveLocation(
    guard(
      await p.text({
        message: "Where should it be created?",
        placeholder: ". (current directory)",
        defaultValue: ".",
      }),
    ),
  );

  const bundleId = guard(
    await p.text({
      message: "Bundle identifier",
      initialValue: defaultBundleId(appName),
      validate: (value) =>
        isValidBundleId(value ?? "") ? undefined : "Use reverse-DNS form, e.g. com.jpangelle.my-app",
    }),
  );

  const style = guard(
    await p.select({
      message: "App style",
      options: [
        { value: "menubar", label: "Menu bar only", hint: "no Dock icon" },
        { value: "hide-on-close", label: "Dock app that hides when its window closes" },
        { value: "regular", label: "Regular Dock app" },
      ],
    }),
  ) as AppStyle;

  let menuBarUI: MenuBarUI | null = null;
  if (style === "menubar") {
    menuBarUI = guard(
      await p.select({
        message: "Menu bar UI",
        options: [
          { value: "popover", label: "Popover with a SwiftUI view", hint: "recommended" },
          { value: "menu", label: "Plain dropdown menu" },
        ],
      }),
    ) as MenuBarUI;
  }

  const launchAtLogin = guard(
    await p.confirm({
      message: "Launch at login?",
      initialValue: false,
    }),
  );

  const styleLabels: Record<AppStyle, string> = {
    menubar: "Menu bar only (no Dock icon)",
    "hide-on-close": "Dock app, hides on window close",
    regular: "Regular Dock app",
  };
  const summary = [
    `App name:        ${appName}`,
    `Location:        ${path.join(location, deriveKebabName(appName))}`,
    `Bundle ID:       ${bundleId}`,
    `Style:           ${styleLabels[style]}`,
    ...(menuBarUI ? [`Menu bar UI:     ${menuBarUI === "popover" ? "Popover" : "Plain menu"}`] : []),
    `Launch at login: ${launchAtLogin ? "yes" : "no"}`,
  ].join("\n");
  p.note(summary, "Summary");

  const confirmed = guard(await p.confirm({ message: "Create the app?" }));
  if (!confirmed) {
    p.cancel("Cancelled — nothing was written.");
    process.exit(0);
  }

  return { appName, location, bundleId, style, menuBarUI, launchAtLogin };
}
