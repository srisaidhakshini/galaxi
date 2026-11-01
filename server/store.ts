import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Snapshot, Task, CityEvent } from "../shared/domain.ts";
import { canSucceed, terminal, transition } from "../shared/domain.ts";
import { ensureHabitats } from "../shared/habitats.ts";
export class Store {
  db: DatabaseSync;
  state: Snapshot;
  constructor(path = resolve(".local/city.sqlite")) {
    mkdirSync(resolve(path, ".."), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, taskId TEXT NOT NULL, workerId TEXT, at TEXT NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL, details TEXT); CREATE TABLE IF NOT EXISTS awards(taskId TEXT PRIMARY KEY); PRAGMA user_version=1;",
    );
    const row = this.db
      .prepare("SELECT data FROM snapshots WHERE id=1")
      .get() as any;
    this.state = row
      ? JSON.parse(row.data)
      : {
          projects: [],
          tasks: [],
          requests: [],
          events: [],
          runtime: { connected: false, authenticated: false, mode: "real" },
        };
    this.state.events = [];
    ensureHabitats(this.state);
    this.state.requests = [];
    for (const t of this.state.tasks) {
      if (!terminal(t.status)) {
        transition(t, "interrupted");
        t.error =
          "Controller restarted. Execution is uncertain; retained workspaces require review. Retry creates a new attempt.";
        for (const w of t.workers)
          if (!["completed", "failed"].includes(w.status))
            w.status = "interrupted";
      }
    }
    this.state.runtime = {
      connected: false,
      authenticated: false,
      mode: "real",
    };
    this.save();
  }
  save() {
    for (const h of this.state.habitats || []) {
      const tasks = this.state.tasks.filter((t) => t.habitatId === h.id);
      const stage = tasks.some((t) => t.status === "succeeded")
        ? 5
        : tasks.some((t) => t.status === "checking")
          ? 4
          : tasks.some((t) => t.status === "integrating")
            ? 3
            : tasks.some((t) => t.workers.some((w) => w.status === "editing"))
              ? 2
              : tasks.some((t) => t.status === "running")
                ? 1
                : 0;
      h.constructionStage = Math.max(h.constructionStage ?? 0, stage);
    }
    this.db
      .prepare(
        "INSERT INTO snapshots(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(JSON.stringify({ ...this.state, events: [] }));
  }
  event(
    taskId: string,
    kind: string,
    message: string,
    workerId?: string,
    details?: unknown,
  ) {
    const at = new Date().toISOString();
    const r = this.db
      .prepare(
        "INSERT INTO events(taskId,workerId,at,kind,message,details) VALUES(?,?,?,?,?,?)",
      )
      .run(
        taskId,
        workerId ?? null,
        at,
        kind,
        message,
        details === undefined ? null : JSON.stringify(details),
      );
    return {
      id: Number(r.lastInsertRowid),
      taskId,
      workerId,
      at,
      kind,
      message,
      details,
    } as CityEvent;
  }
  events(after = 0) {
    return (
      this.db
        .prepare("SELECT * FROM events WHERE id>? ORDER BY id LIMIT 2000")
        .all(after) as any[]
    ).map((e) => ({
      ...e,
      details: e.details ? JSON.parse(e.details) : undefined,
    })) as CityEvent[];
  }
  succeed(t: Task) {
    if (!canSucceed(t)) throw new Error("Completion evidence is incomplete");
    const old = JSON.stringify(this.state);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const award = this.db
        .prepare("INSERT OR IGNORE INTO awards(taskId) VALUES(?)")
        .run(t.id);
      if (award.changes) {
        this.state.projects.find((p) => p.id === t.projectId)!.successes++;
        t.awarded = true;
      }
      transition(t, "succeeded");
      this.save();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      this.state = JSON.parse(old);
      throw e;
    }
  }
  snapshot(after = 0) {
    return { ...this.state, events: this.events(after) };
  }
}
