const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isRealtimeUpgradePath,
  parseServerArgs,
} = require("../scripts/session-dashboard-server.cjs");

test("defaults the custom server to dev mode", () => {
  assert.deepEqual(parseServerArgs([]), {
    mode: "dev",
    nextArgs: [],
  });
});

test("preserves explicit start mode and forwarded args", () => {
  assert.deepEqual(parseServerArgs(["start", "--port", "4100"]), {
    mode: "start",
    nextArgs: ["--port", "4100"],
  });
});

test("treats /api/realtime as a WebSocket upgrade path", () => {
  assert.equal(isRealtimeUpgradePath("/api/realtime"), true);
  assert.equal(isRealtimeUpgradePath("/api/realtime?from=test"), true);
  assert.equal(isRealtimeUpgradePath("/api/watch"), false);
});
