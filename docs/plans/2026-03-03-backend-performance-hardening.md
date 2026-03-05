# Backend Performance Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lower backend CPU and memory pressure on large machines by bounding caches, reducing repeated scans, and reusing indexed data across routes.

**Architecture:** Add a shared LRU helper and apply it to adapter parse caches, switch JSONL adapters to stream parsing, refactor `index-store` to expose one cached indexed snapshot reused by sessions/projects/stats, then add TTL/mtime caches for non-JSONL adapters and narrow the realtime watcher.

**Tech Stack:** Next.js App Router, TypeScript, Node.js, chokidar, better-sqlite3, Node test runner

---

### Task 1: Add a failing test for a shared LRU helper

**Files:**
- Create: `tests/lru-cache.test.mts`
- Create: `lib/lru-cache.ts`

**Step 1: Write the failing test**

Cover:
- values can be stored and read
- reading refreshes recency
- the oldest entry is evicted at capacity

**Step 2: Run the test to verify it fails**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/lru-cache.test.mts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Implement the minimal helper**

Add a tiny generic LRU cache with:
- constructor max size
- `get()`
- `set()`
- `clear()`

**Step 4: Run the test to verify it passes**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/lru-cache.test.mts`
Expected: PASS.

### Task 2: Bound JSONL adapter caches and remove full-file buffering

**Files:**
- Modify: `lib/adapters/claude-code.ts`
- Modify: `lib/adapters/codex.ts`
- Modify: `lib/registry.ts`

**Step 1: Replace unbounded Maps with the shared LRU helper**

Use bounded caches for parsed session files.

**Step 2: Parse JSONL line-by-line directly from `readline`**

Remove the intermediate line arrays and update parser state incrementally.

**Step 3: Keep cache behavior the same**

Continue keying by file path plus mtime checks, only changing memory bounds and peak allocation behavior.

### Task 3: Share one indexed snapshot across sessions and projects

**Files:**
- Modify: `lib/index-store.ts`
- Modify: `app/api/sessions/route.ts`
- Modify: `app/api/projects/route.ts`

**Step 1: Extract one snapshot builder**

Build `sessions` and `projects` together in one pass.

**Step 2: Add short-lived in-memory caching and in-flight deduplication**

If multiple requests arrive together, only one rebuild should happen.

**Step 3: Keep the public index APIs stable**

`getIndexedSessions()` and `getIndexedProjects()` should still return the same shapes.

### Task 4: Make stats reuse indexed data

**Files:**
- Modify: `app/api/stats/route.ts`

**Step 1: Replace raw adapter scans with indexed reads**

Use indexed sessions/projects as the broad data source.

**Step 2: Keep detailed session loading only for the small analysis sample**

Continue sampling a limited number of full sessions for `analyzeSession()`.

### Task 5: Add caching to Cursor and Aider, and tighten the watcher

**Files:**
- Modify: `lib/adapters/cursor.ts`
- Modify: `lib/adapters/aider.ts`
- Modify: `app/api/watch/route.ts`
- Modify: `lib/index-store.ts`

**Step 1: Cache discovered files with TTL**

Avoid re-scanning directories on every request.

**Step 2: Cache parsed sources with mtime + LRU**

Reuse parsed DB and markdown results until files change.

**Step 3: Narrow the watcher to JSONL globs and clear in-memory index snapshots on change**

Keep live updates while reducing watcher overhead and stale snapshot windows.

### Task 6: Final verification

**Step 1: Run targeted helper tests**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/lru-cache.test.mts`
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
