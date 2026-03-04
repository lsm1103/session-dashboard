## Goal

Revert npm publishing from a runtime-only prebuilt package back to a source-based package that installs dependencies normally and starts reliably after install.

## Why

The runtime-only package path is too tightly coupled to Next 16 + Turbopack internals:

- `.next` production artifacts changed shape
- nested `.next/node_modules` cannot be trusted in npm tarballs
- externalized runtime aliases (`chokidar-*`, `better-sqlite3-*`) make installs fragile

For this product, install-time stability is more important than minimizing tarball size.

## Chosen Approach

Publish the source application files and keep runtime dependencies installed through npm as usual.

- Publish app source directories and runtime scripts
- Keep `next.config.mjs` as JavaScript to avoid runtime TypeScript installation
- Remove the `prepack` build requirement
- Make the CLI default to `dev` instead of trying to infer whether prebuilt artifacts exist

## Expected Outcome

- `npm install -g session-dashboard` installs dependencies normally
- `session-dashboard` starts in development mode by default
- `session-dashboard start` remains available for explicit production-style startup in source checkouts
- npm tarballs become larger than the runtime-only package, but substantially more reliable
