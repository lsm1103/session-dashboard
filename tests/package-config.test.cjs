const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")
);
const nextConfigText = fs.readFileSync(
  path.join(packageRoot, "next.config.mjs"),
  "utf8"
);

test("source package publishes app source and runtime assets", () => {
  assert.ok(packageJson.files.includes("app"));
  assert.ok(packageJson.files.includes("components"));
  assert.ok(packageJson.files.includes("hooks"));
  assert.ok(packageJson.files.includes("lib"));
  assert.ok(packageJson.files.includes("public"));
  assert.ok(packageJson.files.includes("scripts"));
  assert.equal(packageJson.files.some((entry) => entry.startsWith(".next")), false);
});

test("source package does not require prepack build", () => {
  assert.equal("prepack" in packageJson.scripts, false);
});

test("source package keeps runtime build dependencies in dependencies", () => {
  assert.equal("typescript" in packageJson.dependencies, true);
  assert.equal("@tailwindcss/postcss" in packageJson.dependencies, true);
  assert.equal("tailwindcss" in packageJson.dependencies, true);
  assert.equal("tw-animate-css" in packageJson.dependencies, true);
});

test("runtime package uses a JavaScript next config file", () => {
  assert.ok(packageJson.files.includes("next.config.mjs"));
  assert.equal(fs.existsSync(path.join(packageRoot, "next.config.mjs")), true);
  assert.equal(fs.existsSync(path.join(packageRoot, "next.config.ts")), false);
});

test("next config does not force serverExternalPackages", () => {
  assert.equal(nextConfigText.includes("serverExternalPackages"), false);
});
