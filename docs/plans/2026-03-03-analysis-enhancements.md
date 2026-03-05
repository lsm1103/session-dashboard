# Analysis Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a rules-based analysis layer that powers the roadmap's analysis enhancements on both the dashboard and session detail pages.

**Architecture:** Build a pure analysis module that derives timeline stages, debug actions, efficiency metrics, and aggregate profile insights from existing `SessionDetail` data. Extend the current APIs to return these derived objects, then add lightweight dashboard and session-detail UI components that render the new data without adding extra requests.

**Tech Stack:** Next.js App Router, TypeScript, React, SWR, Node test runner

---

### Task 1: Add failing tests for the analysis engine

**Files:**
- Create: `tests/analysis.test.mjs`

**Step 1: Write the failing test**

Add tests that cover:
- stage classification and timeline merging
- debug action extraction and retry detection
- efficiency metric calculation
- aggregate overview generation

**Step 2: Run test to verify it fails**

Run: `node --test tests/analysis.test.mjs`
Expected: FAIL because `lib/analysis.ts` does not exist yet.

**Step 3: Write minimal implementation**

Defer until Task 2.

**Step 4: Run test to verify it passes**

Run: `node --test tests/analysis.test.mjs`
Expected: PASS after Task 2.

**Step 5: Commit**

```bash
git add tests/analysis.test.mjs lib/analysis.ts lib/types.ts
git commit -m "feat: add session analysis engine"
```

### Task 2: Implement the shared analysis engine

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/analysis.ts`

**Step 1: Add shared analysis types**

Define:
- `AnalysisStageType`
- `AnalysisStage`
- `DebugActionType`
- `DebugAction`
- `SessionEfficiency`
- `SessionAnalysis`
- `AnalysisOverview`

**Step 2: Implement pure analysis helpers**

Add exported functions:
- `analyzeSession(session)`
- `buildAnalysisOverview(sessions)`

Internal helpers should:
- classify messages
- merge stages
- extract debug actions
- compute efficiency metrics
- derive dominant workflow labels

**Step 3: Re-run tests**

Run: `node --test tests/analysis.test.mjs`
Expected: PASS.

### Task 3: Extend API responses with analysis data

**Files:**
- Modify: `app/api/sessions/[id]/route.ts`
- Modify: `app/api/stats/route.ts`
- Modify: `lib/registry.ts`

**Step 1: Add session analysis to detail API**

Compute `analysis` from the loaded session before returning it.

**Step 2: Add aggregate overview to stats API**

Load a reasonable recent session window, analyze them, and return `analysisOverview`.

**Step 3: Keep existing response fields backward compatible**

Do not remove current keys.

**Step 4: Commit**

```bash
git add app/api/sessions/[id]/route.ts app/api/stats/route.ts lib/registry.ts
git commit -m "feat: expose analysis data via dashboard APIs"
```

### Task 4: Add dashboard analysis cards

**Files:**
- Create: `components/dashboard/DeveloperProfileCard.tsx`
- Create: `components/dashboard/EfficiencyInsightsCard.tsx`
- Modify: `components/dashboard/StatsPanel.tsx`
- Modify: `app/page.tsx`

**Step 1: Add components for developer profile and efficiency insights**

Render concise labels and values using the new `analysisOverview` payload.

**Step 2: Update dashboard layout**

Place the new cards below the existing chart and project sections, keeping the page readable on mobile widths.

**Step 3: Verify the page still compiles**

Run: `npm run build`
Expected: PASS.

### Task 5: Add session detail analysis UI

**Files:**
- Create: `components/session-detail/NarrativeTimeline.tsx`
- Create: `components/session-detail/SessionEfficiencyPanel.tsx`
- Create: `components/session-detail/DebugPathReplay.tsx`
- Modify: `components/session-detail/SessionDetail.tsx`

**Step 1: Add the new analysis subcomponents**

Render:
- merged stage timeline
- efficiency summary chips
- debug action chain and event list

**Step 2: Wire the components into `SessionDetail`**

Insert a collapsible analysis section between the header and the message list.

**Step 3: Verify the page still compiles**

Run: `npm run build`
Expected: PASS.

### Task 6: Final verification

**Files:**
- Modify: `package.json` (only if test script needs adjustment)

**Step 1: Run unit tests**

Run: `node --test tests/analysis.test.mjs`
Expected: PASS.

**Step 2: Run project tests**

Run: `npm test`
Expected: PASS.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

**Step 4: Run production build**

Run: `npm run build`
Expected: PASS.
