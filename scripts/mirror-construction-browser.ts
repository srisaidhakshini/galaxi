import { chromium, expect } from "@playwright/test";
const threadId = process.env.CITY_WATCH_THREAD || process.env.CODEX_THREAD_ID;
if (!threadId)
  throw Error(
    "Set CITY_WATCH_THREAD to the attached chat currently recording a real file edit.",
  );
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto("http://127.0.0.1:4310");
  await expect(page.locator(".watch-linkbar")).toBeVisible();
  await page.locator(".watch-linkbar").click();
  const worker = page.locator(`.worker-state[aria-label^="chat-${threadId}:"]`);
  await expect(worker).toHaveCount(1);
  await expect
    .poll(async () => worker.getAttribute("data-state"), { timeout: 20000 })
    .toBe("editing");
  await expect
    .poll(async () => Number(await worker.getAttribute("data-placed-bricks")), {
      timeout: 25000,
    })
    .toBeGreaterThan(0);
  await page
    .locator(".world")
    .screenshot({ path: ".local/current-chat-real-brickwork.png" });
  console.log(
    "REAL_CHAT_BRICKWORK_PASS: a recorded edit from the actual watched chat drove visible brick placement; no task was submitted",
  );
} finally {
  await browser.close();
}
