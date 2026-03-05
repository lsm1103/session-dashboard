# Progressive First Load Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the app feel responsive on first open by streaming the `/sessions` project list, changing the default entrypoint to `/sessions`, and splitting dashboard stats into fast summary data plus slower analysis data.

**Architecture:** Add an SSE-based project discovery endpoint and a client hook that merges streamed projects into the `/sessions` UI, then redirect `/` to `/sessions`, move the current dashboard to `/dashboard`, and use a new summary stats endpoint so dashboard counts appear earlier than analysis cards.

**Tech Stack:** Next.js App Router, React, SWR, Server-Sent Events, TypeScript, Node test runner

---

### Task 1: Add a failing test for streamed project merging

**Files:**
- Create: `tests/project-stream.test.mts`
- Create: `lib/project-stream.ts`

**Step 1: Write the failing test**

Cover:
- inserting the first project
- replacing an existing project with the same identity
- sorting by most recent `lastActivity`

**Step 2: Run the test to verify it fails**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/project-stream.test.mts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Implement the minimal helper**

Add a pure merge function for progressive project lists.

**Step 4: Run the test to verify it passes**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/project-stream.test.mts`
Expected: PASS.

### Task 2: Stream projects progressively on `/sessions`

**Files:**
- Create: `app/api/projects/stream/route.ts`
- Create: `hooks/useProjectsStream.ts`
- Modify: `app/sessions/page.tsx`

**Step 1: Add the SSE projects route**

- stream `project` events
- stream `progress` events
- stream a final `done` event

**Step 2: Add a client hook for progressive project state**

- connect to the SSE route
- merge projects as they arrive
- fetch `/api/projects` once after completion

**Step 3: Update the `/sessions` left panel**

- render the shell immediately
- show a visible scanning/loading status
- display projects as soon as they arrive

### Task 3: Make `/sessions` the default entrypoint

**Files:**
- Modify: `app/page.tsx`
- Create: `app/dashboard/page.tsx`
- Modify: `app/sessions/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

**Step 1: Redirect `/` to `/sessions`**

Use a server redirect.

**Step 2: Preserve the dashboard on `/dashboard`**

Move the current dashboard content there.

**Step 3: Update links**

Replace links that currently target `/` as the dashboard route.

### Task 4: Split dashboard stats into a fast summary layer

**Files:**
- Create: `app/api/stats/summary/route.ts`
- Modify: `components/dashboard/StatsPanel.tsx`

**Step 1: Add a lightweight summary endpoint**

Return only fast-to-compute counts.

**Step 2: Point `StatsPanel` at the summary endpoint**

Keep the analysis cards on the heavier endpoint.

### Task 5: Final verification

**Step 1: Run targeted helper tests**

Run: `node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/project-stream.test.mts`
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
