# Release Pipeline And CLI Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Husky pre-push typechecking, GitHub release/tag based npm publishing, and a global `session-dashboard` CLI command.

**Architecture:** Update package metadata so the app can be published, add a small tested Node CLI wrapper around the local Next.js binary, install a Husky `pre-push` gate, and add a GitHub Actions workflow that validates and publishes the package while avoiding duplicate releases.

**Tech Stack:** Node.js, npm, Husky, GitHub Actions, Next.js, TypeScript, Node test runner

---

### Task 1: Add CLI tests before implementation

**Files:**
- Create: `tests/session-dashboard-cli.test.cjs`

**Step 1: Write the failing test**

Write tests for:
- `buildNextArgs([])` returns `["dev"]`
- `buildNextArgs(["--port", "4000"])` returns `["dev", "--port", "4000"]`
- `buildNextArgs(["build"])` preserves explicit Next subcommands

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/session-dashboard-cli.test.cjs`
Expected: FAIL because the CLI helper module does not exist yet.

**Step 3: Implement the minimal code later**

Defer until Task 2.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/session-dashboard-cli.test.cjs`
Expected: PASS after Task 2 is complete.

### Task 2: Add the CLI helper and bin entrypoint

**Files:**
- Create: `scripts/session-dashboard-cli.cjs`
- Create: `scripts/session-dashboard.cjs`

**Step 1: Implement `buildNextArgs` and `run`**

- Resolve the local package root.
- Resolve `next/dist/bin/next`.
- Default to `dev` when no explicit Next subcommand is provided.
- Spawn a child process with inherited stdio.

**Step 2: Add a thin executable wrapper**

- Add a shebang script that calls `run(process.argv.slice(2))`.

**Step 3: Re-run the CLI tests**

Run: `npm test -- tests/session-dashboard-cli.test.cjs`
Expected: PASS.

### Task 3: Publishable package metadata and local hook

**Files:**
- Modify: `package.json`
- Create: `.husky/pre-push`

**Step 1: Update package metadata**

- Remove `private`.
- Add `bin`, `files`, `typecheck`, `test`, `prepare`, and `release:check`.
- Add `husky` to `devDependencies`.

**Step 2: Add the pre-push hook**

- Run `npm run typecheck`.

**Step 3: Install dependencies and hooks**

Run: `npm install`
Expected: `husky` is installed and `prepare` sets up git hooks.

### Task 4: Add release automation

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Add release workflow**

- Trigger on published GitHub releases and `v*` tag pushes.
- Run `npm ci`, `npm run release:check`.
- Skip `npm publish` if the current version already exists on npm.
- Publish with `NODE_AUTH_TOKEN`.

**Step 2: Validate workflow syntax**

Run: inspect YAML and confirm the commands match project scripts.

### Task 5: Update docs and verify

**Files:**
- Modify: `README.md`

**Step 1: Document global install and CLI usage**

- Add `npm install -g session-dashboard`
- Add `session-dashboard`

**Step 2: Document release automation**

- Mention Husky pre-push typecheck and GitHub release/tag publish flow.

**Step 3: Run verification**

Run: `npm run typecheck`
Expected: PASS

Run: `npm test -- tests/session-dashboard-cli.test.cjs`
Expected: PASS

Run: `npm run build`
Expected: PASS
