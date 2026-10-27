import { chromium, expect as baseExpect } from "@playwright/test";
import type { Snapshot, Task, Worker } from "../shared/domain.ts";
const origin = "http://127.0.0.1:4310";
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const expect = baseExpect.configure({ timeout: 20000 });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/api/state*", (r) =>
    r.fulfill({
      json: {
        projects: [],
        tasks: [],
        events: [],
        requests: [],
        runtime: { connected: false, authenticated: false, mode: "real" },
      },
    }),
  );
  await page.goto(origin);
  await page.waitForTimeout(2500);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".empty-card")).toHaveCount(0);
  await expect(page.locator(".city-welcome")).toBeVisible();
  await page.screenshot({
    path: ".local/city-redesign-empty.png",
    fullPage: true,
  });
  for (const name of [
    "Zoom in",
    "Zoom out",
    "Rotate camera left",
    "Rotate camera right",
    "Top down view",
    "Reset city camera",
  ])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Orbit camera with drag" }).click();
  await expect(
    page.getByRole("button", { name: "Orbit camera with drag" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Pan camera with drag" }).click();
  // Browser-only fixtures exercise animation states; they never create runtime sessions or persisted tasks.
  const projects = Array.from({ length: 5 }, (_, i) => ({
    id: "fixture-" + i,
    name:
      [
        "Coral Studio",
        "Blue Harbor",
        "Golden Works",
        "Violet Labs",
        "Rose Tower",
      ][i] + " · Visual fixture",
    path: "/visual-fixture",
    plot: i,
    successes: i,
    checks: ["fixture only"],
  }));
  const workers: Worker[] = [
    "editing",
    "running commands",
    "waiting for approval",
    "completed",
  ].map((status, i) => ({
    id: "fixture-worker-" + i,
    threadId: "visual-only-" + i,
    role: i === 1 ? "Lead" : "Implementation",
    description: "Browser-only visual QA fixture",
    dependencies: [],
    expectedOutput: "Visual QA",
    workspace: "/visual-fixture/" + i,
    status,
    latest: "Visual fixture, no real execution",
  }));
  const task: Task = {
    id: "visual-task",
    projectId: projects[0].id,
    prompt: "Browser-only visual QA — no real execution",
    status: "running",
    createdAt: new Date().toISOString(),
    workspace: "/visual-fixture",
    base: "",
    branch: "",
    workers,
    checks: [],
    messages: [],
    diff: "",
    files: [],
    awarded: false,
    applied: false,
    concurrency: 2,
  };
  const state: Snapshot = {
    projects,
    tasks: [task],
    events: [],
    requests: [],
    runtime: {
      mode: "real",
      connected: false,
      authenticated: false,
      error: "Browser-only visual fixture",
    },
  };
  await page.unroute("**/api/state*");
  await page.route("**/api/state*", (r) => r.fulfill({ json: state }));
  await page.reload();
  await expect(page.locator(".plot-label")).toHaveCount(5);
  await expect(page.locator(".worker-state")).toHaveCount(4);
  await page.waitForTimeout(1500);
  const mover = page.locator(".worker-state").filter({ hasText: "editing" });
  const offDuty = page.locator('.worker-state[data-state="completed"]');
  const offBefore = await offDuty.boundingBox();
  const before = await mover.boundingBox();
  await page.waitForTimeout(1300);
  const after = await mover.boundingBox();
  const offAfter = await offDuty.boundingBox();
  expect(
    Math.hypot(offBefore!.x - offAfter!.x, offBefore!.y - offAfter!.y),
  ).toBeGreaterThan(2);
  await expect
    .poll(
      async () => {
        const now = await mover.boundingBox();
        return Math.abs(before!.x - now!.x) + Math.abs(before!.y - now!.y);
      },
      { timeout: 14000 },
    )
    .toBeGreaterThan(2);
  await page.screenshot({
    path: ".local/city-redesign-active-fixture.png",
    fullPage: true,
  });
  const actions = new Set<string>();
  const builder = page.locator('.worker-state[data-state="editing"]');
  for (let i = 0; i < 48; i++) {
    actions.add(
      ((await builder.getAttribute("data-action")) || "").toLowerCase(),
    );
    await page.waitForTimeout(500);
  }
  console.log("OBSERVED_CONSTRUCTION_ACTIONS", Array.from(actions));
  for (const action of [
    "pickup",
    "carrying materials",
    "placing",
    "hammering",
    "walking",
  ])
    expect(actions.has(action)).toBe(true);
  await page.getByRole("checkbox", { name: "Reduced motion" }).check();
  await page.waitForTimeout(1500);
  const frozen = await mover.boundingBox();
  await page.waitForTimeout(1000);
  const frozen2 = await mover.boundingBox();
  expect(
    Math.abs(frozen!.x - frozen2!.x) + Math.abs(frozen!.y - frozen2!.y),
  ).toBeLessThan(1);
  await page.locator(".plot-label").first().click();
  await expect(page.locator(".panel-title")).toContainText("Coral Studio");
  await page.screenshot({
    path: ".local/city-redesign-panel.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Focus building/ }).click();
  await page.getByRole("checkbox", { name: "Reduced motion" }).uncheck();
  await expect
    .poll(async () => await builder.getAttribute("data-action"), {
      timeout: 40000,
    })
    .toBe("hammering");
  await page
    .locator(".world")
    .screenshot({ path: ".local/workers-construction-closeup.png" });
  await page.getByRole("button", { name: "Close project" }).click();
  await page.getByRole("button", { name: "Simple view", exact: true }).click();
  await expect(page.locator(".simple-building")).toHaveCount(5);
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator(".plot-label")).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/city-redesign-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "CITY_VISUAL_QA_PASS: compact welcome, camera toolbar, five levels, moving real-state representations (browser fixtures), reduced motion, panel selection, simple toggle, mobile layout, zero page errors",
  );
} catch (e) {
  console.log("BROWSER_ERRORS", errors);
  await page.screenshot({
    path: ".local/city-redesign-qa-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
