import test from "node:test";
import assert from "node:assert/strict";

import { getProjectListKey } from "../lib/utils.ts";

test("getProjectListKey combines tool and project id to avoid collisions", () => {
  const left = getProjectListKey({
    id: "%2FUsers%2Fxm%2FDesktop%2Fwork_project%2Fjzx_project%2Fbackend%2Fjzx-ai-agents",
    toolId: "claude-code",
  });
  const right = getProjectListKey({
    id: "%2FUsers%2Fxm%2FDesktop%2Fwork_project%2Fjzx_project%2Fbackend%2Fjzx-ai-agents",
    toolId: "codex",
  });

  assert.equal(left, "claude-code:%2FUsers%2Fxm%2FDesktop%2Fwork_project%2Fjzx_project%2Fbackend%2Fjzx-ai-agents");
  assert.equal(right, "codex:%2FUsers%2Fxm%2FDesktop%2Fwork_project%2Fjzx_project%2Fbackend%2Fjzx-ai-agents");
  assert.notEqual(left, right);
});
