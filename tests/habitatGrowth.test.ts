import test from "node:test";
import assert from "node:assert/strict";
import {
  domeScale,
  habitatFeatures,
  habitatPromptCount,
  DOME_MAX_SCALE,
} from "../shared/habitatGrowth.ts";
import type { Habitat } from "../shared/domain.ts";

test("domes grow monotonically from prompt count and stop at twenty", () => {
  assert.equal(domeScale(1), 0.85);
  for (let n = 2; n <= 20; n++) assert.ok(domeScale(n) > domeScale(n - 1));
  assert.equal(domeScale(20), DOME_MAX_SCALE);
  assert.equal(domeScale(10000), DOME_MAX_SCALE);
  assert.equal(domeScale(-2), 0.85);
  // Largest adjacent foundations still fit inside the site's 8.5-unit spacing.
  assert.ok(2 * 2.45 * DOME_MAX_SCALE < 8.5);
});
test("growth counts unique prompts belonging to this chat and survives snapshot reload", () => {
  const member = {
    id: "chat/turn",
    kind: "chat" as const,
    threadId: "chat",
    turnId: "turn",
    prompt: "Hello",
    createdAt: "2026-01-01",
  };
  const h = {
    id: "site",
    projectId: "project",
    chatThreadId: "chat",
    members: [
      member,
      member,
      { ...member, id: "other/turn", threadId: "other" },
    ],
  } as Habitat;
  assert.equal(habitatPromptCount(h), 1);
  h.members.push({ ...member, id: "chat/turn2", turnId: "turn2" });
  assert.equal(habitatPromptCount(h), 2);
  const reloaded = JSON.parse(JSON.stringify(h));
  assert.equal(domeScale(habitatPromptCount(reloaded)), domeScale(2));
});

test("construction adds parts in order and respects unfinished work", () => {
  assert.equal(habitatFeatures(1, 0).foundation, false);
  assert.equal(habitatFeatures(1).foundation, true);
  assert.equal(habitatFeatures(1).frame, false);
  assert.equal(habitatFeatures(2).frame, true);
  assert.equal(habitatFeatures(3).glassPanels, 4);
  assert.equal(habitatFeatures(4).glassPanels, 8);
  assert.equal(habitatFeatures(4).door, false);
  assert.equal(habitatFeatures(5).door, true);
  assert.equal(habitatFeatures(6).windows, true);
  assert.equal(habitatFeatures(7).table, true);
  assert.equal(habitatFeatures(7).chairs, false);
  assert.equal(habitatFeatures(8).chairs, true);
  assert.equal(habitatFeatures(9).workstation, true);
  assert.equal(habitatFeatures(14).shelving, true);
  assert.equal(habitatFeatures(20, 1).glassPanels, 0);
  assert.equal(habitatFeatures(20, 4).table, false);
});
