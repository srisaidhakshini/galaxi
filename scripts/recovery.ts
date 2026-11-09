import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { git } from "../server/git.ts";
const data = resolve(".local/recovery-" + randomUUID()),
  repo = join(data, "repository");
await mkdir(repo, { recursive: true });
await git(repo, "init");
await writeFile(join(repo, "README.md"), "Restart recovery fixture\n");
await git(repo, "add", ".");
await git(
  repo,
  "-c",
  "user.name=Galaxi",
  "-c",
  "user.email=galaxi@localhost",
  "commit",
  "-m",
  "fixture",
);
let child: ChildProcess | undefined,
  token = "",
  cookie = "";
const origin = "http://127.0.0.1:4321";
async function request(path: string, body?: unknown) {
  const r = await fetch(origin + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-City-Session": token,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (path === "/session") cookie = r.headers.get("set-cookie")!.split(";")[0];
  const result = await r.json();
  if (!r.ok) throw new Error(result.error);
  return result;
}
async function until(fn: () => Promise<boolean>, description: string) {
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Timed out: " + description);
}
async function boot() {
  child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts", "--production"],
    {
      cwd: resolve("."),
      env: { ...process.env, PORT: "4321", CITY_DATA_DIR: data },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (d) => process.stdout.write(d));
  await until(async () => {
    const s = await request("/session");
    token = s.token;
    return !!token;
  }, "production startup");
  await until(
    async () => !!(await request("/state")).runtime.authenticated,
    "runtime authentication",
  );
}
async function stop() {
  if (!child) return;
  const p = child;
  child = undefined;
  const done = new Promise((r) => p.once("close", r));
  p.kill("SIGKILL");
  await done;
}
try {
  await boot();
  const p = await request("/projects", {
    path: repo,
    name: "Recovery fixture",
    checks: ["git diff --check"],
  });
  const t = await request("/tasks", {
    projectId: p.id,
    prompt:
      "Read README.md and summarize it without changing files. This is a disposable controller-restart test.",
    concurrency: 1,
  });
  await until(
    async () =>
      !!(await request("/state")).tasks.find((x: any) => x.id === t.id)
        ?.workers[0]?.turnId,
    "real lead turn",
  );
  await stop();
  await boot();
  const recovered = await request("/state");
  assert.equal(recovered.tasks[0].id, t.id);
  assert.equal(recovered.tasks[0].status, "interrupted");
  assert.equal(recovered.tasks[0].awarded, false);
  assert.equal(recovered.projects[0].successes, 0);
  assert.equal(await git(repo, "status", "--porcelain"), "");
  console.log(
    "REAL_RECOVERY_PASS: production launch, real active lead, abrupt controller exit, interrupted reconciliation, original preserved, zero progression",
  );
} finally {
  await stop();
}
