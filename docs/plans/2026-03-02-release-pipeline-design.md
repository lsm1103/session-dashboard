# Release Pipeline And CLI Distribution Design

**Goal:** Add a reliable local pre-push typecheck gate, GitHub Actions npm publishing on release/tag, and a global `session-dashboard` CLI entrypoint.

**Context**

The project is currently a local Next.js app with no release automation, no Git hooks, and no npm package entrypoint. The package is marked `private`, so it cannot be published as-is.

**Recommended approach**

Use Husky for a repository-managed `pre-push` hook that runs `npm run typecheck`, then publish the package from GitHub Actions on `release.published` and version tag pushes. Expose a `bin` command that launches the bundled Next.js app in dev mode from the installed package directory.

**Why this approach**

- It enforces a local guardrail before code reaches the remote.
- It adds CI-side validation and release automation without depending on a developer machine.
- It keeps installation simple for users: `npm install -g session-dashboard` followed by `session-dashboard`.
- It requires minimal runtime assumptions because the existing Next.js source can be executed directly by the installed package.

**Trade-offs**

- Running the CLI in `next dev` mode is slower than shipping a prebuilt standalone server, but it avoids adding a custom build pipeline right now.
- Publishing on both release and tag can fire twice, so the workflow must guard against duplicate npm publishes.
- Husky requires a `prepare` step to install hooks locally after `npm install`.

**Architecture**

1. Package metadata:
   - Remove `private`.
   - Add `bin`, `files`, `typecheck`, `prepare`, and release validation scripts.
2. CLI:
   - Add a small Node script under `scripts/` that resolves the local `next` binary and launches the app from the package directory.
3. Git hooks:
   - Add `.husky/pre-push` to run TypeScript checks before every push.
4. CI release:
   - Add `.github/workflows/release.yml` to run install, typecheck, build, and `npm publish`.
   - Skip duplicate publish attempts when the current package version already exists on npm.
5. Docs:
   - Update README with global install and release automation details.

**Verification**

- `npm run typecheck`
- `npm test` for the CLI helper test
- `npm run build`
- Optional smoke check: `node scripts/session-dashboard.cjs --help`
