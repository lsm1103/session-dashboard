const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const { buildNextArgs, run } = require("../scripts/session-dashboard-cli.cjs");

function createPackageRoot(withBuildOutput = false) {
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "session-dashboard-cli-"));
  if (withBuildOutput) {
    const buildDir = path.join(packageRoot, ".next", "build");
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, "package.json"), "{}");
  }

  return packageRoot;
}

test("defaults to next dev when no production build output is present", () => {
  const packageRoot = createPackageRoot(false);
  assert.deepEqual(buildNextArgs([], { packageRoot }), ["dev"]);
});

test("defaults to next start when production build output is present", () => {
  const packageRoot = createPackageRoot(true);
  assert.deepEqual(buildNextArgs([], { packageRoot }), ["start"]);
});

test("prepends dev when only flags are provided", () => {
  const packageRoot = createPackageRoot(false);
  assert.deepEqual(buildNextArgs(["--port", "4000"], { packageRoot }), ["dev", "--port", "4000"]);
});

test("prepends start when only flags are provided and production build output exists", () => {
  const packageRoot = createPackageRoot(true);
  assert.deepEqual(buildNextArgs(["--port", "4000"], { packageRoot }), ["start", "--port", "4000"]);
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

test("routes dev through the custom server entry", () => {
  const capture = createSpawnCapture();
  const packageRoot = path.resolve(__dirname, "..");

  run(["dev", "--port", "4010"], {
    packageRoot,
    spawnImpl: capture.spawnImpl,
  });

  assert.equal(capture.calls.length, 1);
  assert.equal(capture.calls[0].command, process.execPath);
  assert.match(capture.calls[0].args[0], /session-dashboard-server\.cjs$/);
  assert.deepEqual(capture.calls[0].args.slice(1), ["dev", "--port", "4010"]);
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
