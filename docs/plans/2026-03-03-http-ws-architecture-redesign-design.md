# HTTP + WebSocket Architecture Redesign

**Goal:** Replace the current mixed SSE-driven realtime model with a cleaner split: ordinary HTTP for all data reads, and one shared WebSocket connection for realtime notifications, connection health, and scan progress.

## Scope

This redesign covers the main data and realtime flows:

1. All project, session, message, and stats reads move to standard HTTP APIs
2. Realtime updates move to a single shared WebSocket connection
3. The server stops using request-triggered full scans as the primary data path
4. First-load progressive rendering is preserved through batched refreshes driven by WebSocket notifications

## Problem Summary

The current architecture mixes heavy first-load scans with SSE-style realtime invalidation. On large machines, this creates three compounding issues:

- first load may perform expensive scanning and aggregation before useful UI appears
- realtime channels and follow-up requests can stack additional load on top of the initial scan
- the same server process ends up doing both expensive data work and high-churn connection work at the same time

The result is poor perceived performance on first open and higher odds of request starvation under load.

## Recommended Approach

Use a strict control-plane / data-plane split:

- **HTTP** becomes the only way pages fetch actual data
- **WebSocket** becomes the only realtime channel, but it sends only lightweight notifications and connection-state events

The WebSocket should not carry large business payloads. It should only tell the page:

- the server is connected
- scanning has started or progressed
- which cached datasets are now stale (`projects_dirty`, `sessions_dirty`, `session_dirty`)
- whether the connection is reconnecting or degraded

The page then decides which `GET` endpoint to call.

## Why This Approach

This keeps the high-volume, cacheable work on predictable HTTP endpoints and keeps the realtime channel lightweight. It also makes failure handling easier:

- if WebSocket is unstable, data reads still work
- if a data endpoint is slow, the connection channel stays healthy
- client retries become simpler and more targeted

This design also aligns better with the desired first-load behavior: the page can render immediately, connect once, and then re-fetch specific datasets only when the server says they changed.

## Architecture

### Data Plane: Standard HTTP APIs

The data model should be split into focused read endpoints:

- `GET /api/projects`
  - returns the current project list from shared cached state
  - never performs a full ad-hoc filesystem crawl on behalf of a single request

- `GET /api/projects/:projectId/sessions`
  - returns sessions for one project only
  - reads from cached/indexed state

- `GET /api/sessions/:id`
  - returns session metadata and lightweight derived fields
  - should not automatically include the full message transcript

- `GET /api/sessions/:id/messages?cursor=...&limit=...`
  - returns paginated message slices
  - prevents giant responses for long conversations

- `GET /api/stats/summary`
  - fast counts only
  - safe to fetch early during first render

- `GET /api/stats/analysis`
  - heavier aggregate analysis
  - loaded later, independent from summary stats

This structure reduces payload size, makes caching more effective, and stops unrelated pages from pulling heavy data.

### Control Plane: One Shared WebSocket

The app should establish exactly one WebSocket connection per page instance. This socket is responsible only for:

- connection lifecycle
- scan lifecycle
- dirty notifications
- warning and error signaling

Recommended event types:

- `connected`
- `scan_started`
- `scan_progress`
- `projects_dirty`
- `sessions_dirty`
- `session_dirty`
- `warning`
- `error`

The client should not depend on large payloads arriving over the socket. Instead:

- receive a lightweight event
- decide whether current UI needs a refresh
- call the relevant `GET` endpoint

### First Load: Progressive but Batched

Because the selected direction is “WebSocket sends dirty notifications, then the page uses GET”, first-load progressive rendering should be implemented as **batched progressive refresh**, not per-item streaming.

Expected flow:

1. The `/sessions` shell renders immediately
2. The page opens the shared WebSocket and shows a scanning/loading state
3. The page performs an initial `GET /api/projects`
4. If cached data exists, projects appear immediately
5. If scanning is still running, the socket emits `scan_progress` and later `projects_dirty`
6. The page re-fetches `GET /api/projects` when notified
7. The list updates in batches as the scan advances

This preserves progressive UX while keeping the socket simple and cheap.

### Shared Cached Server State

The key performance rule in this redesign is:

**HTTP requests must read cached shared state, not trigger fresh full scans as their primary behavior.**

To support that:

- the server maintains a shared in-memory snapshot / index
- background scans refresh that snapshot
- WebSocket notifications tell clients when snapshots changed
- HTTP endpoints serve the latest available snapshot

Without this, switching from SSE to WebSocket would improve protocol shape but not solve the underlying performance issue.

### Connection Health and Fallback

The WebSocket client should include:

- automatic reconnect with exponential backoff
- visible disconnected / reconnecting banner
- success recovery state when the socket reconnects
- heartbeat timeout detection

If the socket cannot reconnect, the app should degrade gracefully:

- fall back to low-frequency polling
- only poll lightweight HTTP endpoints
- avoid expensive endpoints in degraded mode

## Migration Plan

Use an incremental migration instead of a single cutover:

1. Add shared WebSocket infrastructure first
2. Split and normalize HTTP read endpoints
3. Move server scanning into shared cached state updates
4. Switch pages to WebSocket-driven invalidation + targeted GET refresh
5. Remove the old SSE watch path after the new path is stable

This avoids a period where both old and new systems are partially broken.

## First Implementation Slice

The safest first slice is:

- add one shared WebSocket connection layer with reconnect and connection-state UI
- keep `GET /api/projects`, but make it read from shared cached state only
- update `/sessions` so first-load uses immediate shell render + WebSocket-driven batched `GET /api/projects` refreshes
- stop relying on the current SSE page invalidation path for that view

This gives the biggest visible user experience improvement with the least migration risk.

## Testing Strategy

Focus testing on the new architecture boundaries:

- WebSocket client lifecycle and reconnect state transitions
- dirty-event routing to the correct HTTP refreshes
- message pagination correctness
- server cache/snapshot reuse under repeated reads

Then verify at the app level:

- `npm test`
- `npm run typecheck`
- `npm run build`
