import { chromium, expect } from "@playwright/test";
import { habitatFeatures } from "../shared/habitatGrowth.ts";
const project = {
  id: "visual-project",
  name: "Construction feature fixture",
  path: "/visual-fixture",
  plot: 0,
  successes: 0,
  checks: [],
};
const home = {
  id: "visual-dome",
  projectId: project.id,
  chatThreadId: "visual-chat",
  plot: 0,
  name: "Feature construction",
  createdAt: "2026-11-01",
  topics: [],
  constructionStage: 5,
  members: [] as any[],
};
const state = {
  projects: [project],
  tasks: [],
  requests: [],
  events: [],
  habitats: [home],
  runtime: { mode: "real", connected: false, authenticated: false },
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.addInitScript(() => {
    localStorage.setItem("city-project", "visual-project");
    localStorage.setItem("city-habitat", "visual-dome");
    localStorage.setItem("city-tab", "Habitats");
  });
  await page.route("**/api/state*", (r) => r.fulfill({ json: state }));
  for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 14]) {
    home.members = Array.from({ length: count }, (_, i) => ({
      id: "visual-chat/" + i,
      kind: "chat",
      threadId: "visual-chat",
      turnId: String(i),
      prompt: "Browser-only fixture prompt " + i,
      createdAt: "2026-11-01",
    }));
    if (count === 1) await page.goto("http://127.0.0.1:4310");
    else await page.reload();
    const label = page.locator(".habitat-label"),
      expected = habitatFeatures(count);
    await expect(label).toHaveAttribute(
      "data-building-stage",
      String(expected.stage),
    );
    await expect(label).toHaveAttribute(
      "data-glass-panels",
      String(expected.glassPanels),
    );
    for (const [feature, enabled] of Object.entries(expected).filter(
      ([k]) => !["stage", "glassPanels"].includes(k),
    )) {
      const actual = (await label.getAttribute("data-features"))!.split(",");
      expect(actual.includes(feature)).toBe(enabled);
    }
    await page.waitForTimeout(300);
    await page.mouse.move(10, 10);
    await page.screenshot({
      path: ".local/dome-features-" + count + ".png",
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  console.log(
    "DOME_FEATURES_PASS: base, frame, partial/full glass, door, windows, table, chairs and workstation across prompt counts; isolated visual fixture only",
  );
} finally {
  await browser.close();
}
