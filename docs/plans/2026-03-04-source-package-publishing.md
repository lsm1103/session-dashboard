## Implementation Plan

1. Update packaging expectations in tests.
2. Change `package.json` to publish source directories instead of `.next` artifacts.
3. Remove `prepack` so publishing is no longer tied to a successful production build.
4. Simplify CLI defaults so bare `session-dashboard` launches `dev`.
5. Verify with tests, typecheck, build, and `npm pack --dry-run`.
