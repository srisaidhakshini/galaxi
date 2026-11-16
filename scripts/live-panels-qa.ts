import { chromium, expect as baseExpect } from "@playwright/test";
import type { Snapshot, ObservedChat, Habitat } from "../shared/domain.ts";

const origin = process.env.CITY_QA_ORIGIN || "http://127.0.0.1:4320";
const expect = baseExpect.configure({ timeout: 15000 });
const at = new Date().toISOString();
const house = (id: string, plot: number): Habitat => ({
  id,
  projectId: "village",
  name: `${id} house`,
  plot,
  createdAt: at,
  topics: [],
  chatThreadId: id,
  constructionStage: 5,
  members: [
    {
      id: `${id}/latest`,
      kind: "chat",
      prompt: `${id} request`,
      createdAt: at,
      threadId: id,
      turnId: "latest",
    },
  ],
});
const chat = (id: string): ObservedChat => ({
  threadId: id,
  habitatId: id,
  projectId: "village",
  name: `${id} conversation`,
  turnId: "latest",
  prompt: `${id} request`,
  connected: true,
  checkedAt: at,
  worker: {
    id,
    threadId: id,
    role: "Codex chat",
    description: "Browser fixture",
    dependencies: [],
    expectedOutput: "Fixture only",
    workspace: "/fixture",
    status: "editing",
    latest: "Recorded edit",
  },
  activity: [
    { id: "u", kind: "userMessage", message: `${id} request` },
    { id: "a", kind: "agentMessage", message: `${id} initial response` },
    {
      id: "f",
      kind: "fileChange",
      message: `Changed: ${id}.tsx`,
      output: "+ first edit",
      status: "completed",
    },
    {
      id: "c",
      kind: "commandExecution",
      message: "npm run build",
      status: "inProgress",
    },
  ],
  history: [
    {
      id: "latest",
      prompt: `${id} request`,
      status: "inProgress",
      startedAt: at,
      messages: [],
    },
    {
      id: "older",
      prompt: `${id} earlier request`,
      status: "completed",
      startedAt: at,
      messages: [
        { id: "old-u", kind: "userMessage", message: `${id} earlier request` },
      ],
    },
  ],
});
const snapshot: Snapshot = {
  projects: [
    {
      id: "village",
      name: "Willow Village",
      path: "/browser-fixture",
      plot: 0,
      successes: 0,
      checks: ["npm test"],
    },
  ],
  tasks: [],
  requests: [],
  events: [],
  habitats: [house("alpha", 0), house("beta", 1), house("stopped", 2)],
  observedChats: [chat("alpha"), chat("beta")],
  runtime: { connected: true, authenticated: true, mode: "real" },
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [],
  writes: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.addInitScript(() => {
    localStorage.setItem("city-project", "village");
    localStorage.setItem("city-habitat", "alpha");
    localStorage.setItem("city-tab", "Chat");
    localStorage.setItem("city-motion", "reduced");
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET") {
      writes.push(url.pathname);
      await route.fulfill({
        status: 403,
        json: { error: "Fixture must not mutate data" },
      });
      return;
    }
    if (url.pathname === "/api/state") {
      await route.fulfill({ json: snapshot });
      return;
    }
    if (url.pathname === "/api/events") {
      await route.fulfill({
        contentType: "text/event-stream",
        body: "event: update\ndata: {}\n\n",
      });
      return;
    }
    if (url.pathname.endsWith("/turns/older")) {
      await route.fulfill({
        json: {
          turnId: "older",
          activity: [
            {
              id: "archived",
              kind: "agentMessage",
              message: "Archived alpha response",
            },
            {
              id: "old-check",
              kind: "commandExecution",
              message: "npm test",
              status: "completed",
              exitCode: 0,
              output: "Historical checks passed",
            },
          ],
        },
      });
      return;
    }
    await route.continue();
  });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  const alpha = snapshot.observedChats![0];
  await expect(page.locator(".watched-chat")).toHaveAttribute(
    "data-thread-id",
    "alpha",
  );
  await expect(page.locator(".observed-item.agentMessage")).toContainText(
    "alpha initial response",
  );
  alpha.activity.push({
    id: "a2",
    kind: "agentMessage",
    message: "Live response received without reload",
  });
  await expect(
    page.locator(".observed-item.agentMessage").last(),
  ).toContainText("Live response received without reload");
  alpha.activity.push({
    id: "long-answer",
    kind: "agentMessage",
    message:
      "A detailed live response with enough text to exercise conversation scrolling. ".repeat(
        30,
      ),
  });
  await expect(
    page.locator(".observed-item.agentMessage").last(),
  ).toContainText("exercise conversation scrolling");
  await expect(
    page.locator(".observed-item.agentMessage").last(),
  ).toBeInViewport();
  await page.locator(".panel-content").evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });
  alpha.activity.push({
    id: "while-reading",
    kind: "agentMessage",
    message: "Update while reading older messages",
  });
  await expect(
    page.locator(".observed-item.agentMessage").last(),
  ).toContainText("Update while reading older messages");
  expect(
    await page.locator(".panel-content").evaluate((el) => el.scrollTop),
  ).toBeLessThan(10);
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  alpha.activity.push({
    id: "live-tool",
    kind: "mcpToolCall",
    message: "Search · refreshed evidence",
    status: "completed",
  });
  await expect(page.locator(".observed-item.mcpToolCall")).toContainText(
    "refreshed evidence",
  );
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  alpha.activity.push({
    id: "f2",
    kind: "fileChange",
    message: "Changed: live-update.tsx",
    status: "completed",
    output: "+ live patch",
  });
  await expect(page.locator(".observed-item.fileChange").first()).toContainText(
    "live-update.tsx",
  );
  await expect(page.locator(".command-card")).toHaveCount(0);
  await page.getByRole("tab", { name: "Checks", exact: true }).click();
  const check = alpha.activity.find((a) => a.id === "c")!;
  check.status = "completed";
  check.exitCode = 1;
  check.output = "A real check failure";
  await expect(page.locator(".command-card .badge")).toContainText(
    "failed · exit 1",
  );
  await page.locator(".command-card > summary").click();
  await page.getByText("Command output", { exact: true }).click();
  await expect(page.locator(".command-card")).toContainText(
    "A real check failure",
  );
  check.exitCode = 0;
  check.output = "Updated check output";
  await expect(page.locator(".command-card .badge")).toContainText(
    "completed · exit 0",
  );
  await expect(page.locator(".command-card[open]")).toContainText(
    "Updated check output",
  );
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.locator(".recorded-history .history-item")).toHaveCount(2);
  alpha.history!.unshift({
    id: "new-turn",
    prompt: "A newly recorded request",
    status: "inProgress",
    startedAt: at,
    messages: [],
  });
  await expect(page.locator(".recorded-history .history-item")).toHaveCount(3);
  await page.getByRole("button", { name: /alpha earlier request/ }).click();
  await expect(page.locator(".observed-item.agentMessage")).toContainText(
    "Archived alpha response",
  );
  await page.getByRole("tab", { name: "Checks", exact: true }).click();
  await expect(page.locator(".command-card .badge")).toContainText("exit 0");
  await page.getByRole("button", { name: "Return to latest turn →" }).click();
  await expect(
    page.getByRole("combobox", { name: "Recorded turn" }),
  ).toHaveValue("");
  // Switch houses through the management list; the selected source must change too.
  await page.getByRole("tab", { name: "Habitats", exact: true }).click();
  await page.locator(".habitat-card").filter({ hasText: "beta house" }).click();
  await expect(page.locator(".watched-chat")).toHaveAttribute(
    "data-thread-id",
    "beta",
  );
  await expect(page.locator(".observed-item.agentMessage")).toContainText(
    "beta initial response",
  );
  await expect(page.locator(".watched-chat")).not.toContainText(
    "alpha initial response",
  );
  snapshot.observedChats![1].checkedAt = new Date(
    Date.now() - 60000,
  ).toISOString();
  await expect(page.locator(".watch-summary")).toContainText("Updates delayed");
  snapshot.observedChats![1].connected = false;
  snapshot.observedChats![1].error = "Fixture connection dropped";
  await expect(page.locator(".watch-summary")).toContainText("Disconnected");
  await expect(page.locator(".watch-summary [role=alert]")).toContainText(
    "connection dropped",
  );
  await page.getByRole("tab", { name: "Habitats", exact: true }).click();
  await page
    .locator(".habitat-card")
    .filter({ hasText: "stopped house" })
    .click();
  await expect(page.locator(".watched-chat")).toHaveCount(0);
  await expect(page.locator(".panel-empty")).toContainText("not connected");
  await expect(page.getByRole("textbox", { name: "Coding task" })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Close project", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reset city camera", exact: true })
    .click();
  await page.screenshot({
    path: ".local/village-square-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/village-square-mobile.png",
    fullPage: true,
  });
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  console.log(
    "LIVE_PANELS_PASS: all five tabs update without reload; historical turn inspection, retained open output, selected-house isolation, stale/disconnected indicators, and responsive layout; browser fixtures only, no mutations.",
  );
} catch (error) {
  await page.screenshot({
    path: ".local/live-panels-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
