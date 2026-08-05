import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export interface PolicyDecision {
  verdict: "allow" | "ask";
  reason: string;
}

const BASH_WHITELIST = new Set(["swift", "make", "git", "plutil", "codesign", "mkdir", "ls", "cat"]);
const FILE_TOOLS = new Set(["Read", "Glob", "Grep", "Write", "Edit", "MultiEdit", "NotebookEdit"]);
const PATH_KEYS = ["file_path", "path", "notebook_path"];

export function decide(
  toolName: string,
  input: Record<string, unknown>,
  appDir: string,
): PolicyDecision {
  const root = resolveExisting(appDir);

  if (toolName === "TodoWrite") {
    return { verdict: "allow", reason: "task-list bookkeeping only" };
  }

  if (FILE_TOOLS.has(toolName)) {
    const paths = PATH_KEYS.map((key) => input[key]).filter(
      (value): value is string => typeof value === "string",
    );
    const escaped = paths.find((p) => !isUnder(resolveAgainst(root, p), root));
    if (escaped !== undefined) {
      return { verdict: "ask", reason: `touches a path outside the app directory (${escaped})` };
    }
    return { verdict: "allow", reason: "file operation inside the app directory" };
  }

  if (toolName === "Bash") {
    const command = String(input.command ?? "");
    const problem = bashProblem(command, root);
    if (problem === null) {
      return { verdict: "allow", reason: "whitelisted command inside the app directory" };
    }
    return { verdict: "ask", reason: problem };
  }

  return { verdict: "ask", reason: `tool ${toolName} is not auto-allowed` };
}

/** Returns null when allowed, or a reason string when the command needs confirmation. */
function bashProblem(command: string, root: string): string | null {
  if (!command.trim()) return "empty command";
  if (/[`$]/.test(command)) return "contains shell expansion ($ or backticks)";
  if (/<\(|>\(/.test(command)) return "contains process substitution";

  const segments = command
    .split(/[;|&\n\r]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return "empty command";

  for (const segment of segments) {
    const words = segment.split(/\s+/);
    if (!BASH_WHITELIST.has(words[0])) return `\`${words[0]}\` is not in the command whitelist`;
    for (const raw of words.slice(1)) {
      const word = raw.replace(/^['"]|['"]$/g, "");
      if (word.startsWith("~")) return "references the home directory";
      if (path.isAbsolute(word) && !isUnder(resolveExisting(word), root)) {
        return `absolute path outside the app directory (${word})`;
      }
      if (word.includes("..")) {
        const resolved = resolveExisting(path.isAbsolute(word) ? word : path.resolve(root, word));
        if (!isUnder(resolved, root)) return `path escapes the app directory (${word})`;
      }
    }
  }
  return null;
}

/** Resolve to an absolute, symlink-free path even if the leaf doesn't exist yet. */
function resolveExisting(p: string): string {
  let current = path.resolve(p);
  const suffix: string[] = [];
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    suffix.unshift(path.basename(current));
    current = parent;
  }
  try {
    current = realpathSync(current);
  } catch {
    // keep the lexically-resolved path
  }
  return path.join(current, ...suffix);
}

function resolveAgainst(root: string, p: string): string {
  return resolveExisting(path.isAbsolute(p) ? p : path.resolve(root, p));
}

function isUnder(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
