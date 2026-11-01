import { chromium, expect as baseExpect } from "@playwright/test";
import type { Snapshot } from "../shared/domain.ts";
const expect = baseExpect.configure({ timeout: 20000 });
const projects = Array.from({ length: 4 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  name: ["Harbor Studio", "Atlas Notes", "Pocket Garden", "Violet Labs"][i],
  path: "/visual-qa/" + i,
  plot: i,
  successes: i,
  checks: ["npm test"],
}));
const fixture: Snapshot = {
  projects,
  tasks: [],
  requests: [],
  events: [],
  runtime: { connected: true, authenticated: true, mode: "real" },
  observedChats: [
    {
      threadId: "00000000-0000-4000-9000-000000000001",
      projectId: projects[0].id,
      name: "Build a better project workspace",
      prompt:
        "Improve the project dashboard and make the activity stream easier to read.",
      connected: true,
      checkedAt: new Date().toISOString(),
      worker: {
        id: "qa-worker",
        threadId: "visual-qa",
        role: "Codex chat",
        description: "Browser-only UI fixture",
        dependencies: [],
        workspace: "/visual-qa",
        expectedOutput: "Visual QA",
        status: "editing",
        latest: "Updating dashboard components",
      },
      activity: [
        {
          id: "u",
          kind: "userMessage",
          message: "Improve the project dashboard.",
        },
        {
          id: "a",
          kind: "agentMessage",
          message:
            "The dashboard now has a clearer project list and more readable activity. I’m checking the responsive layout next.",
        },
        {
          id: "f",
          kind: "fileChange",
          message: "Changed: src/Dashboard.tsx",
          status: "completed",
          output: "- old layout\n+ clearer dashboard",
        },
        {
          id: "c",
          kind: "commandExecution",
          message: "npm run build",
          status: "completed",
          output: "Build completed successfully.",
        },
      ],
    },
  ],
};
let snapshot = fixture;
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/api/state*", (r) => r.fulfill({ json: snapshot }));
  await page.goto("http://127.0.0.1:4310");
  await expect(page.locator(".watch-linkbar")).toBeVisible();
  await page.locator(".watch-linkbar").click();
  await expect(page.locator(".watch-summary")).toBeVisible();
  await expect(page.locator(".watched-prompt")).toContainText(
    "Improve the project dashboard",
  );
  expect(
    await page
      .locator(".watched-prompt p")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(12);
  await page.screenshot({
    path: ".local/ui-polish-desktop.png",
    fullPage: true,
  });
  const panel = page.locator(".detail-panel"),
    separator = page.getByRole("separator", { name: "Resize project panel" });
  const before = (await panel.boundingBox())!.width;
  await separator.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  expect((await panel.boundingBox())!.width).toBeGreaterThan(before + 25);
  await page.reload();
  await expect(page.locator(".watch-summary")).toBeVisible();
  expect((await panel.boundingBox())!.width).toBeGreaterThan(before + 25);
  const bounds = (await separator.boundingBox())!;
  await page.mouse.move(bounds.x + 3, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 35, bounds.y + 100, { steps: 8 });
  await page.mouse.up();
  expect((await panel.boundingBox())!.width).toBeGreaterThan(before + 50);
  await separator.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(page.locator(".watched-prompt")).toHaveCount(0);
  await expect(page.locator(".command-card")).toHaveCount(1);
  await expect(page.locator(".command-card[open]")).toHaveCount(0);
  await page.locator(".command-card>summary").click();
  await expect(page.locator(".command-card[open]")).toHaveCount(1);
  await page.screenshot({
    path: ".local/ui-polish-activity.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.locator(".observed-item.fileChange")).toContainText(
    "src/Dashboard.tsx",
  );
  await page
    .getByRole("button", { name: "Separate City task", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Coding task" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Watch Codex", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Coding task" })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Connect repository", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({
    path: ".local/ui-polish-laptop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".detail-panel")).toBeVisible();
  await page.screenshot({
    path: ".local/ui-polish-mobile.png",
    fullPage: true,
  });
  snapshot = { ...fixture, projects: [], observedChats: [] };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(page.locator(".city-welcome")).toBeVisible();
  await page.screenshot({ path: ".local/ui-polish-empty.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "UI_QA_PASS: desktop/laptop/mobile, keyboard and pointer resize, persisted width, collapsed commands, mode switching, Escape dismissal, no overflow or page errors; browser fixtures only",
  );
} catch (e) {
  console.log("PAGE_ERRORS", errors);
  await page.screenshot({
    path: ".local/ui-polish-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
