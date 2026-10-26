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
      assert.ok(Math.abs(p.x) < 2);
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
      assert.ok(["resting", "waiting"].includes(p.action));
      assert.equal(p.carrying, false);
    }
});
test("command work uses a terminal and check work uses a clipboard", () => {
  assert.equal(workerPose("running commands", 8, 0).action, "terminal");
  assert.equal(workerPose("checking", 8, 0).action, "measuring");
});
