import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSessionDetailRows,
  findMessageRowIndex,
} from "../lib/session-detail-rows.ts";

const messages = [
  {
    id: "m-1",
    role: "user" as const,
    content: "hello",
    timestamp: new Date("2026-03-01T09:00:00.000Z"),
  },
  {
    id: "m-2",
    role: "assistant" as const,
    content: "world",
    timestamp: new Date("2026-03-01T10:00:00.000Z"),
  },
  {
    id: "m-3",
    role: "user" as const,
    content: "next day",
    timestamp: new Date("2026-03-02T09:00:00.000Z"),
  },
];

test("buildSessionDetailRows inserts date rows when the day changes", () => {
  const rows = buildSessionDetailRows(messages);

  assert.equal(rows.length, 5);
  assert.equal(rows[0]?.type, "date");
  assert.equal(rows[1]?.type, "message");
  assert.equal(rows[2]?.type, "message");
  assert.equal(rows[3]?.type, "date");
  assert.equal(rows[4]?.type, "message");
});

test("buildSessionDetailRows preserves message ordering", () => {
  const rows = buildSessionDetailRows(messages)
    .filter(row => row.type === "message")
    .map(row => row.message.id);

  assert.deepEqual(rows, ["m-1", "m-2", "m-3"]);
});

test("findMessageRowIndex returns the flattened row index for a message", () => {
  const rows = buildSessionDetailRows(messages);

  assert.equal(findMessageRowIndex(rows, "m-1"), 1);
  assert.equal(findMessageRowIndex(rows, "m-3"), 4);
  assert.equal(findMessageRowIndex(rows, "missing"), -1);
});
