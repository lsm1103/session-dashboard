# Runtime-Only NPM Package Design

**Goal:** Publish the package as a prebuilt runtime artifact so npm consumers install only what is needed to run `session-dashboard`, not the full source tree.

## Recommended Approach

Use a prebuilt runtime package rather than a source package:

- Run `next build` before packing or publishing.
- Publish only runtime assets:
  - `.next/build`
  - `.next/package.json`
  - `.next/static`
  - `public`
  - `scripts`
  - `next.config.ts`
  - documentation metadata already included by npm (`package.json`, `README.md`)
- Keep runtime dependencies unchanged so `npm install -g session-dashboard` can still execute the packaged server.

This matches the current architecture because the app starts through the custom Node server in `scripts/session-dashboard-server.cjs`, which expects a built `.next` directory and serves assets from `public`.

## Startup Behavior

The CLI should prefer production startup when build artifacts exist:

- If a production marker exists (support legacy `.next/BUILD_ID` and the current Turbopack marker `.next/build/package.json`), default `session-dashboard` with no explicit subcommand to `start`.
- If build artifacts are missing, fall back to `dev`.
- Explicit subcommands such as `build`, `dev`, and `start` must continue to behave exactly as requested.

This keeps local development usable while making the published package behave like an installable app by default.

## Packaging Rules

`package.json` should:

- add a `prepack` script that runs `npm run build`
- replace the broad `files` list with runtime-only entries

This ensures both `npm publish` and `npm pack` always include a fresh build and exclude source-only directories.

## Verification

The change is complete when:

- CLI tests prove default startup chooses `start` only when build output exists
- `npm test`, `npm run typecheck`, and `npm run build` pass
- `npm pack --dry-run --json` shows the tarball includes runtime files and excludes `app/`, `components/`, `hooks/`, and `lib/`
