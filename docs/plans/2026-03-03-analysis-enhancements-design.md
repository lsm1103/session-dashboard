# Analysis Enhancements Design

**Goal:** Implement the roadmap's "分析增强" feature set with an explainable rules-based analysis engine that surfaces session timelines, efficiency signals, developer profile insights, and debug path replays.

## Scope

This iteration implements the MVP for four roadmap items in one pass:

1. Session narrative timeline
2. Personal AI developer profile
3. Efficiency signal panel
4. Debug path replay

The implementation will use deterministic rule-based heuristics over existing session data. It will not introduce any AI summarization or model calls.

## Current State

The dashboard currently exposes only coarse aggregate statistics:

- Total sessions
- Total projects
- Per-tool session counts
- 30-day activity chart
- Top 5 projects

Session detail pages show raw metadata plus the full message list, but they do not derive any higher-level structure from message flows.

## Approach

Add a shared analysis layer in `lib/analysis.ts` that converts a `SessionDetail` into a `SessionAnalysis` object. The analysis engine will:

- classify each message into a stage bucket
- merge adjacent messages into timeline stages
- extract key debug actions from message content
- compute efficiency metrics
- derive a dominant workflow style for the session

The same module will also aggregate multiple session analyses into an `AnalysisOverview` for the dashboard.

## Heuristics

### Narrative timeline

Messages are classified into one of:

- `discovery`
- `implementation`
- `debugging`
- `refactor`
- `wrap_up`

Classification is keyword-based, using both English and Chinese hints. Consecutive messages in the same stage are merged into one timeline segment.

### Debug path replay

Messages emit zero or more action events:

- `search`
- `read`
- `edit`
- `run`
- `error`
- `retry`
- `verify`

The replay stores both a compressed action chain and a detailed ordered list with timestamps.

### Efficiency signals

Per-session metrics include:

- duration
- total/user/assistant message counts
- touched file count
- stage switch count
- debug ratio
- action count
- high-friction flag

### Developer profile

The dashboard overview aggregates recent sessions and reports:

- most used tool
- average session duration
- average messages per session
- average touched files per session
- dominant workflow style
- debug-heavy session share

## API Changes

- `/api/sessions/[id]` returns `SessionDetail` plus `analysis`
- `/api/stats` returns its current fields plus `analysisOverview`

This keeps the number of frontend requests unchanged.

## UI Changes

### Dashboard

Add two new cards below the existing charts:

- `DeveloperProfileCard`
- `EfficiencyInsightsCard`

### Session detail

Add a collapsible analysis area between the header metadata and the message list:

- `NarrativeTimeline`
- `SessionEfficiencyPanel`
- `DebugPathReplay`

## Error Handling

If analysis cannot classify a message, it falls back to `discovery`. If no debug actions are detected, the replay shows a compact empty state instead of failing. Missing touched file data defaults to `0`.

## Testing Strategy

Use TDD around the pure analysis module first. Add Node-based tests for:

- stage classification and merging
- debug action extraction
- high-friction detection
- overview aggregation

Then run typecheck and production build to verify the app still compiles after wiring the UI.
