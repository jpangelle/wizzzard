import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhaseIO, QueryFn } from "../src/llm/session.ts";
import { probeAuth, runAutonomousPhase, runInteractivePhase } from "../src/llm/session.ts";

interface FakeTurn {
  blocks: Array<{ type: "text"; text: string } | { type: "tool_use"; name: string; input: Record<string, unknown> }>;
  resultSubtype?: string;
}

/** Scripted query fake: consumes one user message per turn, emits the scripted blocks + a result. */
function fakeQuery(turns: FakeTurn[], receivedUserTexts: string[]): QueryFn {
  const impl = (args: { prompt: string | AsyncIterable<{ message: { content: Array<{ text: string }> } }> }) => {
    async function* gen() {
      const iterator =
        typeof args.prompt === "string"
          ? (async function* () {
              yield { message: { content: [{ text: args.prompt as string }] } };
            })()[Symbol.asyncIterator]()
          : args.prompt[Symbol.asyncIterator]();
      for (const turn of turns) {
        const next = await iterator.next();
        if (next.done) return;
        receivedUserTexts.push(next.value.message.content[0].text);
        yield {
          type: "assistant",
          message: { content: turn.blocks },
        };
        yield {
          type: "result",
          subtype: turn.resultSubtype ?? "success",
          result: turn.blocks.map((b) => (b.type === "text" ? b.text : "")).join(""),
        };
      }
    }
    return gen();
  };
  return impl as unknown as QueryFn;
}

const silentIO: PhaseIO = {
  onProgress: () => {},
  onAssistantText: () => {},
  askPermission: async () => true,
};

test("probeAuth resolves true on a success result", async () => {
  const ok = await probeAuth(fakeQuery([{ blocks: [{ type: "text", text: "ok" }] }], []));
  assert.equal(ok, true);
});

test("probeAuth resolves false when the query throws", async () => {
  const throwing = (() => {
    // eslint-disable-next-line require-yield
    async function* gen(): AsyncGenerator<never> {
      throw new Error("not authenticated");
    }
    return gen();
  }) as unknown as QueryFn;
  assert.equal(await probeAuth(throwing), false);
});

test("interactive phase loops Q&A until the done marker", async () => {
  const received: string[] = [];
  const answers = ["it shows unix time", "yes"];
  const askedQuestions: string[] = [];
  await runInteractivePhase({
    systemPrompt: "sys",
    initialMessage: "begin",
    appDir: "/tmp/fake-app",
    io: silentIO,
    askUser: async (q) => {
      askedQuestions.push(q);
      return answers[askedQuestions.length - 1];
    },
    queryFn: fakeQuery(
      [
        { blocks: [{ type: "text", text: "What does the app do?" }] },
        { blocks: [{ type: "text", text: "Approve this design?" }] },
        {
          blocks: [
            { type: "tool_use", name: "Write", input: { file_path: "/tmp/fake-app/docs/DESIGN.md" } },
            { type: "text", text: "Design committed. WIZZZARD_PHASE_DONE" },
          ],
        },
      ],
      received,
    ),
  });
  assert.deepEqual(received, ["begin", "it shows unix time", "yes"]);
  assert.deepEqual(askedQuestions, ["What does the app do?", "Approve this design?"]);
});

test("interactive phase strips the marker from the final text", async () => {
  const finalTexts: string[] = [];
  await runInteractivePhase({
    systemPrompt: "sys",
    initialMessage: "begin",
    appDir: "/tmp/fake-app",
    io: { ...silentIO, onAssistantText: (t) => finalTexts.push(t) },
    askUser: async () => {
      throw new Error("should not ask");
    },
    queryFn: fakeQuery([{ blocks: [{ type: "text", text: "All done here. WIZZZARD_PHASE_DONE" }] }], []),
  });
  assert.deepEqual(finalTexts, ["All done here."]);
});

test("interactive phase rejects on a non-success result", async () => {
  await assert.rejects(
    runInteractivePhase({
      systemPrompt: "sys",
      initialMessage: "begin",
      appDir: "/tmp/fake-app",
      io: silentIO,
      askUser: async () => {
        throw new Error("should not ask");
      },
      queryFn: fakeQuery([{ blocks: [{ type: "text", text: "ran out" }], resultSubtype: "error_max_turns" }], []),
    }),
    /error_max_turns/,
  );
});

test("autonomous phase reports tool progress and resolves with final text", async () => {
  const progress: string[] = [];
  const result = await runAutonomousPhase({
    systemPrompt: "sys",
    message: "go",
    appDir: "/tmp/fake-app",
    io: { ...silentIO, onProgress: (line) => progress.push(line) },
    queryFn: fakeQuery(
      [
        {
          blocks: [
            { type: "tool_use", name: "Bash", input: { command: "swift build" } },
            { type: "text", text: "Built everything. WIZZZARD_PHASE_DONE" },
          ],
        },
      ],
      [],
    ),
  });
  assert.equal(progress.length, 1);
  assert.match(progress[0], /swift build/);
  assert.match(result, /Built everything/);
  assert.ok(!result.includes("WIZZZARD_PHASE_DONE"));
});

test("autonomous phase rejects on a non-success result", async () => {
  await assert.rejects(
    runAutonomousPhase({
      systemPrompt: "sys",
      message: "go",
      appDir: "/tmp/fake-app",
      io: silentIO,
      queryFn: fakeQuery([{ blocks: [{ type: "text", text: "ran out" }], resultSubtype: "error_max_turns" }], []),
    }),
    /error_max_turns/,
  );
});
