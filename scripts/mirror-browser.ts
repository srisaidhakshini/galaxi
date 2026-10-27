import { chromium, expect } from "@playwright/test";
const threadId = process.env.CITY_WATCH_THREAD || process.env.CODEX_THREAD_ID;
if (!threadId)
  throw Error(
    "Set CITY_WATCH_THREAD to a chat already attached in the running City.",
  );
const b = await chromium.launch({ headless: true, channel: "msedge" }),
  p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
p.on("pageerror", (e) => errors.push(e.message));
try {
  await p.goto("http://127.0.0.1:4310");
  await expect
    .poll(
      async () => {
        const s = await (
          await p.request.get("http://127.0.0.1:4310/api/state")
        ).json();
        return s.observedChats?.some(
          (c: any) => c.threadId === threadId && c.connected,
        );
      },
      { timeout: 60000 },
    )
    .toBe(true);
  const s = await (
      await p.request.get("http://127.0.0.1:4310/api/state")
    ).json(),
    chat = s.observedChats.find((c: any) => c.threadId === threadId),
    project = s.projects.find((x: any) => x.id === chat.projectId);
  await p
    .locator(".project-nav")
    .filter({ hasText: project.name })
    .first()
    .click();
  await expect(p.locator(".watch-summary")).toBeVisible();
  await p
    .getByRole("button", { name: "◉ Watch Codex chat", exact: true })
    .click();
  await p.getByRole("textbox", { name: "Codex chat ID" }).fill(threadId);
  await p.getByRole("button", { name: "Watch this chat", exact: true }).click();
  await expect(
    p.getByRole("dialog", { name: "Watch a Codex chat" }),
  ).toHaveCount(0);
  expect(chat.prompt.length).toBeGreaterThan(0);
  await expect(p.locator(".watched-prompt")).toContainText(
    chat.prompt.slice(0, 80),
  );
  await expect(p.getByRole("textbox", { name: "Coding task" })).toHaveCount(0);
  await p.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(p.locator(".observed-item")).not.toHaveCount(0);
  await p.screenshot({
    path: ".local/current-chat-watching.png",
    fullPage: true,
  });
  await p.reload();
  await expect(p.locator(".watch-summary")).toBeVisible();
  const after = await (
    await p.request.get("http://127.0.0.1:4310/api/state")
  ).json();
  expect(after.tasks.length).toBe(s.tasks.length);
  expect(
    after.observedChats.filter((c: any) => c.threadId === threadId).length,
  ).toBe(1);
  await p.setViewportSize({ width: 390, height: 844 });
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "REAL_CHAT_WATCH_PASS",
    JSON.stringify({
      threadId: chat.threadId,
      project: project.name,
      promptMirrored: true,
      connected: chat.connected,
      state: chat.worker.status,
      activityTypes: [...new Set(chat.activity.map((a: any) => a.kind))],
      cityTasksCreated: after.tasks.length - s.tasks.length,
    }),
  );
} finally {
  await b.close();
}
