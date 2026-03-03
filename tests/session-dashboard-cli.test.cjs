const test = require("node:test");
const assert = require("node:assert/strict");

const { buildNextArgs } = require("../scripts/session-dashboard-cli.cjs");

test("defaults to next dev when no args are provided", () => {
  assert.deepEqual(buildNextArgs([]), ["dev"]);
});

test("prepends dev when only flags are provided", () => {
  assert.deepEqual(buildNextArgs(["--port", "4000"]), ["dev", "--port", "4000"]);
});

test("preserves explicit next subcommands", () => {
  assert.deepEqual(buildNextArgs(["build"]), ["build"]);
  assert.deepEqual(buildNextArgs(["start", "--port", "4000"]), ["start", "--port", "4000"]);
});
