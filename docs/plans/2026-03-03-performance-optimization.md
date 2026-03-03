# Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the biggest rendering and data-fetch bottlenecks so large session browsing remains responsive on high-volume servers.

**Architecture:** Introduce a chunked session-detail renderer and a shared deferred Shiki highlighter to reduce browser main-thread load. Add short-lived server-side caching for stats, scope SSE invalidation to active pages, use indexed Codex file lookup plus file caches, and cache derived session analysis to avoid repeated expensive work.

**Tech Stack:** Next.js App Router, React, SWR, @tanstack/react-virtual (not used in this iteration), TypeScript, Node test runner

---

### Task 1: Add failing tests for chunked session rendering helpers

**Files:**
- Create: `tests/session-view.test.mts`
- Create: `lib/session-view.ts`

**Step 1: Write the failing test**

Cover:
- initial visible count caps at chunk size
- loading older increases by one chunk without exceeding total
- visible message slice returns the most recent items

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/session-view.test.mts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Implement the minimal helper**

Add pure functions for chunk sizing and visible slicing.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/session-view.test.mts`
Expected: PASS.

### Task 2: Optimize session detail rendering and code highlighting

**Files:**
- Modify: `components/session-detail/SessionDetail.tsx`
- Modify: `components/session-detail/MessageBubble.tsx`
- Modify: `lib/session-view.ts`

**Step 1: Add chunked rendering to session detail**

- Start with 200 visible messages
- Render only the tail slice
- Add a control to load older messages in 200-message increments

**Step 2: Move Shiki to shared singleton state**

- One module-level highlighter
- One code HTML cache
- Defer highlighting until idle time

**Step 3: Keep fallback rendering cheap**

Render plain code immediately and upgrade to highlighted HTML later.

### Task 3: Reduce stats recalculation and SSE churn

**Files:**
- Modify: `app/api/stats/route.ts`
- Modify: `hooks/useRealtimeWatch.ts`
- Modify: `components/SWRProvider.tsx`
- Modify: `app/sessions/page.tsx`

**Step 1: Add short-lived stats cache**

- Cache stats payload for 60 seconds
- Reduce expensive deep-analysis sample size

**Step 2: Scope SSE invalidation**

- Let the dashboard watcher invalidate stats
- Let the sessions watcher skip stats invalidation
- Avoid mounting two watchers on the sessions page

### Task 4: Optimize Codex session lookup and analysis reuse

**Files:**
- Create: `lib/index-lookup.ts`
- Modify: `lib/adapters/codex.ts`
- Modify: `lib/analysis.ts`

**Step 1: Add index-based session file lookup**

Read the existing index file and use it to resolve `session id -> file path` before scanning.

**Step 2: Add mtime file cache for Codex parsing**

Reuse parsed file results when the file has not changed.

**Step 3: Add session analysis cache**

Cache `analyzeSession()` output by `session.id + lastActivity`.

### Task 5: Final verification

**Step 1: Run targeted helper tests**

Run: `npm test -- tests/session-view.test.mts`
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
