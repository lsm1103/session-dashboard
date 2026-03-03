# Session Detail Virtual List Design

**Goal:** Replace the current chunked message renderer with a true variable-height virtual list so very long sessions stay responsive while preserving date separators, bookmarks, and rich message rendering.

## Scope

This change is focused on the session detail view only:

1. Remove chunk-based "load older messages" rendering
2. Virtualize the message stream with variable-height rows
3. Preserve day separators in the visual timeline
4. Keep bookmark jumping working when target rows are not mounted

## Recommended Approach

Use `@tanstack/react-virtual` directly in `SessionDetail.tsx` and flatten the rendered timeline into one row list:

- `date` rows for each day separator
- `message` rows for each actual message

Each row is measured with `measureElement`, which allows dynamic heights from markdown rendering and deferred code highlighting.

## Why This Approach

The current chunked renderer reduces initial work, but once several chunks are loaded the DOM still grows without bound. A real virtual list keeps the mounted row count small regardless of session length, which is the main lever for avoiding whole-page UI lockups.

## Architecture

### Flattened rows

Add a small pure helper that converts `Message[]` into a flat row array:

- inserts a date row when the message date changes
- keeps message order stable
- provides stable row keys
- supports locating the row index for a specific message id

### Virtualized message pane

`SessionDetail.tsx` will:

- build the flat rows for the current session
- initialize `useVirtualizer()` against the existing scroll container
- render only visible rows inside an absolutely-positioned inner canvas
- call `measureElement` on each row wrapper

### Bookmark jumping

Bookmark navigation can no longer depend on fully-rendered DOM queries. Instead:

- look up the target message row index in the flat row array
- call `virtualizer.scrollToIndex()`
- after render, optionally center the mounted element for a smoother final position

## Testing Strategy

Use TDD for the new pure helper:

- date separators are inserted in the right places
- row order remains stable
- row lookup finds the right message row index

Then verify at the app level:

- `npm test`
- `npm run typecheck`
- `npm run build`
