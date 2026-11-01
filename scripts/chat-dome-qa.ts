import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4310");
  await expect(page.locator(".find-crew")).toBeVisible();
  const state = await (
    await page.request.get("http://127.0.0.1:4310/api/state")
  ).json();
  for (const chat of state.observedChats || []) {
    const sites = state.habitats.filter(
      (h: any) =>
        h.projectId === chat.projectId && h.chatThreadId === chat.threadId,
    );
    expect(sites.length).toBe(1);
    expect(chat.habitatId).toBe(sites[0].id);
  }
  await page.locator(".find-crew").click();
  await expect(page.locator(".habitat-inspector")).toBeVisible();
  await expect(
    page
      .locator(".worker-state")
      .filter({ has: page.locator("span") })
      .first(),
  ).toBeAttached();
  await page.waitForTimeout(2000);
  await page.mouse.move(10, 10);
  await page.screenshot({ path: ".local/chat-dome-live.png", fullPage: true });
  await page.reload();
  await expect(page.locator(".find-crew")).toBeVisible();
  const after = await (
    await page.request.get("http://127.0.0.1:4310/api/state")
  ).json();
  expect(after.habitats.map((h: any) => h.id)).toEqual(
    state.habitats.map((h: any) => h.id),
  );
  expect(errors).toEqual([]);
  const galaxi = after.projects.find((p: any) => p.name === "galaxi");
  if (galaxi) {
    const listed = await (
      await page.request.get(
        `http://127.0.0.1:4310/api/projects/${galaxi.id}/chats`,
      )
    ).json();
    const homes = after.habitats.filter(
      (h: any) => h.projectId === galaxi.id && h.chatThreadId,
    );
    expect(homes.map((h: any) => h.chatThreadId).sort()).toEqual(
      listed.map((c: any) => c.id).sort(),
    );
    await page.locator(".project-nav").filter({ hasText: "galaxi" }).click();
    await page.getByRole("tab", { name: "Habitats", exact: true }).click();
    await page
      .locator(".habitat-card")
      .filter({ hasText: "Teach me tech concepts" })
      .click();
    await page.getByRole("tab", { name: "Chat", exact: true }).click();
    await expect(page.locator(".watched-prompt")).toContainText("teach me");
    await page
      .getByRole("button", { name: "Focus district", exact: false })
      .click();
    await page.waitForTimeout(1500);
    await page.mouse.move(10, 10);
    await page.screenshot({
      path: ".local/galaxi-two-chats.png",
      fullPage: true,
    });
  }
  console.log(
    "CHAT_DOME_QA_PASS: live one-dome-per-chat, crew focus and stable sites after reload; no tasks submitted",
  );
} finally {
  await browser.close();
}
