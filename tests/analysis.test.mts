import test from "node:test";
import assert from "node:assert/strict";

import { analyzeSession, buildAnalysisOverview } from "../lib/analysis.ts";
import type { SessionDetail } from "../lib/types.ts";

function createSessionDetail(overrides: Partial<SessionDetail> = {}): SessionDetail {
  const startTime = new Date("2026-03-03T09:00:00.000Z");
  const lastActivity = new Date("2026-03-03T09:20:00.000Z");

  return {
    id: "cc-test-1",
    toolId: "claude-code",
    projectPath: "/Users/xm/demo-project",
    title: "Fix dashboard bug",
    messageCount: 6,
    startTime,
    lastActivity,
    messages: [
      {
        id: "m1",
        role: "user",
        content: "请先搜索错误并看看 session detail 为什么渲染失败",
        timestamp: startTime,
      },
      {
        id: "m2",
        role: "assistant",
        content: "我先读取 SessionDetail.tsx 并分析现有实现",
        timestamp: new Date("2026-03-03T09:02:00.000Z"),
      },
      {
        id: "m3",
        role: "assistant",
        content: "我会修改组件并应用 patch 来修复这个问题",
        timestamp: new Date("2026-03-03T09:05:00.000Z"),
      },
      {
        id: "m4",
        role: "assistant",
        content: "npm run build 失败，出现 TypeScript error: cannot find name",
        timestamp: new Date("2026-03-03T09:10:00.000Z"),
      },
      {
        id: "m5",
        role: "assistant",
        content: "我再修改一次并重新运行 npm test",
        timestamp: new Date("2026-03-03T09:14:00.000Z"),
      },
      {
        id: "m6",
        role: "assistant",
        content: "验证通过，build 成功，这次可以收尾了",
        timestamp: lastActivity,
      },
    ],
    ...overrides,
  };
}

test("analyzeSession builds merged stages, debug actions, and efficiency metrics", () => {
  const session = createSessionDetail();
  const analysis = analyzeSession(session);

  assert.equal(analysis.timeline.length >= 4, true);
  assert.equal(analysis.timeline[0]?.stage, "debugging");
  assert.equal(analysis.timeline.at(-1)?.stage, "wrap_up");
  assert.equal(analysis.debugPath.chain.includes("error"), true);
  assert.equal(analysis.debugPath.chain.includes("retry"), true);
  assert.equal(analysis.efficiency.totalMessages, 6);
  assert.equal(analysis.efficiency.highFriction, true);
  assert.equal(analysis.workflowStyle, "debug-heavy");
});

test("buildAnalysisOverview aggregates dominant tool and workflow style", () => {
  const debugSession = analyzeSession(createSessionDetail());
  const implementationSession = analyzeSession(createSessionDetail({
    id: "cdx-test-2",
    toolId: "codex",
    messageCount: 4,
    startTime: new Date("2026-03-03T10:00:00.000Z"),
    lastActivity: new Date("2026-03-03T10:08:00.000Z"),
    messages: [
      {
        id: "i1",
        role: "user",
        content: "帮我实现一个新的统计卡片",
        timestamp: new Date("2026-03-03T10:00:00.000Z"),
      },
      {
        id: "i2",
        role: "assistant",
        content: "我会实现这个组件并添加新的 UI",
        timestamp: new Date("2026-03-03T10:02:00.000Z"),
      },
      {
        id: "i3",
        role: "assistant",
        content: "已经更新 dashboard 并完成样式调整",
        timestamp: new Date("2026-03-03T10:05:00.000Z"),
      },
      {
        id: "i4",
        role: "assistant",
        content: "验证通过，完成交付",
        timestamp: new Date("2026-03-03T10:08:00.000Z"),
      },
    ],
  }));

  const overview = buildAnalysisOverview([debugSession, implementationSession]);

  assert.equal(overview.totalAnalyzedSessions, 2);
  assert.equal(overview.mostUsedTool, "claude-code");
  assert.equal(overview.averageMessages, 5);
  assert.equal(overview.debugHeavyShare > 0, true);
  assert.equal(overview.dominantWorkflowStyle, "debug-heavy");
});
