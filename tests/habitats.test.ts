import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Store } from "../server/store.ts";
import {
  assignHabitat,
  assignTaskHabitat,
  assignChatHabitat,
  createHabitat,
  ensureHabitats,
  habitatTopics,
  moveHabitatMember,
} from "../shared/habitats.ts";
import type { Snapshot, Task, ObservedChat } from "../shared/domain.ts";
import {
  districtPosition,
  habitatPosition,
  districtDepth,
} from "../src/districtLayout.ts";
function state(): Snapshot {
  return {
    projects: [
      { id: "a", name: "A", path: "", plot: 0, successes: 2, checks: [] },
      { id: "b", name: "B", path: "", plot: 1, successes: 0, checks: [] },
    ],
    tasks: [],
    events: [],
    requests: [],
    runtime: { connected: false, authenticated: false, mode: "real" },
  };
}
const member = (id: string, prompt: string) => ({
  id,
  kind: "task" as const,
  prompt,
  createdAt: "2026-10-28T00:00:00Z",
});
test("related tasks reuse a habitat while unrelated work gets its own dome", () => {
  const s = state(),
    a = assignHabitat(s, "a", member("1", "Improve navigation sidebar")),
    b = assignHabitat(s, "a", member("2", "Fix navbar navigation")),
    c = assignHabitat(s, "a", member("3", "Add SQLite persistence"));
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
  assert.equal(a.members.length, 2);
  assert.equal(s.projects[0].successes, 2);
});
test("habitat IDs and slots remain stable across duplicate assignment and serialization", () => {
  const s = state();
  const a = assignHabitat(s, "a", member("1", "Add login authentication"));
  assignHabitat(s, "a", member("1", "Add login authentication"));
  assert.equal(a.members.length, 1);
  const restored = JSON.parse(JSON.stringify(s));
  const same = assignHabitat(
    restored,
    "a",
    member("1", "Add login authentication"),
  );
  assert.equal(same.id, a.id);
  assert.equal(same.plot, a.plot);
});
test("manual grouping changes assignment only and prevents cross-project movement", () => {
  const s = state(),
    a = assignHabitat(s, "a", member("1", "Style buttons")),
    b = createHabitat(s, "a", "Shared frontend habitat"),
    foreign = createHabitat(s, "b", "Foreign");
  moveHabitatMember(s, b.id, "task", "1");
  assert.equal(a.members.length, 0);
  assert.equal(b.members.length, 1);
  assert.throws(
    () => moveHabitatMember(s, foreign.id, "task", "1"),
    /own project/,
  );
  assert.equal(b.members.length, 1);
});
test("one chat reuses one dome across unrelated prompts and different chats stay separate", () => {
  const s = state(),
    chat: ObservedChat = {
      threadId: "chat",
      turnId: "old",
      projectId: "a",
      name: "chat",
      prompt: "Fix login auth",
      connected: true,
      activity: [],
      worker: {
        id: "real",
        role: "Codex chat",
        description: "",
        dependencies: [],
        expectedOutput: "",
        workspace: "",
        status: "editing",
        latest: "",
      },
    };
  s.observedChats = [chat];
  const old = assignChatHabitat(s, chat, "old", chat.prompt);
  chat.turnId = "new";
  chat.prompt = "Add SQLite storage";
  const current = assignChatHabitat(s, chat, "new", chat.prompt);
  assert.equal(old.id, current.id);
  assert.throws(
    () => moveHabitatMember(s, current.id, "chat", "chat/old"),
    /one dome/,
  );
  const other = assignChatHabitat(
    s,
    { ...chat, threadId: "another-chat" },
    "new",
    chat.prompt,
  );
  assert.notEqual(other.id, current.id);
  assert.equal(chat.habitatId, current.id);
  assert.equal(current.members.length, 2);
  assert.equal(s.tasks.length, 0);
});
test("legacy snapshots migrate and persist grouping without changing progression", () => {
  const path = resolve(".local/tests", randomUUID(), "habitats.sqlite"),
    s = new Store(path);
  s.state = state();
  const t = {
    id: "task",
    projectId: "a",
    prompt: "Add API endpoints",
    status: "succeeded",
    createdAt: "2026-10-28T00:00:00Z",
    workers: [],
    checks: [],
    messages: [],
    workspace: "retained",
    branch: "kept",
    base: "base",
    diff: "",
    files: [],
    awarded: true,
    applied: false,
    concurrency: 2,
  } as Task;
  s.state.tasks.push(t);
  s.save();
  s.db.close();
  const recovered = new Store(path);
  assert.equal(recovered.state.habitats!.length, 1);
  assert.ok(recovered.state.tasks[0].habitatId);
  const id = recovered.state.tasks[0].habitatId;
  assert.equal(recovered.state.projects[0].successes, 2);
  assert.equal(recovered.state.tasks[0].workspace, "retained");
  ensureHabitats(recovered.state);
  assert.equal(recovered.state.tasks[0].habitatId, id);
  assert.equal(recovered.state.habitats![0].members.length, 1);
  recovered.db.close();
});
test("villages use stable irregular clearings with space between work sites", () => {
  assert.deepEqual(districtPosition(0), [0, 0, 0]);
  assert.equal(districtPosition(1)[0] - districtPosition(0)[0], 42);
  assert.ok(districtPosition(1, 59)[0] > districtDepth(59));
  for (let i = 0; i < 60; i++) {
    const [x, , z] = habitatPosition(i);
    assert.ok(Math.hypot(x, z) + 3 <= districtDepth(i) / 2);
    for (let j = 0; j < i; j++) {
      const [a, , b] = habitatPosition(j);
      assert.ok(Math.hypot(x - a, z - b) > 6);
    }
  }
  assert.notEqual(
    Math.hypot(habitatPosition(0)[0], habitatPosition(0)[2]),
    Math.hypot(habitatPosition(1)[0], habitatPosition(1)[2]),
  );
  assert.deepEqual(habitatTopics("Fix navbar navigation"), ["navigation"]);
});

test("legacy per-turn sites consolidate without losing history or task sites", () => {
  const s = state();
  const a = createHabitat(s, "a", "Old UI"),
    b = createHabitat(s, "a", "Old API"),
    c = createHabitat(s, "a", "Other chat"),
    task = createHabitat(s, "a", "Task site");
  a.members = [
    {
      id: "chat/1",
      kind: "chat",
      threadId: "chat",
      turnId: "1",
      prompt: "UI",
      createdAt: "2026-01-01",
    },
  ];
  b.members = [
    {
      id: "chat/2",
      kind: "chat",
      threadId: "chat",
      turnId: "2",
      prompt: "API",
      createdAt: "2026-01-02",
    },
  ];
  c.members = [
    {
      id: "other/1",
      kind: "chat",
      threadId: "other",
      turnId: "1",
      prompt: "UI",
      createdAt: "2026-01-01",
    },
  ];
  a.constructionStage = 2;
  b.constructionStage = 5;
  ensureHabitats(s);
  assert.equal(s.habitats!.filter((h) => h.chatThreadId === "chat").length, 1);
  const home = s.habitats!.find((h) => h.chatThreadId === "chat")!;
  assert.equal(home.members.length, 2);
  assert.equal(home.constructionStage, 5);
  assert.ok(s.habitats!.some((h) => h.id === task.id));
  assert.equal(s.habitats!.length, 3);
  ensureHabitats(s);
  assert.equal(s.habitats!.length, 3);
  assert.equal(home.members.length, 2);
  assert.equal(s.projects[0].successes, 2);
});
