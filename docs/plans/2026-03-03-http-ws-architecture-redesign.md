# HTTP + WebSocket Architecture Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the app’s data and realtime layer so standard HTTP handles all data fetching, while a single shared WebSocket handles realtime notifications, scan progress, and connection health.

**Architecture:** Introduce one client WebSocket manager and one server WebSocket endpoint for lightweight control events, split current coarse endpoints into focused GET APIs (projects, per-project sessions, session metadata, paginated messages, stats summary, stats analysis), move the server to a shared cached snapshot model, and remove the current SSE-driven invalidation path after feature parity is reached.

**Tech Stack:** Next.js App Router, React, TypeScript, WebSocket, Node.js, existing adapter/index infrastructure, Node test runner

---

### Task 1: Introduce a client-side WebSocket event model

**Files:**
- Create: `lib/ws-events.ts`
- Create: `hooks/useRealtimeSocket.ts`
- Test: `tests/ws-events.test.mts`

**Step 1: Write the failing test**

Cover:
- parsing known event payloads
- rejecting malformed payloads
- mapping dirty events to specific refresh targets

**Step 2: Run the test to verify it fails**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ws-events.test.mts`
Expected: FAIL because the event helpers do not exist yet.

**Step 3: Implement the minimal helpers**

Add:
- typed event definitions
- event parsing / validation helpers
- a lightweight refresh-target mapper

**Step 4: Run the test to verify it passes**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ws-events.test.mts`
Expected: PASS.

### Task 2: Add the shared WebSocket connection layer

**Files:**
- Create: `app/api/realtime/route.ts` or the chosen server entry for WebSocket upgrades
- Create: `components/realtime/ConnectionBanner.tsx`
- Modify: `components/SWRProvider.tsx`
- Modify: `app/layout.tsx` if a global mount point is needed

**Step 1: Add one server WebSocket endpoint**

Support:
- `connected`
- `scan_started`
- `scan_progress`
- `projects_dirty`
- `sessions_dirty`
- `session_dirty`
- `warning`
- `error`

**Step 2: Add a shared client hook**

Support:
- connect on page load
- automatic reconnect with exponential backoff
- heartbeat or timeout handling
- connection state exposure

**Step 3: Surface connection state in the UI**

Add a visible banner or status chip for:
- connected
- reconnecting
- disconnected

### Task 3: Split HTTP read endpoints by responsibility

**Files:**
- Create: `app/api/projects/[projectId]/sessions/route.ts`
- Modify: `app/api/sessions/[id]/route.ts`
- Create: `app/api/sessions/[id]/messages/route.ts`
- Create: `app/api/stats/analysis/route.ts`
- Modify: `app/api/stats/summary/route.ts`

**Step 1: Add per-project sessions**

Move project-scoped session reads to:
- `GET /api/projects/:projectId/sessions`

**Step 2: Split session metadata and messages**

Make `GET /api/sessions/:id` lightweight.

Move transcript reads to:
- `GET /api/sessions/:id/messages?cursor=...&limit=...`

**Step 3: Separate summary stats from analysis stats**

Ensure `summary` stays cheap and `analysis` remains independently loadable.

### Task 4: Move server reads onto shared cached snapshots

**Files:**
- Modify: `lib/index-store.ts`
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/[projectId]/sessions/route.ts`
- Modify: `app/api/stats/summary/route.ts`
- Modify: `app/api/stats/analysis/route.ts`

**Step 1: Expose shared snapshot selectors**

Add reusable selectors for:
- all projects
- sessions by project
- session summaries

**Step 2: Ensure HTTP reads do not trigger ad-hoc full scans**

Requests should read current snapshot state only.

**Step 3: Trigger background refreshes separately**

The snapshot refresh path should be decoupled from normal reads.

### Task 5: Rewire `/sessions` to WebSocket-driven batched refresh

**Files:**
- Modify: `app/sessions/page.tsx`
- Modify: `hooks/useProjectsStream.ts` (replace current stream-first approach)
- Possibly create: `hooks/useProjectsRealtime.ts`

**Step 1: Remove the current first-load SSE project stream dependency**

Stop using `EventSource` for project discovery in the main page flow.

**Step 2: Use the shared WebSocket for progress + dirty events**

On:
- `scan_progress`: update loading text
- `projects_dirty`: re-fetch `GET /api/projects`

**Step 3: Keep immediate shell rendering**

The page should still render immediately with loading placeholders while batched updates arrive.

### Task 6: Remove old SSE invalidation path

**Files:**
- Modify: `app/api/watch/route.ts`
- Modify: `hooks/useRealtimeWatch.ts`
- Modify: `components/SWRProvider.tsx`
- Modify: any page still subscribing to `EventSource`

**Step 1: Audit remaining SSE dependencies**

Identify all page-level invalidation paths still relying on `/api/watch`.

**Step 2: Replace them with WebSocket-driven refreshes**

Switch targeted refreshes to the new shared socket.

**Step 3: Remove or retire `/api/watch`**

Only after the new path is stable and equivalent.

### Task 7: Final verification

**Step 1: Run targeted tests**

Run:
- `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ws-events.test.mts`

Expected: PASS.

**Step 2: Run all tests**

Run: `npm test`
Expected: PASS.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

**Step 4: Run production build**

Run: `npm run build`
Expected: PASS.
