import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { git } from "../server/git.ts";
const repo = resolve(".local/ui-fixture");
await mkdir(repo, { recursive: true });
await git(repo, "init");
await writeFile(join(repo, "README.md"), "Browser QA fixture\n");
await writeFile(
  join(repo, "verify.cjs"),
  "console.log('QA fixture validation')\n",
);
await git(repo, "add", ".");
await git(
  repo,
  "-c",
  "user.name=Galaxi",
  "-c",
  "user.email=galaxi@localhost",
  "commit",
  "--allow-empty",
  "-m",
  "UI fixture",
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4310");
  await expect(
    page.getByRole("heading", { name: "Your projects, taking shape." }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  if (!(await page.getByRole("button", { name: /QA Workshop/ }).count())) {
    await page
      .getByRole("button", { name: "Connect repository", exact: false })
      .click();
    await page
      .getByRole("textbox", { name: "Project name" })
      .fill("QA Workshop");
    await page
      .getByRole("textbox", { name: "Absolute repository path" })
      .fill(repo);
    await page
      .getByRole("textbox", { name: "Required verification commands" })
      .fill("node verify.cjs");
    await page.getByRole("button", { name: "Connect repository →" }).click();
  } else {
    await page
      .getByRole("button", { name: /QA Workshop/ })
      .first()
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "QA Workshop", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("node verify.cjs", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: ".local/city-project.png", fullPage: true });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "QA Workshop", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Checks", exact: true }).click();
  await expect(page.locator(".check")).toContainText("node verify.cjs");
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(
    page.getByText("Changes from your tasks will appear here."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByText("Your project’s story starts with its first task."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close project" }).click();
  await page.getByRole("button", { name: "Reset city camera" }).click();
  const canvas = page.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (bounds) {
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 80,
      bounds.y + bounds.height / 2 + 30,
      { steps: 8 },
    );
    await page.mouse.up();
    await page.mouse.wheel(0, 100);
  }
  await page.getByRole("checkbox", { name: "Reduced motion" }).check();
  await page.getByRole("button", { name: "Simple view", exact: true }).click();
  await expect(page.locator(".simple-building")).toHaveCount(1);
  await page.locator(".simple-building").click();
  await expect(
    page.getByRole("heading", { name: "QA Workshop", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/city-simple.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".local/city-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "BROWSER_QA_PASS: connect, building, panel tabs, refresh, orbit/zoom/reset, reduced motion, simple view, mobile overflow, zero page errors",
  );
  // Same-origin and session defenses are tested without bypassing their middleware.
  const denied = await page.request.post("http://127.0.0.1:4310/api/projects", {
    headers: { Origin: "https://unrelated.example" },
    data: { path: repo },
  });
  expect(denied.status()).toBe(403);
  const noToken = await page.request.post(
    "http://127.0.0.1:4310/api/runtime/reconnect",
    { data: {} },
  );
  expect(noToken.status()).toBe(403);
  console.log("SECURITY_QA_PASS: cross-origin and missing CSRF token rejected");
} catch (e) {
  await page.screenshot({ path: ".local/city-qa-failure.png", fullPage: true });
  throw e;
} finally {
  await browser.close();
}
