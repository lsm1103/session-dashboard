const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { buildNextArgs, run } = require("../scripts/session-dashboard-cli.cjs");

test("defaults to next dev when no production build output is present", () => {
  assert.deepEqual(buildNextArgs([]), ["dev"]);
});

test("prepends dev when only flags are provided", () => {
  assert.deepEqual(buildNextArgs(["--port", "4000"]), ["dev", "--port", "4000"]);
});

test("preserves explicit next subcommands", () => {
  assert.deepEqual(buildNextArgs(["build"]), ["build"]);
  assert.deepEqual(buildNextArgs(["start", "--port", "4000"]), ["start", "--port", "4000"]);
});

function createSpawnCapture() {
  const calls = [];

  return {
    calls,
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });

      return {
        on() {
          return this;
        },
      };
    },
  };
}

test("routes dev through next directly", () => {
  const capture = createSpawnCapture();
  const packageRoot = path.resolve(__dirname, "..");

  run(["dev", "--port", "4010"], {
    packageRoot,
    nextBin: "/tmp/mock-next-bin.js",
    spawnImpl: capture.spawnImpl,
  });

  assert.equal(capture.calls.length, 1);
  assert.equal(capture.calls[0].command, process.execPath);
  assert.deepEqual(capture.calls[0].args, ["/tmp/mock-next-bin.js", "dev", "--port", "4010"]);
});

test("keeps build routed to next", () => {
  const capture = createSpawnCapture();
  const packageRoot = path.resolve(__dirname, "..");

  run(["build"], {
    packageRoot,
    nextBin: "/tmp/mock-next-bin.js",
    spawnImpl: capture.spawnImpl,
  });

  assert.equal(capture.calls.length, 1);
  assert.equal(capture.calls[0].command, process.execPath);
  assert.deepEqual(capture.calls[0].args, ["/tmp/mock-next-bin.js", "build"]);
});

test("routes start through the custom server entry", () => {
  const capture = createSpawnCapture();
  const packageRoot = path.resolve(__dirname, "..");

  run(["start", "--port", "4010"], {
    packageRoot,
    spawnImpl: capture.spawnImpl,
  });

  assert.equal(capture.calls.length, 1);
  assert.equal(capture.calls[0].command, process.execPath);
  assert.match(capture.calls[0].args[0], /session-dashboard-server\.cjs$/);
  assert.deepEqual(capture.calls[0].args.slice(1), ["start", "--port", "4010"]);
});
