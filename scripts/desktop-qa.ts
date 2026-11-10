import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { createServer } from "node:net";

const fixture = await mkdtemp(join(tmpdir(), "galaxi-desktop-qa-"));
await mkdir(join(fixture, "codex"));
await mkdir(join(fixture, "project"));
await writeFile(
  join(fixture, "project", "README.md"),
  "Sample desktop fixture only.\n",
);
const reservation = createServer();
reservation.listen(4310, "127.0.0.1");
await once(reservation, "listening");
await new Promise<void>((r) => reservation.close(() => r()));
const env: NodeJS.ProcessEnv = {
  ...process.env,
  CODEX_HOME: join(fixture, "codex"),
  NODE_OPTIONS: "",
  GALAXI_DESKTOP_TEST: "1",
  GALAXI_DESKTOP_TEST_DATA: join(fixture, "profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  executablePath: resolve(".local/desktop-release/win-unpacked/Galaxi.exe"),
  args: ["--user-data-dir=" + join(fixture, "profile")],
  env: Object.fromEntries(
    Object.entries(env).filter(
      (pair): pair is [string, string] => typeof pair[1] === "string",
    ),
  ),
  timeout: 60000,
});
try {
  expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(
    join(fixture, "profile"),
  );
  const page = await app.firstWindow({ timeout: 60000 });
  await expect(page).toHaveTitle("Galaxi — A place for your projects", {
    timeout: 60000,
  });
  await expect(
    page.getByRole("button", { name: "Sign in with ChatGPT", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => typeof (window as any).require)).toBe(
    "undefined",
  );
  const preferences = await app.evaluate(({ BrowserWindow }) =>
    (
      BrowserWindow.getAllWindows()[0].webContents as unknown as {
        getLastWebPreferences: () => {
          nodeIntegration: boolean;
          contextIsolation: boolean;
          sandbox: boolean;
        };
      }
    ).getLastWebPreferences(),
  );
  expect(preferences.nodeIntegration).toBe(false);
  expect(preferences.contextIsolation).toBe(true);
  expect(preferences.sandbox).toBe(true);
  await app.evaluate(
    ({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [directory],
      });
    },
    join(fixture, "project"),
  );
  await page
    .getByRole("button", { name: "Connect repository", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Choose project folder…", exact: true })
    .click();
  await expect(page.locator('input[name="path"]')).toHaveValue(
    join(fixture, "project"),
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({
    path: ".local/desktop-companion.png",
    fullPage: true,
  });
  const headers = await page.evaluate(async () =>
    (await fetch("/api/session")).headers.get("content-security-policy"),
  );
  expect(headers).toContain("script-src 'self'");
  console.log(
    "DESKTOP_QA_PASS: bundled server, sandboxed window, isolated unauthenticated Codex home, folder picker and CSP; no live sign-in or tasks",
  );
} finally {
  await app.close();
}
