# Performance Optimization Design

**Goal:** Reduce UI lockups and backend thrash when browsing large numbers of sessions on busy servers.

## Scope

This pass targets the highest-impact hot paths:

1. Session detail rendering cost
2. Markdown and code highlighting cost
3. Expensive `/api/stats` recalculation
4. Over-broad SSE invalidation
5. Codex session lookup scanning
6. Repeated session analysis work

## Recommended Approach

Use a low-risk staged optimization instead of a full virtualization rewrite:

- Render only the most recent message chunk in session detail, with "load older" pagination
- Reuse one shared Shiki highlighter and defer highlighting until idle time
- Cache `/api/stats` responses for a short TTL and reduce deep analysis fan-out
- Only invalidate stats when the dashboard page is active
- Avoid duplicate SSE watchers on the sessions page
- Reuse index metadata to locate Codex files directly when possible
- Cache `analyzeSession()` results by `session.id + lastActivity`

## Why This Approach

It gives most of the perceived performance win without introducing the complexity of dynamic-height virtualized chat rendering in this iteration. The chunked renderer and shared highlighter directly reduce main-thread work, which is the primary source of "whole page stops responding" behavior.

## Architecture

### Session detail rendering

Add a small helper module that:

- computes the initial visible message count
- grows the visible window in fixed-size chunks
- returns the tail slice of messages to render

The UI will default to the latest 200 messages and expose a "load older" control when older content exists.

### Shared highlighter

Move Shiki initialization out of each `MessageBubble` instance into module-level singleton state:

- one highlighter promise
- one loaded-language set
- one HTML cache by `lang + code`

Highlighting is scheduled with `requestIdleCallback` when available, so the plain content renders first and highlighting happens when the browser is idle.

### Stats cost control

Add a small in-memory cache in the stats route:

- TTL: 60 seconds
- reduced deep-analysis sample size
- re-use cached payload when still fresh

### SSE scope

- The root SWR watcher should not mount on the sessions page, because that page already mounts its own watcher
- The sessions page watcher should not invalidate `/api/stats`
- The dashboard watcher may invalidate `/api/stats`

### Codex lookup

Codex session lookup currently scans the whole session tree on each open. The index already stores `session id -> file path` data in `index.json`, so a lightweight index lookup helper can use that map first. Add file-level mtime caching to `parseCodexFile`, matching the Claude adapter pattern.

### Analysis cache

Wrap `analyzeSession()` with a simple in-memory cache keyed by `session.id + lastActivity`.

## Testing Strategy

Use TDD for the new chunking helper because it is pure logic and easy to validate:

- initial window size
- loading older chunks
- tail slicing

Then use project-level verification:

- `npm test`
- `npm run typecheck`
- `npm run build`
