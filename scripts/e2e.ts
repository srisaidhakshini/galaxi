import { resolve, join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Controller } from "../server/controller.ts";
import { Store } from "../server/store.ts";
import { git } from "../server/git.ts";
import { terminal } from "../shared/domain.ts";
const root = resolve(".local/e2e-" + randomUUID());
await mkdir(root, { recursive: true });
await git(root, "init");
await writeFile(join(root, "README.md"), "Disposable Galaxi E2E fixture\n");
await writeFile(
  join(root, "verify.cjs"),
  "const fs=require('node:fs');for(const f of ['alpha.txt','beta.txt'])if(!fs.readFileSync(f,'utf8').trim().endsWith('City'))process.exit(1);console.log('Both outputs verified');\n",
);
await git(root, "add", ".");
await git(
  root,
  "-c",
  "user.name=Galaxi",
  "-c",
  "user.email=galaxi@localhost",
  "commit",
  "-m",
  "fixture",
);
const store = new Store(join(root, "..", "e2e-" + randomUUID() + ".sqlite"));
const controller = new Controller(store);
let last = 0;
controller.listeners.add(() => {
  for (const e of store.events(last)) {
    last = e.id;
    console.log(e.kind, e.workerId || "", e.message.slice(0, 300));
  }
});
try {
  await controller.connect();
  if (!store.state.runtime.authenticated)
    throw new Error(store.state.runtime.error || "Not authenticated");
  const p = await controller.addProject(root, "E2E fixture", [
    "node verify.cjs",
  ]);
  const t = await controller.start(
    p.id,
    "Create alpha.txt containing Alpha City and beta.txt containing Beta City. These are two independent outputs: assign each to a separate implementation worker with no dependencies so they can execute concurrently. Do not modify verify.cjs. No package installation needed.",
    2,
  );
  const deadline = Date.now() + 600000;
  while (!terminal(t.status) && Date.now() < deadline) {
    if (store.state.requests.length)
      throw new Error(
        "Genuine runtime request pending; not automatically approved: " +
          store.state.requests.map((r) => r.method).join(", "),
      );
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(
    "RESULT",
    JSON.stringify({
      status: t.status,
      error: t.error,
      workers: t.workers.map((w) => ({
        id: w.id,
        status: w.status,
        threadId: w.threadId,
      })),
      checks: t.checks,
      successes: p.successes,
      originalClean: !(await git(root, "status", "--porcelain")),
      workspace: t.workspace,
    }),
  );
  if (t.status !== "succeeded")
    throw new Error(t.error || "E2E did not succeed");
  if (p.successes !== 1) throw new Error("Incorrect progression");
  if (
    (await readFile(join(t.workspace, "alpha.txt"), "utf8")).trim() !==
    "Alpha City"
  )
    throw new Error("Missing result");
  await controller.apply(t.id);
  console.log(
    "APPLIED",
    t.applied,
    await readFile(join(root, "beta.txt"), "utf8"),
  );
} catch (e) {
  console.error("E2E_BLOCKER", String(e));
  process.exitCode = 1;
} finally {
  for (const t of store.state.tasks)
    if (!terminal(t.status)) await controller.cancel(t.id);
  controller.runtime.close();
  store.db.close();
}
