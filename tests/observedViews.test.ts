import test from "node:test";
import assert from "node:assert/strict";
import { observedItems, isCheckCommand } from "../shared/observedViews.ts";
import { villagePath, habitatPosition } from "../src/districtLayout.ts";

test("chat panels separate messages, file edits, write commands and checks", () => {
  const activity = [
    { id: "u", kind: "userMessage", message: "Build it" },
    { id: "a", kind: "agentMessage", message: "Working" },
    { id: "f", kind: "fileChange", message: "Changed: app.ts" },
    { id: "w", kind: "commandExecution", message: "Set-Content app.ts hello" },
    {
      id: "c",
      kind: "commandExecution",
      message: "pnpm run test:e2e",
      status: "completed",
      exitCode: 1,
    },
    { id: "r", kind: "commandExecution", message: "Get-Content README.md" },
  ];
  assert.deepEqual(
    observedItems(activity, "Chat").map((a) => a.id),
    ["u", "a"],
  );
  assert.deepEqual(
    observedItems(activity, "Changes").map((a) => a.id),
    ["f", "w"],
  );
  assert.deepEqual(
    observedItems(activity, "Checks").map((a) => a.id),
    ["c"],
  );
  assert.equal(observedItems(activity, "Activity").length, 6);
});

test("check detection requires a verification command rather than reading a matching filename", () => {
  for (const command of [
    "npm run build",
    "pnpm test:e2e",
    "npx tsc --noEmit",
    "python -m pytest",
    "cargo check",
    "node --test",
  ])
    assert.equal(isCheckCommand(command), true, command);
  for (const command of [
    "Get-Content build.ts",
    "cat test.json",
    "rg build src",
    "echo test",
  ])
    assert.equal(isCheckCommand(command), false, command);
});

test("village lanes stay outside the fountain square and end at house steps", () => {
  for (let plot = 0; plot < 20; plot++)
    for (const scale of [0.85, 1, 1.45]) {
      const path = villagePath(plot, scale);
      const [x, , z] = habitatPosition(plot);
      if (!path.length) continue;
      assert.ok(path.center - path.length / 2 >= 5.079);
      assert.ok(
        Math.abs(
          path.center + path.length / 2 - (Math.hypot(x, z) - 2.55 * scale),
        ) < 1e-8,
      );
    }
});
