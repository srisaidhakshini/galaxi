import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { ObservedChat, Worker } from "../shared/domain.ts";
import type { Store } from "./store.ts";
import { repository } from "./git.ts";

export interface Reader {
  ready: boolean;
  call(method: string, params?: unknown): Promise<any>;
}
const samePath = (a: string, b: string) =>
  process.platform === "win32"
    ? resolve(a).toLowerCase() === resolve(b).toLowerCase()
    : resolve(a) === resolve(b);
export function describeRecordedItem(
  item: any,
): ObservedChat["activity"][number] | undefined {
  if (item.type === "userMessage")
    return {
      id: item.id,
      kind: item.type,
      message:
        item.content
          ?.filter((x: any) => x.type === "text")
          .map((x: any) => x.text)
          .join("\n")
          .replace(
            /<in-app-browser-context[\s\S]*?<\/in-app-browser-context>/g,
            "",
          )
          .replace(/<environment_context>[\s\S]*?<\/environment_context>/g, "")
          .trim()
          .replace(/^## My request:\s*/, "") || "",
    };
  if (item.type === "agentMessage")
    return { id: item.id, kind: item.type, message: item.text || "" };
  if (item.type === "fileChange")
    return {
      id: item.id,
      kind: item.type,
      message: `Changed: ${item.changes?.map((x: any) => x.path).join(", ")}`,
      status: item.status,
      output: item.changes
        ?.map((x: any) => x.diff || "")
        .join("\n")
        .slice(-16000),
    };
  if (item.type === "commandExecution")
    return {
      id: item.id,
      kind: item.type,
      message: item.command || "",
      status: item.status,
      output: item.aggregatedOutput?.slice(-16000),
    };
  if (item.type === "collabAgentToolCall")
    return {
      id: item.id,
      kind: item.type,
      message: `Delegation: ${item.tool} (${item.receiverThreadIds?.length || 0} sessions)`,
      status: item.status,
    };
  return undefined; // Hidden reasoning is never copied to the city.
}
export function recordedState(
  item: ObservedChat["activity"][number],
): Worker["status"] {
  if (item.status === "failed" || item.status === "declined") return "failed";
  if (item.kind === "fileChange") return "editing";
  if (item.kind === "commandExecution") {
    if (
      /\b(apply_patch|Set-Content|Add-Content|Out-File|writeFile(?:Sync)?|write_text)\b/i.test(
        item.message,
      )
    )
      return "editing";
    if (
      /\b(npm (?:run (?:test|build|lint|typecheck)|test)|pytest|cargo test|tsc|vitest)\b/i.test(
        item.message,
      )
    )
      return "checking";
    return "running commands";
  }
  return "inspecting";
}
export class ChatObserver {
  timer?: NodeJS.Timeout;
  polling = false;
  fingerprints = new Map<string, string>();
  constructor(
    public store: Store,
    public reader: Reader,
    public publish: () => void,
  ) {
    store.state.observedChats ??= [];
    for (const c of store.state.observedChats) {
      c.connected = false;
      c.worker.status = "idle";
      c.error = "Reconnecting to recorded chat activity";
    }
  }
  async list(projectId: string) {
    const p = this.store.state.projects.find((p) => p.id === projectId);
    if (!p) throw Error("Unknown project");
    const r = await this.reader.call("thread/list", {
      cwd: p.path,
      limit: 30,
      sortKey: "updated_at",
      sortDirection: "desc",
    });
    return r.data.map((t: any) => ({
      id: t.id,
      name: t.name || t.preview?.slice(0, 90) || "Codex chat",
      updatedAt: t.updatedAt,
    }));
  }
  async watch(threadId: string, projectId?: string) {
    if (
      this.store.state.tasks.some((t) =>
        t.workers.some((w) => w.threadId === threadId),
      )
    )
      throw Error("This chat is already managed as a City task");
    const { thread } = await this.reader.call("thread/read", { threadId });
    const path = await repository(thread.cwd);
    let project = this.store.state.projects.find((p) =>
      projectId ? p.id === projectId : samePath(p.path, path),
    );
    if (projectId && (!project || !samePath(project.path, path)))
      throw Error("This chat belongs to a different repository");
    if (!project) {
      project = {
        id: randomUUID(),
        name: path.split(/[\\/]/).pop()!,
        path,
        plot: this.store.state.projects.reduce(
          (n, p) => Math.max(n, p.plot + 1),
          0,
        ),
        successes: 0,
        checks: [],
      };
      this.store.state.projects.push(project);
    }
    const exists = this.store.state.observedChats!.find(
      (c) => c.threadId === threadId,
    );
    if (exists) return exists;
    if (this.store.state.observedChats!.length >= 8)
      throw Error("Watch at most eight chats at a time");
    const chat: ObservedChat = {
      threadId,
      projectId: project.id,
      name: thread.name || "Codex chat",
      prompt: "",
      connected: false,
      activity: [],
      worker: {
        id: `chat-${threadId}`,
        threadId,
        role: "Codex chat",
        description: "Read-only reflection of work performed in the Codex app",
        dependencies: [],
        expectedOutput:
          "Observed activity; no execution or automatic progression",
        workspace: path,
        status: "inspecting",
        latest: "Connecting to recorded activity",
      },
    };
    this.store.state.observedChats!.push(chat);
    await this.pollChat(chat, true);
    this.publish();
    return chat;
  }
  unwatch(threadId: string) {
    this.store.state.observedChats = this.store.state.observedChats!.filter(
      (c) => c.threadId !== threadId,
    );
    this.fingerprints.delete(threadId);
    this.publish();
  }
  start() {
    this.timer = setInterval(() => void this.poll(), 2000);
    this.timer.unref();
    void this.poll();
  }
  stop() {
    clearInterval(this.timer);
  }
  async poll() {
    if (this.polling || !this.reader.ready) return;
    this.polling = true;
    try {
      for (const c of [...this.store.state.observedChats!])
        await this.pollChat(c);
      if (this.store.state.observedChats!.length) this.publish();
    } finally {
      this.polling = false;
    }
  }
  async pollChat(chat: ObservedChat, initial = false) {
    try {
      const turns = await this.reader.call("thread/turns/list", {
        threadId: chat.threadId,
        limit: 1,
        sortDirection: "desc",
        itemsView: "notLoaded",
      });
      const turn = turns.data[0];
      if (!turn) {
        chat.connected = true;
        chat.worker.status = "idle";
        return;
      }
      if (chat.turnId !== turn.id) {
        const first = await this.reader.call("thread/items/list", {
          threadId: chat.threadId,
          turnId: turn.id,
          limit: 10,
          sortDirection: "asc",
        });
        chat.prompt =
          first.data
            .map((e: any) => describeRecordedItem(e.item))
            .find((a: any) => a?.kind === "userMessage")?.message || "";
        chat.turnId = turn.id;
      }
      const items = await this.reader.call("thread/items/list", {
        threadId: chat.threadId,
        turnId: turn.id,
        limit: 100,
        sortDirection: "desc",
      });
      const activity = items.data
        .map((e: any) => describeRecordedItem(e.item))
        .filter(Boolean)
        .reverse() as ObservedChat["activity"];
      const fingerprint = JSON.stringify(activity);
      const baseline = initial || !this.fingerprints.has(chat.threadId);
      const changed = this.fingerprints.get(chat.threadId) !== fingerprint;
      this.fingerprints.set(chat.threadId, fingerprint);
      chat.connected = true;
      chat.error = undefined;
      chat.checkedAt = new Date().toISOString();
      chat.activity = activity;
      const user = activity.find((a) => a.kind === "userMessage");
      if (user) chat.prompt = user.message;
      if (changed) {
        chat.changedAt = chat.checkedAt;
        const work = activity.filter(
          (a) => a.kind === "fileChange" || a.kind === "commandExecution",
        );
        const last = work.at(-1) || activity.at(-1);
        if (last) {
          const key = `${last.id}:${last.status || ""}`;
          if (chat.worker.observedItemId !== key) {
            chat.worker.status = baseline ? "idle" : recordedState(last);
            chat.workObservedAt = chat.checkedAt;
          }
          chat.worker.latest = last.message;
          chat.worker.observedItemId = key;
        }
      }
      // Independent app-server processes cannot authoritatively know the desktop turn's live status.
      // Animate recent recorded evidence briefly; never turn a history snapshot into a success award.
      if (
        chat.workObservedAt &&
        Date.now() - Date.parse(chat.workObservedAt) > 20000
      )
        chat.worker.status = "idle";
      if (
        turn.status === "completed" &&
        activity.some((a) => a.kind === "agentMessage")
      )
        chat.worker.status = "completed";
    } catch (e) {
      chat.connected = false;
      chat.error = e instanceof Error ? e.message : String(e);
      chat.worker.status = "blocked";
    }
  }
}
