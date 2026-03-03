# Backend Performance Hardening Design

**Goal:** Reduce backend CPU spikes, control long-lived memory growth, and cut repeated filesystem/database work when the app runs on machines with many projects and sessions.

## Scope

This pass targets six concrete backend hotspots:

1. Unbounded parse caches in JSONL adapters
2. Full-file buffering before parsing long JSONL sessions
3. Repeated index scans for `/api/projects` and `/api/sessions`
4. `/api/stats` bypassing the index and re-running full adapter scans
5. Repeated full scans/parses in `Cursor` and `Aider`
6. Over-broad file watching for realtime updates

## Recommended Approach

Use a layered optimization that preserves current APIs:

- replace parse caches with a bounded shared LRU helper
- parse JSONL files as streams instead of loading every line first
- build one short-lived indexed snapshot for both sessions and projects
- make `/api/stats` reuse indexed data instead of full adapter scans
- add mtime/TTL caches for `Cursor` and `Aider`
- narrow the watcher to JSONL globs and clear in-memory index snapshots on changes

## Why This Approach

It directly targets the current hot paths without introducing a new background service or changing the UI contract. The app keeps its current architecture, but the expensive work becomes bounded, shared, and less repetitive.

## Architecture

### Shared LRU cache

Introduce a small generic `LruCache` helper:

- fixed maximum entry count
- `get()` refreshes recency
- `set()` evicts the oldest entry when full

This will back the `claude-code`, `codex`, `cursor`, and `aider` parse caches so large servers do not accumulate unlimited parsed sessions in memory.

### Streaming JSONL parsing

`claude-code` and `codex` already use `readline`, but they first collect all lines into arrays. The new flow will parse each JSON line directly from the stream:

- open one `readline.Interface`
- parse line by line
- update message/state incrementally
- never hold the whole file’s lines in memory at once

This reduces peak memory and avoids an unnecessary intermediate allocation.

### Shared indexed snapshot

Refactor `index-store` so one function builds a single in-memory snapshot:

- `sessions`
- `projects`

Both `/api/sessions` and `/api/projects` will read from that snapshot, and the snapshot will be cached for a short TTL with in-flight request deduplication. This removes the current duplicate scan pattern where similar work is repeated by separate routes.

### Stats on top of the index

`/api/stats` will stop calling the raw adapter registry for broad scans. Instead it will:

- read indexed projects
- read indexed sessions
- only fetch full session details for a small sample used by analysis

This keeps stats aligned with the index and avoids a second, heavier crawl of all adapters.

### Cursor and Aider caches

For `Cursor`:

- add a short TTL cache for the discovered DB file list
- add an mtime-based LRU around parsed DB results

For `Aider`:

- add a short TTL cache for discovered history files
- add an mtime-based LRU around parsed markdown history

### Realtime watcher scope

The watcher will be narrowed from broad directory trees to explicit `**/*.jsonl` globs for Claude and Codex session files. On file changes, it will clear the in-memory indexed snapshot cache so the next API read rebuilds from fresh state without waiting for TTL expiry.

## Testing Strategy

Use TDD for the new pure shared helper:

- LRU stores and retrieves values
- access refreshes recency
- oldest entry is evicted when capacity is exceeded

Then use app-level verification:

- `npm test`
- `npm run typecheck`
- `npm run build`
