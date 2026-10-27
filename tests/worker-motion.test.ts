import test from "node:test";
import assert from "node:assert/strict";
import { workerPose } from "../src/workerMotion.ts";
test("editing choreography picks up, carries, places, hammers, and walks back", () => {
  assert.deepEqual(
    [0.5, 3, 8, 10, 15].map((t) => workerPose("editing", t, 0).action),
    ["pickup", "carrying", "placing", "hammering", "walking"],
  );
  assert.equal(workerPose("editing", 3, 0).carrying, true);
  assert.equal(workerPose("editing", 10, 0).carrying, false);
});
test("walking and material routes stay in front of the building footprint", () => {
  for (let i = 0; i < 4; i++)
    for (let t = 0; t < 60; t += 0.1) {
      const p = workerPose("editing", t, i);
      assert.ok(p.z >= 1.5);
      assert.ok(Math.abs(p.x) < 3.5);
    }
});
test("terminal and waiting states never continue construction cycles", () => {
  for (const status of [
    "completed",
    "failed",
    "interrupted",
    "blocked",
    "waiting for approval",
  ])
    for (const t of [0, 5, 15, 50]) {
      const p = workerPose(status, t, 0);
      assert.ok(["resting", "waiting", "strolling"].includes(p.action));
      assert.equal(p.carrying, false);
    }
});
test("command work uses a terminal and check work uses a clipboard", () => {
  assert.equal(workerPose("running commands", 8, 0).action, "terminal");
  assert.equal(workerPose("checking", 8, 0).action, "measuring");
});

test("completed workers remain in motion without claiming construction", () => {
  const a = workerPose("completed", 0, 0),
    b = workerPose("completed", 4, 0);
  assert.equal(a.action, "strolling");
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1);
  assert.equal(b.carrying, false);
});
test("editing workers travel from an external depot to their building", () => {
  const depot = workerPose("editing", 0.5, 0),
    site = workerPose("editing", 10, 0);
  assert.ok(Math.hypot(depot.x - site.x, depot.z - site.z) > 4);
});
