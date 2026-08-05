import { homedir } from "node:os";
import path from "node:path";

/** Resolve user-entered location input to an absolute directory path. */
export function resolveLocation(input: string): string {
  const trimmed = input.trim() || ".";
  const expanded =
    trimmed === "~"
      ? homedir()
      : trimmed.startsWith("~/")
        ? path.join(homedir(), trimmed.slice(2))
        : trimmed;
  return path.resolve(expanded);
}
