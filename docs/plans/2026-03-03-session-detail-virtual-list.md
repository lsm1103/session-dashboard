# Session Detail Virtual List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the session detail view from chunked rendering to a true variable-height virtual list for long conversations.

**Architecture:** Introduce a pure row-flattening helper for date separators plus messages, test that helper first, then wire `SessionDetail.tsx` to `@tanstack/react-virtual` so only visible rows render while preserving bookmark jumps and dynamic markdown heights.

**Tech Stack:** Next.js App Router, React, @tanstack/react-virtual, TypeScript, Node test runner

---

### Task 1: Add a failing test for flattened session detail rows

**Files:**
- Create: `tests/session-detail-rows.test.mts`
- Create: `lib/session-detail-rows.ts`

**Step 1: Write the failing test**

Cover:
- date rows are inserted when the calendar day changes
- message rows preserve message ordering
- message id lookup returns the expected row index

**Step 2: Run the test to verify it fails**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/session-detail-rows.test.mts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Implement the minimal helper**

Add:
- a row type for `date` and `message`
- a builder for flattened rows
- a helper to find a message row index

**Step 4: Run the test to verify it passes**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/session-detail-rows.test.mts`
Expected: PASS.

### Task 2: Replace chunked rendering with a variable-height virtual list

**Files:**
- Modify: `components/session-detail/SessionDetail.tsx`
- Modify: `lib/session-view.ts` (remove old usage or retire helper if no longer needed)

**Step 1: Remove chunk-based visible window state**

Delete:
- chunk-size state
- "load older messages" button
- visible tail slicing

**Step 2: Introduce virtualized row rendering**

- use `useVirtualizer()`
- render rows into a relative-height canvas
- measure each row with `measureElement`
- provide different estimated heights for date rows and message rows

**Step 3: Preserve existing UX**

- keep session switch scrolling to the bottom
- keep analysis panel and header layout unchanged
- keep the empty state unchanged

### Task 3: Restore bookmark navigation in the virtualized list

**Files:**
- Modify: `components/session-detail/SessionDetail.tsx`
- Modify: `lib/session-detail-rows.ts`

**Step 1: Map bookmark target to a row index**

Use the flat row helper to find the row for the bookmarked message.

**Step 2: Scroll via the virtualizer**

Scroll to the row index first, then refine with a DOM `scrollIntoView()` after mount if the element is present.

### Task 4: Final verification

**Step 1: Run targeted helper tests**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/session-detail-rows.test.mts`
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
