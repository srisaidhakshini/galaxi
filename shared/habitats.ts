import type {
  Snapshot,
  Habitat,
  HabitatMember,
  Task,
  ObservedChat,
} from "./domain";
const stop = new Set(
  "a an the and or to for of in on is it this that with from my your our me we you i want wanted need please make change improve add fix build create new task tasks project projects worker workers now okay ok going will be should can could would like so just all some something kind kinda every each".split(
    " ",
  ),
);
const aliases: Record<string, string> = {
  ui: "interface",
  ux: "interface",
  css: "interface",
  frontend: "interface",
  layout: "interface",
  design: "interface",
  style: "interface",
  styles: "interface",
  theme: "interface",
  navbar: "navigation",
  sidebar: "navigation",
  nav: "navigation",
  dom: "habitat",
  doms: "habitat",
  dome: "habitat",
  domes: "habitat",
  tents: "habitat",
  tent: "habitat",
  habitats: "habitat",
  api: "api",
  apis: "api",
  endpoint: "api",
  endpoints: "api",
  backend: "api",
  test: "verification",
  tests: "verification",
  testing: "verification",
  pytest: "verification",
  validation: "verification",
  verify: "verification",
  login: "access",
  authentication: "access",
  auth: "access",
  signin: "access",
  database: "data",
  sqlite: "data",
  storage: "data",
  persistence: "data",
  docs: "documentation",
  readme: "documentation",
  commit: "operations",
  push: "operations",
};
export function habitatTopics(prompt: string) {
  return [
    ...new Set(
      (prompt.toLowerCase().match(/[a-z][a-z0-9]{1,}/g) || [])
        .filter((w) => !stop.has(w))
        .map((w) => aliases[w] || w),
    ),
  ].slice(0, 16);
}
export function habitatSimilarity(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const common = a.filter((x) => b.includes(x)).length;
  return common / new Set([...a, ...b]).size;
}
function defaultName(topics: string[]) {
  const names: Record<string, string> = {
    interface: "Interface lab",
    api: "API lab",
    verification: "Verification lab",
    data: "Data lab",
    access: "Access lab",
    documentation: "Research archive",
    operations: "Operations tent",
    habitat: "Habitat engineering",
  };
  return (
    topics.map((t) => names[t]).find(Boolean) ||
    (topics[0]
      ? `${topics[0][0].toUpperCase() + topics[0].slice(1)} habitat`
      : "Research habitat")
  );
}
export function createHabitat(
  state: Snapshot,
  projectId: string,
  name: string,
  topics: string[] = [],
): Habitat {
  if (!state.projects.some((p) => p.id === projectId))
    throw Error("Unknown project");
  state.habitats ??= [];
  const h: Habitat = {
    id: crypto.randomUUID(),
    projectId,
    name: name.trim().slice(0, 60),
    topics,
    plot: state.habitats
      .filter((h) => h.projectId === projectId)
      .reduce((n, h) => Math.max(n, h.plot + 1), 0),
    createdAt: new Date().toISOString(),
    members: [],
    constructionStage: 0,
  };
  if (!h.name) throw Error("Habitat name is required");
  state.habitats.push(h);
  return h;
}
export function assignHabitat(
  state: Snapshot,
  projectId: string,
  member: HabitatMember,
  requestedId?: string,
): Habitat {
  state.habitats ??= [];
  const existing = state.habitats.find(
    (h) =>
      h.projectId === projectId &&
      h.members.some((m) => m.id === member.id && m.kind === member.kind),
  );
  if (existing && !requestedId) return existing;
  let target = requestedId
    ? state.habitats.find(
        (h) => h.id === requestedId && h.projectId === projectId,
      )
    : undefined;
  if (requestedId && !target) throw Error("Choose a habitat in this project");
  const topics = habitatTopics(member.prompt);
  if (!target) {
    const candidates = state.habitats
      .filter(
        (h) => h.projectId === projectId && !h.chatThreadId && h.members.length,
      )
      .map((h) => ({ h, score: habitatSimilarity(h.topics, topics) }))
      .sort((a, b) => b.score - a.score);
    if (candidates[0]?.score >= 0.5) target = candidates[0].h;
  }
  if (!target) {
    const base = defaultName(topics),
      count = state.habitats.filter(
        (h) =>
          h.projectId === projectId &&
          (h.name === base || h.name.startsWith(base + " ")),
      ).length;
    target = createHabitat(
      state,
      projectId,
      count ? `${base} ${count + 1}` : base,
      topics,
    );
  }
  if (existing && existing.id !== target.id)
    existing.members = existing.members.filter(
      (m) => !(m.id === member.id && m.kind === member.kind),
    );
  if (!target.members.some((m) => m.id === member.id && m.kind === member.kind))
    target.members.push(member);
  target.topics = [...new Set([...target.topics, ...topics])].slice(0, 24);
  return target;
}
export function assignTaskHabitat(
  state: Snapshot,
  task: Task,
  requestedId?: string,
) {
  const h = assignHabitat(
    state,
    task.projectId,
    {
      id: task.id,
      kind: "task",
      prompt: task.prompt,
      createdAt: task.createdAt,
    },
    requestedId,
  );
  task.habitatId = h.id;
  return h;
}
export function assignChatHabitat(
  state: Snapshot,
  chat: ObservedChat,
  turnId: string,
  prompt: string,
  createdAt = new Date().toISOString(),
) {
  let home = state.habitats?.find(
    (h) => h.projectId === chat.projectId && h.chatThreadId === chat.threadId,
  );
  if (!home) {
    home = createHabitat(state, chat.projectId, chat.name || "Codex chat");
    home.chatThreadId = chat.threadId;
  }
  const h = assignHabitat(
    state,
    chat.projectId,
    {
      id: chat.threadId + "/" + turnId,
      kind: "chat",
      threadId: chat.threadId,
      turnId,
      prompt,
      createdAt,
    },
    home.id,
  );
  if (chat.turnId === turnId) chat.habitatId = h.id;
  return h;
}
export function ensureHabitats(state: Snapshot) {
  consolidateChatHabitats(state);
  // Existing built sites stay built. Never backfill unassigned historical chats here.
  for (const h of state.habitats || []) h.constructionStage ??= 5;
  state.habitats ??= [];
  for (const t of state.tasks)
    if (state.projects.some((p) => p.id === t.projectId))
      assignTaskHabitat(
        state,
        t,
        state.habitats.some(
          (h) => h.id === t.habitatId && h.projectId === t.projectId,
        )
          ? t.habitatId
          : undefined,
      );
}
export function moveHabitatMember(
  state: Snapshot,
  habitatId: string,
  kind: HabitatMember["kind"],
  memberId: string,
) {
  if (kind === "chat")
    throw Error(
      "Each chat keeps one dome. Individual turns cannot move between buildings.",
    );
  const target = state.habitats?.find((h) => h.id === habitatId);
  if (!target) throw Error("Unknown habitat");
  const origin = state.habitats!.find((h) =>
    h.members.some((m) => m.kind === kind && m.id === memberId),
  );
  if (!origin || origin.projectId !== target.projectId)
    throw Error("Assignments can only move within their own project");
  const member = origin.members.find(
    (m) => m.kind === kind && m.id === memberId,
  )!;
  assignHabitat(state, target.projectId, member, target.id);
  if (kind === "task") {
    const task = state.tasks.find((t) => t.id === memberId);
    if (task) task.habitatId = target.id;
  } else {
    const chat = state.observedChats?.find(
      (c) => c.threadId === member.threadId && c.turnId === member.turnId,
    );
    if (chat) chat.habitatId = target.id;
  }
  return target;
}

/** Consolidate earlier per-turn domes without losing prompt history or built progress. */
export function consolidateChatHabitats(state: Snapshot) {
  state.habitats ??= [];
  const groups = new Map<
    string,
    {
      projectId: string;
      threadId: string;
      members: HabitatMember[];
      sources: Habitat[];
    }
  >();
  for (const h of [...state.habitats])
    for (const m of h.members.filter((m) => m.kind === "chat" && m.threadId)) {
      const key = h.projectId + "/" + m.threadId;
      const g = groups.get(key) || {
        projectId: h.projectId,
        threadId: m.threadId!,
        members: [],
        sources: [],
      };
      if (!g.members.some((x) => x.id === m.id)) g.members.push(m);
      if (!g.sources.includes(h)) g.sources.push(h);
      groups.set(key, g);
    }
  const retired = new Set<string>();
  for (const g of groups.values()) {
    let home =
      state.habitats.find(
        (h) => h.projectId === g.projectId && h.chatThreadId === g.threadId,
      ) ||
      g.sources.find((h) =>
        h.members.every((m) => m.kind === "chat" && m.threadId === g.threadId),
      );
    const chat = state.observedChats?.find(
      (c) => c.projectId === g.projectId && c.threadId === g.threadId,
    );
    if (!home)
      home = createHabitat(state, g.projectId, chat?.name || "Codex chat");
    if (!home.chatThreadId) home.name = chat?.name || "Codex chat";
    home.chatThreadId = g.threadId;
    home.constructionStage = Math.max(
      ...g.sources.map((h) => h.constructionStage ?? 5),
    );
    home.constructionEvidence = [
      ...new Set(g.sources.flatMap((h) => h.constructionEvidence || [])),
    ];
    for (const source of g.sources) {
      source.members = source.members.filter(
        (m) => !(m.kind === "chat" && m.threadId === g.threadId),
      );
      if (source !== home && !source.members.length) retired.add(source.id);
    }
    home.members.push(...g.members);
    if (chat) chat.habitatId = home.id;
  }
  state.habitats = state.habitats.filter((h) => !retired.has(h.id));
  if (retired.size)
    for (const p of state.projects)
      state.habitats
        .filter((h) => h.projectId === p.id)
        .sort((a, b) => a.plot - b.plot)
        .forEach((h, i) => (h.plot = i));
}
