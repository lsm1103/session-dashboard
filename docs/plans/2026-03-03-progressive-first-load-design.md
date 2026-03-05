# Progressive First Load Design

**Goal:** Improve perceived first-load performance by showing the `/sessions` shell immediately, revealing projects progressively as they are discovered, and splitting dashboard stats into faster summary data plus slower analysis data.

## Scope

This pass covers three user-facing changes:

1. `/sessions` should show the page shell immediately and progressively append projects during the first scan
2. The default entrypoint should become `/sessions`
3. The dashboard should move to its own route and load summary stats earlier than analysis-heavy cards

## Recommended Approach

Use a dedicated SSE endpoint for project discovery and let the `/sessions` page build its left project list from streamed events:

- stream one discovered project at a time
- keep a visible loading state while scanning continues
- do one final `/api/projects` sync after the stream finishes

For the dashboard:

- move the current dashboard page to `/dashboard`
- change `/` to redirect to `/sessions`
- split the stats API into:
  - a light summary endpoint for counts
  - the existing heavier endpoint for analysis cards

## Why This Approach

It improves perceived speed without requiring a full architectural rewrite. The UI becomes interactive immediately, and the most visible long wait — the empty project list during the first scan — becomes progressive instead of blocking.

## Architecture

### Progressive project discovery

Add `/api/projects/stream` as a simple SSE route:

- iterate adapters in sequence
- emit each project as it becomes available from an adapter
- emit progress updates and a final done event

The `/sessions` page will use a dedicated hook to:

- connect to the SSE stream
- merge streamed projects into a deduplicated, sorted list
- show “正在扫描项目...” while the stream is active
- fetch the canonical `/api/projects` result once at the end

### Default entrypoint

Change `app/page.tsx` into a server redirect to `/sessions`.

To preserve the existing dashboard:

- create `app/dashboard/page.tsx`
- update links that currently point to `/` so they point to `/dashboard`

### Layered dashboard stats

Add `/api/stats/summary` for fast counts only:

- total sessions
- total projects
- per-tool counts

`StatsPanel` will use this summary endpoint. The analysis-heavy dashboard cards can continue using the existing `/api/stats`, so the dashboard shell and top cards can feel ready sooner even if analysis is still loading.

## Testing Strategy

Use TDD for a new pure helper that merges streamed projects:

- inserts the first project
- replaces duplicates by tool + project identity
- keeps the list sorted by `lastActivity`

Then verify at the app level:

- `npm test`
- `npm run typecheck`
- `npm run build`
