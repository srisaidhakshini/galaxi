import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto("http://127.0.0.1:4310");
  await page
    .getByRole("button", { name: /QA Workshop/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Start task ↗" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Coding task" })
    .fill(
      "Read README.md and summarize it. Do not modify files. This is a disposable browser execution and cancellation test.",
    );
  await expect(page.getByRole("button", { name: "Start task ↗" })).toBeEnabled({
    timeout: 60000,
  });
  await page.getByRole("button", { name: "Start task ↗" }).click();
  await expect
    .poll(
      async () => {
        const s = await (
          await page.request.get("http://127.0.0.1:4310/api/state")
        ).json();
        return s.tasks.at(-1)?.workers?.[0]?.turnId;
      },
      { timeout: 60000 },
    )
    .toBeTruthy();
  const before = await (
    await page.request.get("http://127.0.0.1:4310/api/state")
  ).json();
  const id = before.tasks.at(-1).id;
  await page.screenshot({
    path: ".local/city-active-real.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Stop task" })).toBeVisible();
  const after = await (
    await page.request.get("http://127.0.0.1:4310/api/state")
  ).json();
  expect(after.tasks.at(-1).id).toBe(id);
  await page.getByRole("button", { name: "Stop task" }).click();
  await expect(page.locator(".task-summary .badge")).toContainText("cancelled");
  await page.waitForTimeout(1000);
  const stopped = await (
    await page.request.get("http://127.0.0.1:4310/api/state")
  ).json();
  expect(stopped.tasks.at(-1).awarded).toBe(false);
  expect(stopped.projects[0].successes).toBe(0);
  await page.screenshot({
    path: ".local/city-cancelled-real.png",
    fullPage: true,
  });
  console.log(
    "REAL_BROWSER_PASS: prompt to real lead, browser refresh preserves active turn, cancellation, no progression",
  );
} finally {
  await browser.close();
}
