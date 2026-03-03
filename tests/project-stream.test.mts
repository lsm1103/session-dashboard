import test from "node:test";
import assert from "node:assert/strict";

import { mergeStreamedProject } from "../lib/project-stream.ts";
import type { Project } from "../lib/types.ts";

function createProject(overrides: Partial<Project>): Project {
  return {
    id: "p-1",
    path: "/tmp/project-a",
    toolId: "claude-code",
    sessionCount: 1,
    lastActivity: new Date("2026-03-03T10:00:00.000Z"),
    ...overrides,
  };
}

test("mergeStreamedProject inserts the first project", () => {
  const next = mergeStreamedProject([], createProject({ id: "a" }));

  assert.equal(next.length, 1);
  assert.equal(next[0]?.id, "a");
});

test("mergeStreamedProject replaces an existing project with the same identity", () => {
  const current = [
    createProject({
      id: "a",
      sessionCount: 1,
      lastActivity: new Date("2026-03-03T09:00:00.000Z"),
    }),
  ];

  const next = mergeStreamedProject(current, createProject({
    id: "a",
    sessionCount: 3,
    lastActivity: new Date("2026-03-03T11:00:00.000Z"),
  }));

  assert.equal(next.length, 1);
  assert.equal(next[0]?.sessionCount, 3);
  assert.equal(next[0]?.lastActivity.toISOString(), "2026-03-03T11:00:00.000Z");
});

test("mergeStreamedProject keeps projects sorted by most recent lastActivity", () => {
  const current = [
    createProject({
      id: "older",
      path: "/tmp/project-a",
      lastActivity: new Date("2026-03-03T09:00:00.000Z"),
    }),
  ];

  const next = mergeStreamedProject(current, createProject({
    id: "newer",
    path: "/tmp/project-b",
    toolId: "codex",
    lastActivity: new Date("2026-03-03T12:00:00.000Z"),
  }));

  assert.deepEqual(next.map(project => project.id), ["newer", "older"]);
});
