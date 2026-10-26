import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Store } from "../server/store.ts";
import { Controller } from "../server/controller.ts";
import { Codex } from "../server/codex.ts";
import { git } from "../server/git.ts";
import {
  transition,
  validatePlan,
  canSucceed,
  level,
  terminal,
  type Task,
} from "../shared/domain.ts";
function task(): Task {
  return {
    id: randomUUID(),
    projectId: "p",
    prompt: "test",
    status: "checking",
    createdAt: new Date().toISOString(),
    workspace: "",
    branch: "",
    base: "",
    workers: [
      {
        id: "lead",
        role: "Lead",
        description: "",
        dependencies: [],
        expectedOutput: "",
        workspace: "",
        status: "completed",
        latest: "",
      },
    ],
    checks: [{ command: "test", cwd: "", status: "passed" }],
    messages: [],
    diff: "",
    files: [],
    awarded: false,
    applied: false,
    concurrency: 2,
  };
}
function temp() {
  return resolve(".local/tests", randomUUID());
}
test("lifecycle rejects invalid and late terminal transitions", () => {
  const t = task();
  assert.throws(() => transition(t, "planning"));
  transition(t, "succeeded");
  assert.throws(() => transition(t, "running"));
  transition(t, "succeeded");
});
test("completion requires observed checks and all required workers", () => {
  const t = task();
  assert.ok(canSucceed(t));
  t.checks = [];
  assert.ok(!canSucceed(t));
  t.checks = [{ command: "x", cwd: "", status: "failed" }];
  assert.ok(!canSucceed(t));
  t.checks[0].status = "passed";
  t.workers[0].status = "queued";
  assert.ok(!canSucceed(t));
  t.workers = [];
  assert.ok(!canSucceed(t));
});
test("dependency validation rejects cycles, missing and duplicate IDs", () => {
  validatePlan([
    { id: "a", dependencies: [] },
    { id: "b", dependencies: ["a"] },
  ]);
  assert.throws(() =>
    validatePlan([
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["a"] },
    ]),
  );
  assert.throws(() => validatePlan([{ id: "a", dependencies: ["missing"] }]));
  assert.throws(() =>
    validatePlan([
      { id: "a", dependencies: [] },
      { id: "a", dependencies: [] },
    ]),
  );
});
test("five levels retain top level beyond modeled progression", () =>
  assert.deepEqual([0, 1, 2, 3, 4, 100].map(level), [1, 2, 3, 4, 5, 5]));
test("transactional awards resist duplicate delivery and survive restart", () => {
  const path = join(temp(), "city.sqlite");
  const s = new Store(path);
  s.state.projects.push({
    id: "p",
    name: "p",
    path: "",
    plot: 0,
    successes: 0,
    checks: ["test"],
  });
  const t = task();
  s.state.tasks.push(t);
  s.succeed(t);
  assert.equal(s.state.projects[0].successes, 1);
  t.status = "checking";
  s.succeed(t);
  assert.equal(s.state.projects[0].successes, 1);
  s.db.close();
  const recovered = new Store(path);
  assert.equal(recovered.state.projects[0].successes, 1);
  assert.equal(recovered.state.tasks[0].awarded, true);
  recovered.db.close();
});
test("restart interrupts uncertain work and clears expired requests", () => {
  const path = join(temp(), "city.sqlite");
  const s = new Store(path),
    t = task();
  t.status = "running";
  s.state.tasks.push(t);
  s.save();
  s.event(t.id, "test", "replay me");
  s.db.close();
  const r = new Store(path);
  assert.equal(r.state.tasks[0].status, "interrupted");
  assert.equal(r.events()[0].message, "replay me");
  assert.equal(r.events(r.events()[0].id).length, 0);
  assert.deepEqual(r.state.requests, []);
  r.db.close();
});
class FakeCodex extends Codex {
  override ready = false;
  threads = new Map<string, string>();
  active = 0;
  maxActive = 0;
  replies: any[] = [];
  failWorker = false;
  delay = 20;
  dependent = false;
  conflict = false;
  override async connect() {
    this.ready = true;
  }
  override async call(method: string, p: any): Promise<any> {
    if (method === "account/read")
      return { account: { type: "test" }, requiresOpenaiAuth: false };
    if (method === "thread/start") {
      const id = randomUUID();
      this.threads.set(id, p.cwd);
      return { thread: { id } };
    }
    if (method === "turn/interrupt") return {};
    if (method === "turn/steer") return {};
    if (method === "turn/start") {
      const turn = randomUUID();
      const impl =
        !p.outputSchema &&
        !p.input[0].text.includes("All assigned worker results");
      if (impl) {
        this.active++;
        this.maxActive = Math.max(this.active, this.maxActive);
      }
      setTimeout(async () => {
        try {
          let text = "Reviewed integrated outputs";
          if (p.outputSchema)
            text = JSON.stringify({
              summary: "Two independent outputs",
              subtasks: [
                {
                  id: "a",
                  description: "Make a",
                  dependencies: [],
                  expectedOutput: "a.txt",
                },
                {
                  id: "b",
                  description: "Make b",
                  dependencies: this.dependent ? ["a"] : [],
                  expectedOutput: "b.txt",
                },
              ],
            });
          else if (impl) {
            const name = p.input[0].text.includes("Your assignment: Make a")
              ? "a"
              : "b";
            if (this.dependent && name === "b")
              assert.equal(
                await readFile(
                  join(this.threads.get(p.threadId)!, "a.txt"),
                  "utf8",
                ),
                "a",
              );
            await writeFile(
              join(
                this.threads.get(p.threadId)!,
                this.conflict ? "shared.txt" : name + ".txt",
              ),
              name,
            );
            text = "Created " + name;
            this.active--;
          }
          this.emit("message", {
            method: "item/completed",
            params: {
              threadId: p.threadId,
              item: { id: randomUUID(), type: "agentMessage", text },
            },
          });
          this.emit("message", {
            method: "turn/completed",
            params: {
              threadId: p.threadId,
              turn: {
                id: turn,
                status: this.failWorker && impl ? "failed" : "completed",
                error: this.failWorker ? { message: "Worker failed" } : null,
              },
            },
          });
        } catch (e) {
          this.emit("message", {
            method: "turn/completed",
            params: {
              threadId: p.threadId,
              turn: {
                id: turn,
                status: "failed",
                error: { message: String(e) },
              },
            },
          });
        }
      }, this.delay);
      return { turn: { id: turn } };
    }
    throw new Error("Unexpected " + method);
  }
  override reply(id: any, result: any) {
    this.replies.push({ id, result });
  }
}
async function fixture(check = "node verify.cjs") {
  const root = temp();
  await mkdir(root, { recursive: true });
  await git(root, "init");
  await writeFile(
    join(root, "verify.cjs"),
    "const fs=require('fs');if(!fs.existsSync('a.txt')||!fs.existsSync('b.txt'))process.exit(1);console.log('verified');",
  );
  await git(root, "add", ".");
  await git(
    root,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@localhost",
    "commit",
    "-m",
    "fixture",
  );
  const s = new Store(join(temp(), "city.sqlite"));
  const c = new Controller(s),
    fake = new FakeCodex();
  c.runtime = fake;
  fake.on("message", (m) => c.onMessage(m));
  await c.connect();
  const p = await c.addProject(root, "Fixture", [check]);
  return { root, s, c, fake, p };
}
async function finished(t: Task) {
  const until = Date.now() + 30000;
  while (!terminal(t.status) && t.status !== "waiting" && Date.now() < until)
    await new Promise((r) => setTimeout(r, 30));
  assert.ok(terminal(t.status) || t.status === "waiting", "Task timed out");
}
test("isolated concurrent workers integrate, pass checks, award once and explicitly apply", async () => {
  const { root, s, c, fake, p } = await fixture();
  const original = await git(root, "rev-parse", "HEAD");
  const t = await c.start(p.id, "Implement two outputs", 2);
  await finished(t);
  assert.equal(t.status, "succeeded", t.error);
  assert.equal(fake.maxActive, 2);
  assert.equal(p.successes, 1);
  assert.equal(await git(root, "rev-parse", "HEAD"), original);
  assert.equal(await git(root, "status", "--porcelain"), "");
  assert.equal(await readFile(join(t.workspace, "a.txt"), "utf8"), "a");
  assert.equal(t.checks[0].status, "passed");
  await c.apply(t.id);
  assert.equal(t.applied, true);
  assert.equal(await readFile(join(root, "b.txt"), "utf8"), "b");
  s.db.close();
});
test("failed required check prevents success and upgrade", async () => {
  const { s, c, p } = await fixture('node -e "process.exit(3)"');
  const t = await c.start(p.id, "Fail checks");
  await finished(t);
  assert.equal(t.status, "failed");
  assert.notEqual(t.checks[0].exitCode, 0);
  assert.equal(p.successes, 0);
  assert.equal(t.awarded, false);
  s.db.close();
});
test("failed worker stops completion", async () => {
  const { s, c, fake, p } = await fixture();
  fake.failWorker = true;
  const t = await c.start(p.id, "Worker failure");
  await finished(t);
  assert.equal(t.status, "failed");
  assert.equal(p.successes, 0);
  assert.ok(t.checks.every((c) => c.status === "pending"));
  s.db.close();
});
test("cancelled work ignores late runtime completion", async () => {
  const { s, c, fake, p } = await fixture();
  fake.delay = 150;
  const t = await c.start(p.id, "Cancel");
  while (!t.workers[0]?.turnId) await new Promise((r) => setTimeout(r, 10));
  await c.cancel(t.id);
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(t.status, "cancelled");
  assert.equal(p.successes, 0);
  assert.equal(t.awarded, false);
  s.db.close();
});
test("approval routes by live request and does not auto grant", async () => {
  const { s, c, fake, p } = await fixture();
  fake.delay = 300;
  const t = await c.start(p.id, "Approval");
  while (!t.workers[0]?.turnId) await new Promise((r) => setTimeout(r, 10));
  const w = t.workers[0];
  fake.emit("message", {
    id: 400,
    method: "item/commandExecution/requestApproval",
    params: {
      threadId: w.threadId,
      turnId: w.turnId,
      command: "example",
      reason: "Test approval",
    },
  });
  assert.equal(fake.replies.length, 0);
  assert.equal(s.state.requests.length, 1);
  await c.answer(s.state.requests[0].id, { decision: "decline" });
  assert.deepEqual(fake.replies[0], {
    id: 400,
    result: { decision: "decline" },
  });
  assert.equal(s.state.requests.length, 0);
  await c.cancel(t.id);
  await assert.rejects(() => c.answer("expired", { decision: "accept" }));
  await new Promise((r) => setTimeout(r, 350));
  s.db.close();
});
test("dirty original repository is preserved and execution refused", async () => {
  const { root, s, c, p } = await fixture();
  await writeFile(join(root, "user-work.txt"), "precious");
  await assert.rejects(() => c.start(p.id, "No overwrite"), /uncommitted/);
  assert.equal(await readFile(join(root, "user-work.txt"), "utf8"), "precious");
  assert.equal(s.state.tasks.length, 0);
  s.db.close();
});
test("dependency outputs are present before dependent worker starts", async () => {
  const { s, c, fake, p } = await fixture();
  fake.dependent = true;
  const t = await c.start(p.id, "Dependent outputs", 2);
  await finished(t);
  assert.equal(t.status, "succeeded", t.error);
  assert.equal(fake.maxActive, 1);
  s.db.close();
});
test("configured single-worker limit is enforced", async () => {
  const { s, c, fake, p } = await fixture();
  const t = await c.start(p.id, "Serial outputs", 1);
  await finished(t);
  assert.equal(t.status, "succeeded", t.error);
  assert.equal(fake.maxActive, 1);
  s.db.close();
});
test("integration conflict blocks checks and preserves both worker worktrees", async () => {
  const { s, c, fake, p } = await fixture();
  fake.conflict = true;
  const t = await c.start(p.id, "Conflicting outputs", 2);
  await finished(t);
  assert.equal(t.status, "waiting");
  assert.match(t.error!, /conflict/i);
  assert.equal(p.successes, 0);
  assert.ok(t.checks.every((c) => c.status === "pending"));
  assert.equal(
    await readFile(join(t.workers[1].workspace, "shared.txt"), "utf8"),
    "a",
  );
  assert.equal(
    await readFile(join(t.workers[2].workspace, "shared.txt"), "utf8"),
    "b",
  );
  assert.match(await git(t.workspace, "status", "--porcelain"), /UU|AA/);
  await c.cancel(t.id);
  s.db.close();
});
test("duplicate items and out-of-order completion events cannot finish an active turn", async () => {
  const { s, c, fake, p } = await fixture();
  fake.delay = 350;
  const t = await c.start(p.id, "Event ordering");
  while (!t.workers[0]?.turnId) await new Promise((r) => setTimeout(r, 10));
  const w = t.workers[0];
  const item = {
    method: "item/completed",
    params: {
      threadId: w.threadId,
      turnId: w.turnId,
      item: { id: "repeat", type: "agentMessage", text: "Observed event" },
    },
  };
  fake.emit("message", item);
  fake.emit("message", item);
  assert.equal(t.messages.filter((m) => m.text === "Observed event").length, 1);
  fake.emit("message", {
    method: "turn/completed",
    params: {
      threadId: w.threadId,
      turn: { id: "unrelated-old-turn", status: "completed" },
    },
  });
  assert.ok(c.runs.has(w.threadId!));
  await c.cancel(t.id);
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(t.status, "cancelled");
  assert.equal(p.successes, 0);
  s.db.close();
});
