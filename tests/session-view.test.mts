import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MESSAGE_CHUNK_SIZE,
  getInitialVisibleMessageCount,
  getNextVisibleMessageCount,
  getVisibleMessages,
} from "../lib/session-view.ts";

test("getInitialVisibleMessageCount caps the first render to the chunk size", () => {
  assert.equal(getInitialVisibleMessageCount(50), 50);
  assert.equal(getInitialVisibleMessageCount(DEFAULT_MESSAGE_CHUNK_SIZE + 20), DEFAULT_MESSAGE_CHUNK_SIZE);
});

test("getNextVisibleMessageCount loads one more chunk without exceeding total", () => {
  assert.equal(getNextVisibleMessageCount(200, 450), 400);
  assert.equal(getNextVisibleMessageCount(400, 450), 450);
});

test("getVisibleMessages returns the most recent slice", () => {
  const messages = Array.from({ length: 6 }, (_, index) => index + 1);
  assert.deepEqual(getVisibleMessages(messages, 3), [4, 5, 6]);
  assert.deepEqual(getVisibleMessages(messages, 10), [1, 2, 3, 4, 5, 6]);
});
