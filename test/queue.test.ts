import assert from "node:assert/strict";
import { test } from "node:test";
import { AsyncQueue } from "../src/llm/queue.ts";

test("delivers pushed values in order and ends", async () => {
  const q = new AsyncQueue<number>();
  q.push(1);
  q.push(2);
  const seen: number[] = [];
  const consumer = (async () => {
    for await (const v of q) seen.push(v);
  })();
  q.push(3);
  q.end();
  await consumer;
  assert.deepEqual(seen, [1, 2, 3]);
});

test("consumer blocks until a value arrives", async () => {
  const q = new AsyncQueue<string>();
  const it = q[Symbol.asyncIterator]();
  const pending = it.next();
  q.push("late");
  assert.deepEqual(await pending, { value: "late", done: false });
  q.end();
  assert.equal((await it.next()).done, true);
});
