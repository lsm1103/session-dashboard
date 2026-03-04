const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findAvailablePort,
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

test("findAvailablePort keeps the requested port when it is free", async () => {
  const port = await findAvailablePort(3000, {
    maxAttempts: 3,
    isPortAvailable: async (candidate) => candidate === 3000,
  });

  assert.equal(port, 3000);
});

test("findAvailablePort increments until it finds a free port", async () => {
  const checked = [];
  const port = await findAvailablePort(3000, {
    maxAttempts: 4,
    isPortAvailable: async (candidate) => {
      checked.push(candidate);
      return candidate === 3002;
    },
  });

  assert.equal(port, 3002);
  assert.deepEqual(checked, [3000, 3001, 3002]);
});

test("findAvailablePort fails after exhausting the probe window", async () => {
  await assert.rejects(
    () => findAvailablePort(3000, {
      maxAttempts: 2,
      isPortAvailable: async () => false,
    }),
    /Could not find an available port/
  );
});
