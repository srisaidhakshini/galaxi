import { chromium, expect } from "@playwright/test";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { Store } from "../server/store.ts";
import { createHabitat } from "../shared/habitats.ts";

const dataDir = await mkdtemp(join(tmpdir(), "city-pairing-browser-"));
const store = new Store(join(dataDir, "city.sqlite"));
store.state.projects.push({
  id: "pairing-project",
  name: "Pairing QA project",
  path: "/browser-only-fixture",
  plot: 0,
  successes: 0,
  checks: [],
});
const home = createHabitat(store.state, "pairing-project", "Pairing QA dome");
home.constructionStage = 2;
home.chatThreadId = "fixture-chat";
home.members = [
  {
    id: "fixture-chat/1",
    kind: "chat",
    threadId: "fixture-chat",
    turnId: "1",
    prompt: "Browser-only pairing fixture",
    createdAt: new Date().toISOString(),
  },
];
store.save();
store.db.close();
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = (reservation.address() as { port: number }).port;
await new Promise<void>((r) => reservation.close(() => r()));
const local = `http://127.0.0.1:${port}`;
const app = express();
app.use(express.static(resolve("dist")));
const hosted = app.listen(0, "127.0.0.1");
await once(hosted, "listening");
const requestedWebsite = process.env.PAIRING_WEBSITE_URL;
const website = requestedWebsite
  ? new URL(requestedWebsite).origin
  : "http://127.0.0.1:" + (hosted.address() as { port: number }).port;
if (requestedWebsite && !website.startsWith("https://"))
  throw Error("A deployed pairing test requires an HTTPS website.");
const child = spawn(
  process.execPath,
  ["--import", "tsx", "server/index.ts", "--production"],
  {
    cwd: resolve("."),
    env: {
      ...process.env,
      NODE_OPTIONS: "",
      PORT: String(port),
      CITY_DATA_DIR: dataDir,
      CITY_WATCH_THREAD: "",
      CODEX_BIN: join(dataDir, "nonexistent-codex.exe"),
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (b) => {
  output += b;
});
child.stderr.on("data", (b) => {
  output += b;
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
const localContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  remoteContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
const localPage = await localContext.newPage(),
  remotePage = await remoteContext.newPage();
const errors: string[] = [];
localPage.on("pageerror", (e) => errors.push(e.message));
remotePage.on("pageerror", (e) => errors.push(e.message));
const observedRequests: {
  url: string;
  authorization: boolean;
  cookie: boolean;
}[] = [];
remotePage.on("request", (request) => {
  if (request.url().startsWith(local + "/api/"))
    observedRequests.push({
      url: request.url(),
      authorization: !!request.headers().authorization,
      cookie: !!request.headers().cookie,
    });
});
try {
  if (requestedWebsite) {
    const cdp = await remoteContext.newCDPSession(remotePage);
    const { targetInfo } = await cdp.send("Target.getTargetInfo");
    let granted = false;
    for (const name of ["loopback-network", "local-network-access"]) {
      try {
        await cdp.send("Browser.setPermission", {
          permission: { name },
          setting: "granted",
          origin: website,
          browserContextId: targetInfo.browserContextId,
        });
        granted = true;
        break;
      } catch {}
    }
    if (!granted)
      throw Error(
        "Browser cannot grant loopback permission for this isolated HTTPS test.",
      );
  }
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error("Controller stopped: " + output);
    try {
      ready = (await fetch(local + "/api/session")).ok;
    } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  expect(ready).toBe(true);
  await localPage.goto(local);
  await localPage
    .getByRole("button", { name: "Browser connections", exact: true })
    .click();
  await localPage
    .getByRole("textbox", { name: "Website origin", exact: true })
    .fill(website);
  const issue = async () => {
    const response = localPage.waitForResponse(
      (r) =>
        r.url() === local + "/api/pairings/code" &&
        r.request().method() === "POST",
    );
    await localPage
      .getByRole("button", { name: "Generate pairing code", exact: true })
      .click();
    const result = await (await response).json();
    await expect(localPage.getByLabel("Generated pairing code")).toHaveText(
      result.code,
    );
    return result.code as string;
  };
  const code = await issue();
  await localPage.screenshot({
    path: ".local/pairing-local.png",
    fullPage: true,
  });
  await remotePage.goto(website);
  await expect(remotePage).toHaveTitle("Galaxi — A place for your projects");
  await expect(
    remotePage.getByRole("heading", { name: "Connect your village." }),
  ).toBeVisible();
  await expect(
    remotePage.getByRole("textbox", { name: "Companion address", exact: true }),
  ).toBeHidden();
  await remotePage.screenshot({
    path: ".local/pairing-connect-desktop.png",
    fullPage: true,
  });
  await remotePage.setViewportSize({ width: 390, height: 844 });
  expect(
    await remotePage.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await remotePage.screenshot({
    path: ".local/pairing-connect-mobile.png",
    fullPage: true,
  });
  await remotePage.setViewportSize({ width: 1440, height: 1000 });
  const pair = async (code: string) => {
    await remotePage
      .getByText("Manual connection with a code", { exact: true })
      .click();
    await remotePage.getByText("Advanced settings", { exact: true }).click();
    await remotePage
      .getByRole("textbox", { name: "Companion address", exact: true })
      .fill(local);
    await remotePage
      .getByRole("textbox", { name: "One-time pairing code", exact: true })
      .fill(code);
    await remotePage
      .getByRole("button", { name: "Pair this browser", exact: true })
      .click();
    await expect(remotePage.locator(".app.paired-readonly")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      remotePage.getByRole("link", { name: "Galaxi home" }),
    ).toContainText("galaxi");
  };
  await pair(code);
  await expect(
    remotePage.getByRole("button", {
      name: "Connect repository",
      exact: false,
    }),
  ).toBeDisabled();
  await expect(
    remotePage.getByRole("button", {
      name: "Browser connections",
      exact: true,
    }),
  ).toHaveCount(0);
  await remotePage
    .locator(".project-nav")
    .filter({ hasText: "Pairing QA project" })
    .click();
  await remotePage.getByRole("tab", { name: "Habitats", exact: true }).click();
  await expect(remotePage.locator(".new-habitat")).toHaveCount(0);
  await expect(remotePage.locator(".composer")).toHaveCount(0);
  const mutationStatus = await remotePage.evaluate(async (base) => {
    const saved = JSON.parse(sessionStorage.getItem("city-companion-pairing")!);
    return (
      await fetch(base + "/api/tasks", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + saved.token,
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    ).status;
  }, local);
  expect(mutationStatus).toBe(403);
  await remotePage.reload();
  await expect(remotePage.locator(".app.paired-readonly")).toBeVisible();
  await remotePage.screenshot({
    path: ".local/pairing-readonly.png",
    fullPage: true,
  });
  await remotePage.route(local + "/api/state*", (route) => route.abort());
  await expect(remotePage.locator(".top-status")).toContainText(
    "Reconnecting",
    { timeout: 12000 },
  );
  await remotePage.unroute(local + "/api/state*");
  await expect(remotePage.locator(".top-status")).toContainText(
    "Companion connected",
    { timeout: 12000 },
  );
  await expect(remotePage.locator(".error-banner")).toHaveCount(0);
  await remotePage.setViewportSize({ width: 390, height: 844 });
  expect(
    await remotePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await remotePage.screenshot({
    path: ".local/pairing-mobile.png",
    fullPage: true,
  });
  await expect(localPage.locator(".paired-browser")).toHaveCount(1, {
    timeout: 10000,
  });
  await localPage.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(
    remotePage.getByRole("heading", { name: "Connect your village." }),
  ).toBeVisible({ timeout: 15000 });
  await expect(remotePage.getByRole("status")).toContainText(
    "expired or revoked",
  );
  expect(
    await remotePage.evaluate(() =>
      sessionStorage.getItem("city-companion-pairing"),
    ),
  ).toBeNull();
  await pair(await issue());
  await remotePage
    .getByRole("button", { name: "Disconnect browser", exact: true })
    .click();
  await expect(
    remotePage.getByRole("heading", { name: "Connect your village." }),
  ).toBeVisible();
  // Approve prompt permission locally without copying a code. No model call is made.
  await remotePage
    .getByText("Manual connection with a code", { exact: true })
    .click();
  await remotePage.getByText("Advanced settings", { exact: true }).click();
  await remotePage
    .getByRole("textbox", { name: "Companion address", exact: true })
    .fill(local);
  const popupEvent = remotePage.waitForEvent("popup");
  await remotePage
    .getByRole("button", {
      name: "Already running from source? Connect in browser",
    })
    .click();
  const approval = await popupEvent;
  await expect(
    approval.getByRole("heading", { name: "Connect this browser?" }),
  ).toBeVisible();
  await expect(
    approval.getByRole("radio", { name: "View activity only", exact: true }),
  ).toBeChecked();
  await approval
    .getByRole("radio", { name: "View activity and send prompts", exact: true })
    .check();
  await approval
    .getByRole("button", { name: "Allow connection", exact: true })
    .click();
  await expect(remotePage.locator(".top-status")).toContainText(
    "Prompts enabled",
  );
  await remotePage
    .locator(".project-nav")
    .filter({ hasText: "Pairing QA project" })
    .click();
  await expect(remotePage.locator(".composer")).toBeVisible();
  await expect(
    remotePage.getByRole("button", {
      name: "Connect repository",
      exact: false,
    }),
  ).toBeDisabled();
  const permissionChecks = await remotePage.evaluate(async (base) => {
    const saved = JSON.parse(sessionStorage.getItem("city-companion-pairing")!);
    const statuses = [];
    for (const path of [
      "/tasks",
      "/projects",
      "/tasks/test/apply",
      "/requests/test",
      "/runtime/login",
    ]) {
      statuses.push(
        (
          await fetch(base + "/api" + path, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + saved.token,
              "Content-Type": "application/json",
            },
            body: "{}",
          })
        ).status,
      );
    }
    return statuses;
  }, local);
  expect(permissionChecks).toEqual([400, 403, 403, 403, 403]);
  await remotePage.reload();
  await expect(remotePage.locator(".top-status")).toContainText(
    "Prompts enabled",
  );
  await remotePage
    .getByRole("button", { name: "Disconnect browser", exact: true })
    .click();
  // The native companion returns to a new browser tab using a short-lived fragment.
  const nativeState = await remotePage.evaluate((base) => {
    const state = crypto.randomUUID();
    localStorage.setItem(
      "galaxi-connect-request:" + state,
      JSON.stringify({
        state,
        base,
        origin: location.origin,
        createdAt: Date.now(),
      }),
    );
    return state;
  }, local);
  const nativeCode = await issue();
  const callback =
    website +
    "/#galaxi-connect=" +
    encodeURIComponent(
      JSON.stringify({
        type: "galaxi-connect",
        state: nativeState,
        code: nativeCode,
      }),
    );
  const callbackPage = await remoteContext.newPage();
  await callbackPage.goto(callback);
  await expect(callbackPage.locator(".top-status")).toContainText(
    "Read-only paired browser",
  );
  expect(new URL(callbackPage.url()).hash).toBe("");
  const replay = await remoteContext.newPage();
  await replay.goto(callback);
  await expect(replay.getByRole("status")).toContainText(
    "connection request expired",
  );
  await expect(replay.locator(".app")).toHaveCount(0);
  expect(new URL(replay.url()).hash).toBe("");
  await callbackPage.close();
  await replay.close();
  expect(observedRequests.some((r) => r.authorization)).toBe(true);
  expect(
    observedRequests.every(
      (r) => !r.cookie && !new URL(r.url).searchParams.has("token"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "PAIRING_BROWSER_PASS: " +
      website +
      " → isolated companion; local approval, read-only UI/API, reload, recovery, revocation, re-pairing, disconnect and mobile layout; no real agents or user data",
  );
} catch (e) {
  await remotePage.screenshot({
    path: ".local/pairing-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  hosted.closeAllConnections();
  await new Promise<void>((r) => hosted.close(() => r()));
  const exited =
    child.exitCode === null ? once(child, "exit") : Promise.resolve();
  if (child.exitCode === null) child.kill();
  await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
