import { chromium, expect } from "@playwright/test";
import type { Snapshot, Task } from "../shared/domain.ts";
import {
  ensureHabitats,
  createHabitat,
  moveHabitatMember,
} from "../shared/habitats.ts";
const projects = ["Aurora Research", "Red Planet Systems"].map(
  (name, plot) => ({
    id: `project-${plot}`,
    name,
    plot,
    path: "/browser-fixture",
    successes: 2,
    checks: [],
  }),
);
const prompts = [
  "Improve UI sidebar navigation",
  "Improve UI navbar navigation",
  "Build API endpoints",
  "Add sqlite storage",
  "Write verification tests",
  "Write documentation",
  "Build sensor telemetry",
];
const tasks = prompts.map((prompt, i): Task => ({
  id: `task-${i}`,
  projectId: projects[i === 6 ? 1 : 0].id,
  prompt,
  status: i === 2 ? "running" : "succeeded",
  createdAt: new Date().toISOString(),
  workspace: "/browser-fixture",
  base: "",
  branch: "",
  workers:
    i === 2
      ? [
          {
            id: "visual-worker",
            threadId: "visual-worker",
            role: "Implementation",
            description: "Browser fixture only",
            dependencies: [],
            expectedOutput: "Visual QA",
            workspace: "/browser-fixture",
            status: "editing",
            latest: "Visual fixture, no real execution",
          },
        ]
      : [],
  checks: [],
  messages: [],
  diff: "",
  files: [],
  awarded: false,
  applied: false,
  concurrency: 1,
}));
const state: Snapshot = {
  projects,
  tasks,
  events: [],
  requests: [],
  runtime: { mode: "real", connected: false, authenticated: false },
};
ensureHabitats(state);
for (const h of state.habitats!)
  h.constructionStage = h.members.some((m) => m.id === "task-2") ? 0 : 5;
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/api/state*", (r) => r.fulfill({ json: state }));
  await page.route("**/api/habitats**", async (r) => {
    const b = r.request().postDataJSON();
    const parts = new URL(r.request().url()).pathname.split("/");
    let result: any;
    if (parts.length === 3) result = createHabitat(state, b.projectId, b.name);
    else if (parts[4] === "assign") {
      moveHabitatMember(state, parts[3], b.kind, b.memberId);
      result = { ok: true };
    } else {
      result = state.habitats!.find((h) => h.id === parts[3])!;
      result.name = b.name;
    }
    await r.fulfill({ json: result });
  });
  await page.goto("http://127.0.0.1:4310");
  await expect(page.locator(".plot-label")).toHaveCount(2);
  await expect(page.locator(".habitat-label")).toHaveCount(
    state.habitats!.length,
  );
  await expect(page.locator(".worker-state")).toHaveCount(1);
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: ".local/outpost-overview.png",
    fullPage: true,
  });
  await page
    .locator(".project-nav")
    .filter({ hasText: "Aurora Research" })
    .click();
  await page
    .getByRole("button", { name: "Find current crew", exact: false })
    .click();
  await expect(page.locator(".habitat-inspector")).toBeVisible();
  await page.mouse.move(15, 15);
  await expect(page.locator('.habitat-label[data-current="true"]')).toHaveCount(
    1,
  );
  await expect(page.locator(".habitat-label.selected")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(page.locator(".worker-state")).toBeVisible();
  const buildSite = state.habitats!.find((h) => h.id === tasks[2].habitatId)!;
  for (let stage = 0; stage <= 5; stage++) {
    buildSite.constructionStage = stage;
    await expect(page.locator(".habitat-label.selected")).toHaveAttribute(
      "data-stage",
      String(stage),
      { timeout: 12000 },
    );
    await page.screenshot({
      path: ".local/village-stage-" + stage + ".png",
      fullPage: true,
    });
  }
  await page.waitForTimeout(1500);
  const nameBox = (await page
    .locator(".habitat-label.selected")
    .boundingBox())!;
  await page.mouse.move(
    nameBox.x + nameBox.width / 2,
    nameBox.y + nameBox.height + 60,
  );
  await expect(page.locator(".habitat-label.selected")).toHaveAttribute(
    "data-hovered",
    "true",
  );
  await expect(page.locator(".habitat-label.selected")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.mouse.move(15, 15);
  await expect(page.locator(".habitat-label.selected")).toHaveCSS(
    "opacity",
    "0",
  );
  await page.screenshot({ path: ".local/outpost-habitat.png", fullPage: true });
  await expect
    .poll(
      async () =>
        Number(
          await page
            .locator(".worker-state")
            .getAttribute("data-placed-bricks"),
        ),
      { timeout: 35000 },
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("textbox", { name: "Habitat name", exact: true })
    .fill("Robotics lab");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(
    page.locator(".habitat-card").filter({ hasText: "Robotics lab" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "New habitat name", exact: true })
    .fill("Materials tent");
  await page.locator(".new-habitat button").click();
  await expect(
    page.getByRole("textbox", { name: "Habitat name", exact: true }),
  ).toHaveValue("Materials tent");
  const target = state.habitats!.find((h) => h.name === "Materials tent")!;
  await page
    .locator(".habitat-card")
    .filter({ hasText: "Robotics lab" })
    .click();
  await page.locator(".habitat-member select").selectOption(target.id);
  await expect.poll(() => tasks[2].habitatId).toBe(target.id);
  await page.reload();
  await expect(
    page.locator(".habitat-card").filter({ hasText: "Materials tent" }),
  ).toBeVisible();
  expect(projects[0].successes).toBe(2);
  for (const [width, height] of [
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("canvas")).toBeVisible();
    await page.screenshot({
      path: `.local/outpost-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  console.log(
    "OUTPOST_QA_PASS: districts, grouped domes, actual brick cycle, focus, rename/create/reassign, reload and responsive layouts; browser fixtures only",
  );
} catch (e) {
  await page.screenshot({ path: ".local/outpost-failure.png", fullPage: true });
  throw e;
} finally {
  await browser.close();
}
