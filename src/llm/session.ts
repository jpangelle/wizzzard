import { query as defaultQuery } from "@anthropic-ai/claude-agent-sdk";
import { decide } from "./policy.ts";
import { AsyncQueue } from "./queue.ts";

export type QueryFn = typeof defaultQuery;

export interface PhaseIO {
  onProgress: (line: string) => void;
  onAssistantText: (text: string) => void;
  askPermission: (summary: string) => Promise<boolean>;
}

const DONE_MARKER = "WIZZZARD_PHASE_DONE";

interface UserMessage {
  type: "user";
  message: { role: "user"; content: Array<{ type: "text"; text: string }> };
  parent_tool_use_id: null;
}

function userMessage(text: string): UserMessage {
  return {
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
    parent_tool_use_id: null,
  };
}

function describeToolUse(name: string, input: Record<string, unknown>): string {
  if (name === "Bash") return `$ ${String(input.command ?? "").slice(0, 100)}`;
  const target = input.file_path ?? input.path ?? input.notebook_path;
  if (typeof target === "string") return `${name.toLowerCase()} ${target}`;
  return name;
}

function buildOptions(systemPrompt: string, appDir: string, io: PhaseIO) {
  return {
    cwd: appDir,
    systemPrompt: { type: "preset" as const, preset: "claude_code" as const, append: systemPrompt },
    canUseTool: async (toolName: string, input: Record<string, unknown>) => {
      const decision = decide(toolName, input, appDir);
      if (decision.verdict === "allow") {
        return { behavior: "allow" as const, updatedInput: input };
      }
      const approved = await io.askPermission(
        `${describeToolUse(toolName, input)} — ${decision.reason}`,
      );
      return approved
        ? { behavior: "allow" as const, updatedInput: input }
        : { behavior: "deny" as const, message: "The owner declined this action." };
    },
  };
}

export async function probeAuth(queryFn: QueryFn = defaultQuery): Promise<boolean> {
  try {
    const stream = queryFn({
      prompt: "Reply with only: ok",
      options: { maxTurns: 1, allowedTools: [] },
    });
    for await (const message of stream as AsyncIterable<{ type: string; subtype?: string }>) {
      if (message.type === "result") return message.subtype === "success";
    }
    return false;
  } catch {
    return false;
  }
}

interface StreamMessage {
  type: string;
  subtype?: string;
  result?: string;
  message?: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; name: string; input: Record<string, unknown> }
      | { type: string; [key: string]: unknown }
    >;
  };
}

export async function runInteractivePhase(opts: {
  systemPrompt: string;
  initialMessage: string;
  appDir: string;
  io: PhaseIO;
  askUser: (question: string) => Promise<string>;
  queryFn?: QueryFn;
}): Promise<void> {
  const queryFn = opts.queryFn ?? defaultQuery;
  const inputs = new AsyncQueue<UserMessage>();
  inputs.push(userMessage(opts.initialMessage));

  const stream = queryFn({
    prompt: inputs as AsyncIterable<never>,
    options: buildOptions(opts.systemPrompt, opts.appDir, opts.io),
  });

  let turnText = "";
  for await (const raw of stream as AsyncIterable<StreamMessage>) {
    if (raw.type === "assistant" && raw.message) {
      for (const block of raw.message.content) {
        if (block.type === "text") turnText += (block as { text: string }).text;
        else if (block.type === "tool_use") {
          const b = block as { name: string; input: Record<string, unknown> };
          opts.io.onProgress(describeToolUse(b.name, b.input));
        }
      }
    } else if (raw.type === "result") {
      if (turnText.includes(DONE_MARKER)) {
        const finalText = turnText.replace(DONE_MARKER, "").trim();
        if (finalText) opts.io.onAssistantText(finalText);
        inputs.end();
        return;
      }
      const answer = await opts.askUser(turnText.trim());
      turnText = "";
      inputs.push(userMessage(answer));
    }
  }
  inputs.end();
}

export async function runAutonomousPhase(opts: {
  systemPrompt: string;
  message: string;
  appDir: string;
  io: PhaseIO;
  queryFn?: QueryFn;
}): Promise<string> {
  const queryFn = opts.queryFn ?? defaultQuery;
  const inputs = new AsyncQueue<UserMessage>();
  inputs.push(userMessage(opts.message));
  inputs.end();

  const stream = queryFn({
    prompt: inputs as AsyncIterable<never>,
    options: buildOptions(opts.systemPrompt, opts.appDir, opts.io),
  });

  let text = "";
  for await (const raw of stream as AsyncIterable<StreamMessage>) {
    if (raw.type === "assistant" && raw.message) {
      for (const block of raw.message.content) {
        if (block.type === "text") text += (block as { text: string }).text;
        else if (block.type === "tool_use") {
          const b = block as { name: string; input: Record<string, unknown> };
          opts.io.onProgress(describeToolUse(b.name, b.input));
        }
      }
    } else if (raw.type === "result") {
      if (raw.subtype !== "success") {
        throw new Error(`phase ended abnormally: ${raw.subtype}`);
      }
      return text.replace(DONE_MARKER, "").trim();
    }
  }
  return text.replace(DONE_MARKER, "").trim();
}
