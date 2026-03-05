# Runtime-Only NPM Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the npm package from a source distribution into a prebuilt runtime distribution that defaults to production startup when build artifacts are present.

**Architecture:** Keep the existing custom Next.js server and CLI entrypoint, but change package contents to runtime-only assets and teach the CLI to detect a production marker (`.next/BUILD_ID` or the current Turbopack marker `.next/build/package.json`) before choosing its default subcommand. Use `prepack` so every packed or published tarball is built first.

**Tech Stack:** Node.js, Next.js, npm packaging, Node test runner

---

### Task 1: Lock in CLI default-start behavior with tests

**Files:**
- Modify: `tests/session-dashboard-cli.test.cjs`

**Step 1: Write the failing tests**

Add coverage for:
- defaulting to `dev` when production build output is missing
- defaulting to `start` when production build output is present
- preserving explicit subcommands

**Step 2: Run the test to verify it fails**

Run: `node --test tests/session-dashboard-cli.test.cjs`
Expected: FAIL because the CLI still defaults to `dev`.

### Task 2: Implement build-aware CLI defaults

**Files:**
- Modify: `scripts/session-dashboard-cli.cjs`

**Step 1: Detect packaged build output**

Add a helper that checks for a production marker under the package root.

**Step 2: Select the default subcommand from runtime state**

Use:
- `start` when build output exists
- `dev` otherwise

Keep explicit `build`, `dev`, `start`, and flag forwarding behavior intact.

**Step 3: Run the CLI tests**

Run: `node --test tests/session-dashboard-cli.test.cjs`
Expected: PASS.

### Task 3: Convert the npm package to runtime-only contents

**Files:**
- Modify: `package.json`

**Step 1: Narrow the published file list**

Keep only:
- `.next/BUILD_ID`
- `.next/build`
- `.next/node_modules`
- `.next/package.json`
- `.next/*.json`
- `.next/*.js`
- `.next/server`
- `.next/static`
- `public`
- `scripts`
- `next.config.mjs`

Rely on npm’s default inclusion for `package.json` and `README.md`.

**Step 2: Add a `prepack` build hook**

Ensure `npm pack` and `npm publish` both run `npm run build` before packaging.

### Task 4: Verify the packed artifact

**Step 1: Run the full verification suite**

Run:
- `npm test`
- `npm run typecheck`
- `npm run build`

Expected: PASS.

**Step 2: Inspect the package contents**

Run: `npm pack --dry-run --json`
Expected:
- includes production `.next` artifacts, `public`, `scripts`, and config/runtime metadata
- excludes `app/`, `components/`, `hooks/`, and `lib/`
