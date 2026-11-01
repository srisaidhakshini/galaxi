import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4310");
  await page.locator(".project-nav").filter({ hasText: "galaxi" }).click();
  await page.getByRole("tab", { name: "Habitats", exact: true }).click();
  await page.locator(".habitat-card").first().click();
  await page
    .getByRole("button", { name: "Focus district", exact: false })
    .click();
  const surface = page.locator("[data-camera-surface]"),
    landmark = page.locator(".plot-label").filter({ hasText: "galaxi" });
  await expect(surface).toBeVisible();
  await page.waitForTimeout(1500);
  for (const key of ["w", "d", "ArrowUp", "ArrowLeft"]) {
    await surface.focus();
    const before = (await landmark.boundingBox())!;
    await page.keyboard.down(key);
    await page.waitForTimeout(450);
    await page.keyboard.up(key);
    await expect
      .poll(async () => {
        const b = (await landmark.boundingBox())!;
        return Math.hypot(b.x - before.x, b.y - before.y);
      })
      .toBeGreaterThan(2);
  }
  await page.mouse.move(20, 20);
  const input = page.getByRole("textbox", {
    name: "Habitat name",
    exact: true,
  });
  await input.focus();
  const before = (await landmark.boundingBox())!;
  await page.keyboard.type("wasd");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(400);
  const after = (await landmark.boundingBox())!;
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
  await page
    .getByRole("button", { name: "Focus district", exact: false })
    .click();
  await page.waitForTimeout(1000);
  await page.mouse.move(10, 10);
  await page.screenshot({ path: ".local/organic-village.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "VILLAGE_KEYS_PASS: WASD and arrows move the camera; typing stays in fields; no page errors; live read-only check",
  );
} finally {
  await browser.close();
}
