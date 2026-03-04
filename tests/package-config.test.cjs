const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")
);

test("runtime package publishes the production next root files", () => {
  assert.ok(packageJson.files.includes(".next/BUILD_ID"));
  assert.ok(packageJson.files.includes(".next/*.json"));
  assert.ok(packageJson.files.includes(".next/*.js"));
  assert.ok(packageJson.files.includes(".next/server"));
  assert.ok(packageJson.files.includes(".next/static"));
  assert.ok(packageJson.files.includes(".next/build"));
});

test("runtime package uses a JavaScript next config file", () => {
  assert.ok(packageJson.files.includes("next.config.mjs"));
  assert.equal(fs.existsSync(path.join(packageRoot, "next.config.mjs")), true);
  assert.equal(fs.existsSync(path.join(packageRoot, "next.config.ts")), false);
});
