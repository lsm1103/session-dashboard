import test from "node:test";
import assert from "node:assert/strict";

import {
  getRefreshTargets,
  isRealtimeEvent,
  parseRealtimeEvent,
} from "../lib/ws-events.ts";

test("parseRealtimeEvent parses known realtime events", () => {
  const raw = JSON.stringify({
    type: "session_dirty",
    sessionId: "cc-123",
  });

  const event = parseRealtimeEvent(raw);

  assert.deepEqual(event, {
    type: "session_dirty",
    sessionId: "cc-123",
  });
});

test("parseRealtimeEvent rejects malformed payloads", () => {
  assert.equal(parseRealtimeEvent("{"), null);
  assert.equal(parseRealtimeEvent(JSON.stringify({ type: "unknown" })), null);
  assert.equal(parseRealtimeEvent(JSON.stringify({ type: "session_dirty" })), null);
});

test("isRealtimeEvent recognizes valid event objects", () => {
  assert.equal(isRealtimeEvent({ type: "projects_dirty" }), true);
  assert.equal(isRealtimeEvent({ type: "scan_progress", scope: "projects", completed: 1 }), true);
  assert.equal(isRealtimeEvent({ type: "scan_progress", scope: "invalid", completed: 1 }), false);
});

test("getRefreshTargets maps dirty events to refresh targets", () => {
  assert.deepEqual(getRefreshTargets({ type: "projects_dirty" }), ["projects"]);
  assert.deepEqual(getRefreshTargets({
    type: "sessions_dirty",
    projectId: "project-1",
  }), ["projects", "project-sessions:project-1"]);
  assert.deepEqual(getRefreshTargets({
    type: "session_dirty",
    sessionId: "cc-123",
  }), ["session:cc-123", "session-messages:cc-123"]);
  assert.deepEqual(getRefreshTargets({ type: "connected" }), []);
});
