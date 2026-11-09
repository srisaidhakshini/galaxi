import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Store } from "../server/store.ts";
import {
  ChatObserver,
  describeRecordedItem,
  recordedState,
} from "../server/observer.ts";

class ReadOnlyRuntime {
  ready = true;
  calls: string[] = [];
  status = "interrupted";
  turnId = "turn";
  chats = [{ id: "chat", name: "Current chat", updatedAt: 1 }];
  items: any[] = [
    {
      id: "prompt",
      type: "userMessage",
      content: [{ type: "text", text: "Build the requested feature" }],
    },
  ];
  async call(method: string, params: any) {
    this.calls.push(method);
    if (
      ![
        "thread/read",
        "thread/list",
        "thread/turns/list",
        "thread/items/list",
      ].includes(method)
    )
      throw Error("Observer attempted a non-read method");
    if (method === "thread/read")
      return {
        thread: {
          id: params.threadId,
          cwd: resolve("."),
          name: "Current chat",
        },
      };
    if (method === "thread/list") return { data: this.chats };
    if (method === "thread/turns/list")
      return { data: [{ id: this.turnId, status: this.status }] };
    return {
      data: (params.sortDirection === "desc"
        ? [...this.items].reverse()
        : this.items
      ).map((item) => ({ turnId: "turn", item })),
    };
  }
}
function fixture() {
  const store = new Store(
    resolve(".local/tests", randomUUID(), "observer.sqlite"),
  );
  store.state.projects.push({
    id: "p",
    name: "Current project",
    path: resolve("."),
    plot: 0,
    successes: 0,
    checks: [],
  });
  const runtime = new ReadOnlyRuntime();
  const observer = new ChatObserver(store, runtime, () => store.save());
  return { store, runtime, observer };
}
test("watching reads current prompts without starting or resuming execution", async () => {
  const { store, runtime, observer } = fixture();
  const c = await observer.watch("chat", "p");
  assert.equal(c.prompt, "Build the requested feature");
  assert.equal(c.worker.status, "idle");
  assert.equal(store.state.tasks.length, 0);
  assert.ok(
    runtime.calls.every(
      (m) =>
        !m.includes("start") &&
        !m.includes("resume") &&
        !m.includes("interrupt"),
    ),
  );
  store.db.close();
});
test("new recorded edits animate construction while hidden reasoning never reaches the browser", async () => {
  const { store, runtime, observer } = fixture();
  const c = await observer.watch("chat", "p");
  runtime.items.push(
    { id: "private", type: "reasoning", content: ["Hidden content"] },
    {
      id: "edit",
      type: "fileChange",
      status: "completed",
      changes: [{ path: "feature.ts", diff: "+ actual change" }],
    },
  );
  await observer.poll();
  assert.equal(c.worker.status, "editing");
  assert.equal(
    c.activity.some((a) => a.id === "private"),
    false,
  );
  assert.equal(c.activity.at(-1)?.output, "+ actual change");
  assert.equal(store.state.projects[0].successes, 0);
  assert.equal(store.state.tasks.length, 0);
  store.db.close();
});
test("duplicate snapshots do not restart animation and stale evidence becomes idle", async () => {
  const { store, runtime, observer } = fixture();
  const c = await observer.watch("chat", "p");
  runtime.items.push({
    id: "edit",
    type: "fileChange",
    status: "completed",
    changes: [],
  });
  await observer.poll();
  const at = c.changedAt;
  await observer.poll();
  assert.equal(c.changedAt, at);
  c.workObservedAt = new Date(Date.now() - 30000).toISOString();
  await observer.poll();
  assert.equal(c.worker.status, "idle");
  runtime.items.push({
    id: "commentary",
    type: "agentMessage",
    text: "Reviewing the result",
  });
  await observer.poll();
  assert.equal(c.worker.status, "idle");
  store.db.close();
});
test("recorded completion never awards progression or claims Galaxi verification", async () => {
  const { store, runtime, observer } = fixture();
  await observer.watch("chat", "p");
  runtime.status = "completed";
  runtime.items.push({ id: "final", type: "agentMessage", text: "Done" });
  await observer.poll();
  assert.equal(store.state.observedChats![0].worker.status, "completed");
  assert.equal(store.state.projects[0].successes, 0);
  assert.deepEqual(store.state.tasks, []);
  observer.unwatch("chat");
  assert.equal(store.state.observedChats!.length, 0);
  store.db.close();
});
test("read failure disconnects the mirror instead of inventing activity", async () => {
  const { store, runtime, observer } = fixture();
  const c = await observer.watch("chat", "p");
  runtime.call = async () => {
    throw Error("history unavailable");
  };
  await observer.poll();
  assert.equal(c.connected, false);
  assert.equal(c.worker.status, "blocked");
  assert.match(c.error!, /unavailable/);
  store.db.close();
});
test("public item classification separates writes, checks and ordinary commands", () => {
  assert.equal(
    describeRecordedItem({ id: "secret", type: "reasoning" }),
    undefined,
  );
  assert.equal(
    recordedState({
      id: "x",
      kind: "commandExecution",
      message: "Get-Content README.md",
    }),
    "running commands",
  );
  assert.equal(
    recordedState({
      id: "x",
      kind: "commandExecution",
      message: "npm run build",
    }),
    "checking",
  );
  assert.equal(
    recordedState({
      id: "x",
      kind: "commandExecution",
      message: "Set-Content app.ts content",
    }),
    "editing",
  );
});
test("prompt view removes ambient UI wrappers without changing the user request", () => {
  const result = describeRecordedItem({
    id: "u",
    type: "userMessage",
    content: [
      {
        type: "text",
        text: "<in-app-browser-context>ambient data</in-app-browser-context>\n## My request:\nBuild this feature",
      },
    ],
  });
  assert.equal(result?.message, "Build this feature");
});

test("new prompts create land without importing history and construction survives restart", async () => {
  const { store, runtime, observer } = fixture();
  const c = await observer.watch("chat", "p");
  assert.equal(store.state.habitats?.length || 0, 0);
  runtime.turnId = "new-turn";
  runtime.items = [
    {
      id: "new-prompt",
      type: "userMessage",
      content: [{ type: "text", text: "Add weather sensors" }],
    },
  ];
  await observer.poll();
  assert.equal(store.state.habitats!.length, 1);
  const habitat = store.state.habitats![0];
  assert.equal(habitat.constructionStage, 0);
  runtime.items.push({
    id: "edit-1",
    type: "fileChange",
    status: "completed",
    changes: [{ path: "sensor.ts", kind: { type: "add" }, diff: "sensor" }],
  });
  await observer.poll();
  assert.equal(habitat.constructionStage, 1);
  await observer.poll();
  assert.equal(habitat.constructionStage, 1);
  runtime.status = "completed";
  runtime.items.push({ id: "answer", type: "agentMessage", text: "Done" });
  await observer.poll();
  assert.equal(habitat.constructionStage, 5);
  runtime.turnId = "related-turn";
  runtime.status = "inProgress";
  runtime.items = [
    {
      id: "related-prompt",
      type: "userMessage",
      content: [{ type: "text", text: "Add weather sensors" }],
    },
    {
      id: "related-edit",
      type: "fileChange",
      status: "completed",
      changes: [{ path: "sensor.ts", kind: { type: "update" }, diff: "more" }],
    },
  ];
  await observer.poll();
  assert.equal(c.habitatId, habitat.id);
  assert.equal(habitat.constructionStage, 5);
  const count = store.state.habitats!.length;
  runtime.turnId = "next-turn";
  runtime.status = "inProgress";
  runtime.items = [
    {
      id: "p2",
      type: "userMessage",
      content: [{ type: "text", text: "Build authentication login" }],
    },
  ];
  await observer.poll();
  assert.equal(store.state.habitats!.length, count);
  assert.equal(habitat.constructionStage, 5);
  const path = store.db.location()!;
  store.save();
  store.db.close();
  const recovered = new Store(path);
  assert.equal(
    recovered.state.habitats!.find((h) => h.id === habitat.id)!
      .constructionStage,
    5,
  );
  assert.equal(recovered.state.habitats!.length, count);
  recovered.db.close();
});

test("project discovery attaches both chats with one dome each and respects stop watching", async () => {
  const { store, runtime, observer } = fixture();
  runtime.status = "completed";
  runtime.items.push({ id: "answer", type: "agentMessage", text: "Done" });
  runtime.chats.push({ id: "second", name: "Second chat", updatedAt: 2 });
  await observer.discover();
  assert.equal(store.state.observedChats!.length, 2);
  assert.equal(store.state.habitats!.length, 2);
  assert.equal(
    new Set(store.state.habitats!.map((h) => h.chatThreadId)).size,
    2,
  );
  assert.ok(store.state.habitats!.every((h) => h.constructionStage === 5));
  await observer.discover();
  assert.equal(store.state.habitats!.length, 2);
  observer.unwatch("second");
  await observer.discover();
  assert.equal(store.state.observedChats!.length, 1);
  assert.ok(store.state.ignoredChatIds!.includes("second"));
  assert.equal(store.state.tasks.length, 0);
  assert.ok(
    runtime.calls.every((m) => !m.includes("start") && !m.includes("resume")),
  );
  store.db.close();
});
