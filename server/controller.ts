import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { Codex, textInput, type RpcMessage } from "./codex.ts";
import { Store } from "./store.ts";
import { assignTaskHabitat } from "../shared/habitats.ts";
import * as git from "./git.ts";
import {
  terminal,
  transition,
  validatePlan,
  type Task,
  type Worker,
  type PendingRequest,
} from "../shared/domain.ts";
const Plan = z.object({
  summary: z.string(),
  subtasks: z
    .array(
      z.object({
        id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
        description: z.string(),
        dependencies: z.array(z.string()),
        expectedOutput: z.string(),
      }),
    )
    .min(1)
    .max(8),
});
const planSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    subtasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          dependencies: { type: "array", items: { type: "string" } },
          expectedOutput: { type: "string" },
        },
        required: ["id", "description", "dependencies", "expectedOutput"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "subtasks"],
  additionalProperties: false,
};
const safety =
  "Work only in the supplied isolated workspace. Do not spawn subagents, create worktrees, commit, switch branches, merge, or change the original checkout. The controller owns delegation and Git integration. Do not modify validation to hide failures. Never expose credentials. Follow repository instructions. If blocked explain why.";
export class Controller {
  runtime = new Codex();
  abort = new Map<string, AbortController>();
  completedTurns = new Set<string>();
  seenItems = new Set<string>();
  starting = new Set<string>();
  listeners = new Set<() => void>();
  runs = new Map<
    string,
    {
      task: Task;
      worker: Worker;
      resolve: (text: string) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
      messages: string[];
    }
  >();
  constructor(public store: Store) {
    this.runtime.on("message", (m: RpcMessage) => this.onMessage(m));
    this.runtime.on("disconnect", (e: Error) => {
      this.store.state.runtime = {
        connected: false,
        authenticated: false,
        mode: "real",
        error: e.message,
      };
      for (const t of this.store.state.tasks)
        if (!terminal(t.status)) void this.cancel(t.id, "interrupted");
      this.publish();
    });
  }
  publish() {
    this.store.save();
    this.listeners.forEach((l) => l());
  }
  event(t: Task, kind: string, message: string, w?: Worker, details?: unknown) {
    this.store.event(t.id, kind, message, w?.id, details);
    if (w) w.latest = message;
    this.publish();
  }
  async connect() {
    try {
      if (!this.runtime.ready) await this.runtime.connect();
      const a = await this.runtime.call("account/read", {
        refreshToken: false,
      });
      this.store.state.runtime = {
        connected: true,
        authenticated: !!a.account || !a.requiresOpenaiAuth,
        mode: "real",
      };
    } catch (e) {
      this.store.state.runtime = {
        connected: false,
        authenticated: false,
        mode: "real",
        error: String(e),
      };
    }
    this.publish();
  }
  async addProject(path: string, name?: string, checks?: string[]) {
    const full = await git.repository(path);
    if (
      this.store.state.projects.some(
        (p) => p.path.toLowerCase() === full.toLowerCase(),
      )
    )
      throw new Error("Repository already connected");
    const detected = checks ?? (await git.discoverChecks(full));
    if (!detected.length)
      throw new Error(
        "No validation scripts found. Supply at least one meaningful verification command.",
      );
    const p = {
      id: randomUUID(),
      path: full,
      name: name || full.split(/[\\/]/).pop()!,
      plot: this.store.state.projects.reduce(
        (n, p) => Math.max(n, p.plot + 1),
        0,
      ),
      successes: 0,
      checks: detected,
    };
    this.store.state.projects.push(p);
    this.publish();
    return p;
  }
  async start(
    projectId: string,
    prompt: string,
    concurrency = 2,
    attemptOf?: string,
    habitatId?: string,
  ) {
    if (!this.runtime.ready || !this.store.state.runtime.authenticated)
      throw new Error(
        "Codex is unavailable or signed out. Run codex login in your terminal, then reconnect.",
      );
    const p = this.store.state.projects.find((p) => p.id === projectId);
    if (!p) throw new Error("Unknown project");
    if (!p.checks.length)
      throw new Error(
        "This project is watch-only. Register required verification commands before starting Galaxi execution.",
      );
    if (
      this.starting.has(p.id) ||
      this.store.state.tasks.some(
        (t) => t.projectId === p.id && !terminal(t.status),
      )
    )
      throw new Error("This project already has active work");
    this.starting.add(p.id);
    try {
      await git.clean(p.path);
      const id = randomUUID();
      const t: Task = {
        id,
        projectId,
        prompt,
        status: "queued",
        createdAt: new Date().toISOString(),
        workspace: join(git.workspaceRoot, id, "integration"),
        base: await git.git(p.path, "rev-parse", "HEAD"),
        branch: `codex/galaxi-${id}`,
        workers: [],
        checks: [],
        messages: [{ role: "user", text: prompt }],
        diff: "",
        files: [],
        awarded: false,
        applied: false,
        concurrency,
        attemptOf,
      };
      t.checks = p.checks.map((command) => ({
        command,
        cwd: t.workspace,
        status: "pending",
      }));
      const retryHabitat = this.store.state.tasks.find(
        (x) => x.id === attemptOf && x.projectId === projectId,
      )?.habitatId;
      assignTaskHabitat(this.store.state, t, habitatId || retryHabitat);
      this.store.state.tasks.push(t);
      this.abort.set(t.id, new AbortController());
      this.event(
        t,
        "task/created",
        "Task queued. Original checkout stays untouched.",
      );
      void this.execute(t).catch((e) => this.fail(t, e));
      return t;
    } finally {
      this.starting.delete(p.id);
    }
  }
  ensure(t: Task) {
    if (terminal(t.status) || this.abort.get(t.id)?.signal.aborted)
      throw new Error("Task stopped");
  }
  async execute(t: Task) {
    const p = this.store.state.projects.find((p) => p.id === t.projectId)!;
    await git.worktree(p.path, t.workspace, t.branch, t.base);
    this.ensure(t);
    transition(t, "planning");
    const lead: Worker = {
      id: "lead",
      role: "Lead",
      description: "Plan, coordinate and verify integrated work",
      dependencies: [],
      expectedOutput: "Integrated implementation and summary",
      workspace: t.workspace,
      status: "planning",
      latest: "Inspecting the request",
    };
    t.workers.push(lead);
    this.event(
      t,
      "planning",
      "Lead is preparing a bounded implementation plan.",
      lead,
    );
    const raw = await this.run(
      t,
      lead,
      `Inspect this repository read-only and plan this task: ${t.prompt}\nReturn structured subtasks with independent ownership and explicit dependencies. Use one subtask for small work, at most eight. Do not edit files or execute changes during planning. The controller will assign separate implementation conversations.`,
      planSchema,
      true,
    );
    this.ensure(t);
    const plan = Plan.parse(JSON.parse(raw));
    validatePlan(plan.subtasks);
    if (plan.subtasks.some((s) => s.id === "lead"))
      throw new Error("Subtask ID lead is reserved");
    t.plan = plan.summary;
    this.event(t, "plan/created", plan.summary, lead, plan);
    lead.status = "idle";
    transition(t, "running");
    for (const s of plan.subtasks)
      t.workers.push({
        ...s,
        role: "Implementation",
        workspace: join(git.workspaceRoot, t.id, s.id),
        status: "queued",
        latest: "Waiting for dependencies",
      });
    const workers = t.workers.filter((w) => w !== lead);
    let remaining = [...workers];
    while (remaining.length) {
      this.ensure(t);
      const ready = remaining
        .filter((w) =>
          w.dependencies.every(
            (d) => workers.find((x) => x.id === d)?.status === "completed",
          ),
        )
        .slice(0, t.concurrency);
      if (!ready.length) throw new Error("Dependency scheduling blocked");
      const outcomes = await Promise.allSettled(
        ready.map(async (w) => {
          await git.worktree(
            p.path,
            w.workspace,
            `codex/galaxi-${t.id}-${w.id}`,
            await git.git(t.workspace, "rev-parse", "HEAD"),
          );
          this.ensure(t);
          w.status = "inspecting";
          this.event(t, "worker/assigned", w.description, w);
          const initialHead = await git.git(w.workspace, "rev-parse", "HEAD");
          const result = await this.run(
            t,
            w,
            `Overall task: ${t.prompt}\nYour assignment: ${w.description}\nExpected output: ${w.expectedOutput}\nPlan: ${t.plan}\nDependency results are already integrated into this worktree base. Implement your assignment and report actual changes and limitations.`,
          );
          this.ensure(t);
          w.summary = result;
          const finalHead = await git.commit(w.workspace);
          w.files = (
            await git.git(w.workspace, "diff", "--name-only", t.base, finalHead)
          )
            .split("\n")
            .filter(Boolean);
          w.commit = finalHead === initialHead ? undefined : finalHead;
          w.status = "completed";
          this.event(
            t,
            "worker/completed",
            "Assignment execution completed; final checks are still required.",
            w,
          );
        }),
      );
      const failure = outcomes.find((x) => x.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      // A completed wave is integrated in plan order before dependent work is started.
      for (const w of ready) {
        this.ensure(t);
        if (w.commit) {
          this.event(t, "integration/started", `Integrating ${w.id}`, lead);
          try {
            await git.git(
              t.workspace,
              "-c",
              "user.name=Galaxi",
              "-c",
              "user.email=galaxi@localhost",
              "cherry-pick",
              w.commit!,
            );
          } catch (e) {
            t.error = `Integration conflict: ${String(e)}. All workspaces retained.`;
            transition(t, "waiting");
            lead.status = "blocked";
            this.event(t, "integration/conflict", t.error, lead);
            return;
          }
        }
      }
      remaining = remaining.filter((w) => !ready.includes(w));
    }
    this.ensure(t);
    transition(t, "integrating");
    lead.status = "inspecting";
    await this.run(
      t,
      lead,
      `All assigned worker results are integrated. Review the combined implementation for this request: ${t.prompt}\nWorker results: ${workers.map((w) => w.summary).join("\n")}\nFix integration issues if necessary. Do not remove or weaken checks. Produce a concise final summary of actual changes. Required controller checks will run next: ${t.checks.map((c) => c.command).join(", ")}.`,
    );
    this.ensure(t);
    await git.commit(t.workspace);
    lead.status = "completed";
    transition(t, "checking");
    await this.capture(t);
    const signal = this.abort.get(t.id)!.signal;
    for (const check of t.checks) {
      this.ensure(t);
      check.status = "running";
      check.startedAt = new Date().toISOString();
      this.event(t, "check/started", check.command);
      const r = await git.runCheck(t.workspace, check.command, signal);
      this.ensure(t);
      check.output = r.output;
      check.exitCode = r.code;
      check.endedAt = new Date().toISOString();
      check.status = r.code === 0 ? "passed" : "failed";
      this.event(
        t,
        "check/completed",
        `${check.command}: ${check.status}`,
        undefined,
        check,
      );
      if (r.code !== 0)
        throw new Error(`Required check failed: ${check.command}`);
    }
    // Checks may create tracked outputs. Capture them, but never claim unchecked edits passed.
    if (
      await git.git(
        t.workspace,
        "status",
        "--porcelain",
        "--untracked-files=no",
      )
    )
      throw new Error(
        "Checks modified tracked files. Review retained workspace and retry.",
      );
    this.ensure(t);
    this.store.succeed(t);
    this.event(
      t,
      "task/succeeded",
      "Execution and required checks passed. Building upgraded; result remains unapplied.",
    );
    this.abort.delete(t.id);
  }
  async capture(t: Task) {
    t.diff = await git.git(t.workspace, "diff", t.base, "--");
    t.files = (
      await git.git(t.workspace, "diff", "--name-status", t.base, "--")
    )
      .split("\n")
      .filter(Boolean);
    this.publish();
  }
  async fail(t: Task, e: unknown) {
    if (terminal(t.status)) return;
    t.error = e instanceof Error ? e.message : String(e);
    for (const w of t.workers)
      if (!["completed", "idle"].includes(w.status)) {
        w.status = "failed";
        w.error = t.error;
      }
    try {
      await this.capture(t);
    } catch {}
    if (terminal(t.status)) return;
    transition(t, "failed");
    this.event(t, "task/failed", t.error);
    this.abort.delete(t.id);
  }
  async run(
    t: Task,
    w: Worker,
    prompt: string,
    outputSchema?: unknown,
    readOnly = false,
  ): Promise<string> {
    this.ensure(t);
    if (!w.threadId) {
      const r = await this.runtime.call("thread/start", {
        cwd: w.workspace,
        sandbox: readOnly ? "read-only" : "workspace-write",
        approvalPolicy: "on-request",
        developerInstructions: safety,
        ...(process.env.CITY_MODEL ? { model: process.env.CITY_MODEL } : {}),
      });
      w.threadId = r.thread.id;
      this.publish();
    }
    this.ensure(t);
    w.turnId = undefined;
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        void this.cancel(t.id, "interrupted");
        reject(new Error("Worker exceeded 30-minute execution limit"));
      }, 1800000);
      this.runs.set(w.threadId!, {
        task: t,
        worker: w,
        resolve,
        reject,
        timer,
        messages: [],
      });
      this.runtime
        .call("turn/start", {
          threadId: w.threadId,
          input: textInput(prompt),
          ...(readOnly
            ? { sandboxPolicy: { type: "readOnly", networkAccess: false } }
            : {
                sandboxPolicy: {
                  type: "workspaceWrite",
                  writableRoots: [w.workspace],
                  networkAccess: false,
                  excludeTmpdirEnvVar: false,
                  excludeSlashTmp: false,
                },
              }),
          ...(outputSchema ? { outputSchema } : {}),
        })
        .then((r) => {
          if (terminal(t.status)) {
            void this.runtime
              .call("turn/interrupt", {
                threadId: w.threadId,
                turnId: r.turn.id,
              })
              .catch(() => {});
            return;
          }
          if (this.runs.get(w.threadId!)?.timer === timer) {
            w.turnId = r.turn.id;
            this.publish();
          }
        })
        .catch((e) => {
          clearTimeout(timer);
          this.runs.delete(w.threadId!);
          reject(e);
        });
    });
  }
  onMessage(m: RpcMessage) {
    if (
      m.method === "account/updated" ||
      m.method === "account/login/completed"
    ) {
      void this.connect();
      return;
    }
    const params = m.params ?? {};
    if (m.method === "serverRequest/resolved") {
      this.store.state.requests = this.store.state.requests.filter(
        (r) => String(r.rpcId) !== String(params.requestId),
      );
      this.publish();
      return;
    }
    const run = this.runs.get(params.threadId);
    if (!run) return;
    const { task: t, worker: w } = run;
    if (terminal(t.status)) return;
    const eventTurn = params.turnId || params.turn?.id;
    if (
      eventTurn &&
      (this.completedTurns.has(eventTurn) ||
        (w.turnId && w.turnId !== eventTurn))
    )
      return;
    if (m.id !== undefined && m.method) {
      const supported = [
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
        "item/permissions/requestApproval",
        "item/tool/requestUserInput",
      ];
      if (!supported.includes(m.method)) {
        this.runtime.send({
          id: m.id,
          error: {
            code: -32601,
            message: "Unsupported server request in Galaxi",
          },
        });
        this.event(
          t,
          "request/unsupported",
          `Unsupported runtime request: ${m.method}`,
          w,
        );
        return;
      }
      if (
        this.store.state.requests.some(
          (r) => r.rpcId === m.id && r.params.threadId === params.threadId,
        )
      )
        return;
      const req: PendingRequest = {
        id: randomUUID(),
        rpcId: m.id,
        taskId: t.id,
        workerId: w.id,
        method: m.method,
        params,
      };
      this.store.state.requests.push(req);
      w.status = m.method.includes("UserInput")
        ? "waiting for input"
        : "waiting for approval";
      this.event(
        t,
        "approval/requested",
        params.reason || params.command || "Runtime needs your response",
        w,
        req,
      );
      return;
    }
    if (m.method === "turn/started") {
      w.turnId = params.turn.id;
      this.publish();
    }
    if (m.method === "item/started" || m.method === "item/completed") {
      const item = params.item;
      const key = `${params.threadId}:${m.method}:${item.id}`;
      if (this.seenItems.has(key)) return;
      this.seenItems.add(key);
      const completed = m.method === "item/completed";
      if (item.type === "reasoning") return;
      w.status =
        item.type === "commandExecution"
          ? "running commands"
          : item.type === "fileChange"
            ? "editing"
            : item.type === "agentMessage"
              ? "inspecting"
              : w.status;
      const msg =
        item.type === "commandExecution"
          ? `${completed ? "Finished" : "Running"}: ${item.command}${completed ? ` (exit ${item.exitCode})` : ""}`
          : item.type === "fileChange"
            ? `${completed ? "Changed" : "Editing"} ${item.changes?.map((c: any) => c.path).join(", ")}`
            : item.type === "agentMessage"
              ? item.text
              : `${item.type} ${completed ? "completed" : "started"}`;
      if (item.type === "agentMessage" && completed) {
        run.messages.push(item.text);
        t.messages.push({ role: w.role, text: item.text, workerId: w.id });
      }
      this.event(t, m.method, msg, w, item);
    }
    if (m.method === "turn/plan/updated")
      this.event(
        t,
        m.method,
        params.explanation || "Execution plan updated",
        w,
        params.plan,
      );
    if (m.method === "error")
      this.event(
        t,
        "runtime/error",
        params.error?.message || "Runtime error",
        w,
      );
    if (m.method === "turn/completed") {
      this.completedTurns.add(params.turn.id);
      clearTimeout(run.timer);
      this.runs.delete(w.threadId!);
      this.store.state.requests = this.store.state.requests.filter(
        (r) => r.workerId !== w.id || r.taskId !== t.id,
      );
      w.turnId = undefined;
      if (params.turn.status === "completed")
        run.resolve(run.messages.at(-1) || "");
      else
        run.reject(
          new Error(
            params.turn.error?.message || `Worker turn ${params.turn.status}`,
          ),
        );
      this.publish();
    }
  }
  async answer(
    id: string,
    body: { decision?: string; answers?: Record<string, string[]> },
  ) {
    const req = this.store.state.requests.find((r) => r.id === id);
    if (!req) throw new Error("Request expired");
    const t = this.store.state.tasks.find((t) => t.id === req.taskId)!;
    if (terminal(t.status)) throw new Error("Task no longer active");
    let result: any;
    if (req.method.includes("UserInput")) {
      const answers: Record<string, { answers: string[] }> = {};
      for (const q of req.params.questions) {
        if (!body.answers?.[q.id]?.length)
          throw new Error(`Missing answer: ${q.id}`);
        answers[q.id] = { answers: body.answers[q.id] };
      }
      result = { answers };
    } else if (req.method.includes("permissions")) {
      if (!["accept", "decline"].includes(body.decision || ""))
        throw new Error("Unsupported permission decision");
      result = {
        permissions: body.decision === "accept" ? req.params.permissions : {},
        scope: "turn",
      };
    } else {
      if (!["accept", "decline", "cancel"].includes(body.decision || ""))
        throw new Error("Unsupported decision");
      if (
        req.params.availableDecisions &&
        !req.params.availableDecisions.includes(body.decision)
      )
        throw new Error("Decision not offered");
      result = { decision: body.decision };
    }
    this.runtime.reply(req.rpcId, result);
    this.store.state.requests = this.store.state.requests.filter(
      (r) => r !== req,
    );
    const w = t.workers.find((w) => w.id === req.workerId)!;
    w.status = "inspecting";
    this.event(t, "approval/answered", "Response sent to requesting worker", w);
  }
  async steer(id: string, workerId: string, text: string) {
    const t = this.store.state.tasks.find((t) => t.id === id)!;
    if (!t || terminal(t.status)) throw new Error("Task is not active");
    const w = t.workers.find((w) => w.id === workerId);
    if (!w?.threadId || !w.turnId) throw new Error("Worker has no active turn");
    await this.runtime.call("turn/steer", {
      threadId: w.threadId,
      expectedTurnId: w.turnId,
      input: textInput(text),
    });
    t.messages.push({ role: "user", text, workerId });
    this.event(t, "task/steered", "Follow-up sent to active worker", w);
  }
  async cancel(id: string, status: "cancelled" | "interrupted" = "cancelled") {
    const t = this.store.state.tasks.find((t) => t.id === id);
    if (!t || terminal(t.status)) return;
    transition(t, status);
    this.abort.get(id)?.abort();
    const interruptions: Promise<unknown>[] = [];
    for (const w of t.workers) {
      const run = w.threadId ? this.runs.get(w.threadId) : undefined;
      if (run) {
        clearTimeout(run.timer);
        run.reject(new Error("Task stopped"));
        this.runs.delete(w.threadId!);
      }
      if (w.turnId && w.threadId)
        interruptions.push(
          this.runtime.call("turn/interrupt", {
            threadId: w.threadId,
            turnId: w.turnId,
          }),
        );
      if (w.status !== "completed") w.status = "interrupted";
    }
    this.store.state.requests = this.store.state.requests.filter(
      (r) => r.taskId !== id,
    );
    this.event(
      t,
      "task/stopped",
      "Task stopped. Workspaces retained; no upgrade awarded.",
    );
    await Promise.allSettled(interruptions);
    try {
      await this.capture(t);
    } catch {}
    this.abort.delete(t.id);
  }
  async apply(id: string) {
    const t = this.store.state.tasks.find((t) => t.id === id);
    if (!t || t.status !== "succeeded" || t.applied)
      throw new Error("No unapplied successful result");
    const p = this.store.state.projects.find((p) => p.id === t.projectId)!;
    if (
      this.store.state.tasks.some(
        (x) => x.projectId === p.id && !terminal(x.status),
      )
    )
      throw new Error("Stop active project work before applying");
    await git.clean(p.path);
    if ((await git.git(p.path, "rev-parse", "HEAD")) !== t.base)
      throw new Error(
        "Original branch has moved. Review and merge retained task branch manually.",
      );
    await git.git(p.path, "merge", "--ff-only", t.branch);
    t.applied = true;
    this.event(
      t,
      "result/applied",
      "Result explicitly applied to original checkout.",
    );
  }
}
