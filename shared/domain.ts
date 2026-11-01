export type TaskStatus =
  | "queued"
  | "planning"
  | "running"
  | "integrating"
  | "checking"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "interrupted";
export const terminal = (s: TaskStatus) =>
  ["succeeded", "failed", "cancelled", "interrupted"].includes(s);
export interface Project {
  id: string;
  name: string;
  path: string;
  plot: number;
  successes: number;
  checks: string[];
}
export interface Worker {
  id: string;
  role: string;
  description: string;
  dependencies: string[];
  expectedOutput: string;
  workspace: string;
  status: string;
  latest: string;
  threadId?: string;
  turnId?: string;
  summary?: string;
  commit?: string;
  files?: string[];
  error?: string;
  observedItemId?: string;
}
export interface ObservedChat {
  sourceUpdatedAt?: number;
  threadId: string;
  turnId?: string;
  projectId: string;
  name: string;
  prompt: string;
  connected: boolean;
  checkedAt?: string;
  changedAt?: string;
  workObservedAt?: string;
  habitatId?: string;
  habitatHistoryLoaded?: boolean;
  error?: string;
  worker: Worker;
  activity: {
    id: string;
    kind: string;
    message: string;
    status?: string;
    output?: string;
  }[];
}
export interface Check {
  command: string;
  cwd: string;
  status: "pending" | "running" | "passed" | "failed";
  startedAt?: string;
  endedAt?: string;
  exitCode?: number;
  output?: string;
}
export interface Task {
  id: string;
  projectId: string;
  prompt: string;
  status: TaskStatus;
  createdAt: string;
  endedAt?: string;
  workspace: string;
  base: string;
  branch: string;
  workers: Worker[];
  checks: Check[];
  messages: { role: string; text: string; workerId?: string }[];
  diff: string;
  files: string[];
  awarded: boolean;
  applied: boolean;
  error?: string;
  plan?: string;
  concurrency: number;
  attemptOf?: string;
  habitatId?: string;
}
export interface HabitatMember {
  id: string;
  kind: "task" | "chat";
  prompt: string;
  createdAt: string;
  threadId?: string;
  turnId?: string;
}
export interface Habitat {
  chatThreadId?: string;
  /** Scene construction stages: 0 land, 1 foundation, 2 frame, 3 glass, 4 door, 5 finished. */
  constructionStage?: number;
  constructionEvidence?: string[];
  id: string;
  projectId: string;
  name: string;
  plot: number;
  createdAt: string;
  topics: string[];
  members: HabitatMember[];
}
export interface CityEvent {
  id: number;
  taskId: string;
  workerId?: string;
  at: string;
  kind: string;
  message: string;
  details?: unknown;
}
export interface PendingRequest {
  id: string;
  rpcId: number | string;
  taskId: string;
  workerId: string;
  method: string;
  params: any;
}
export interface Snapshot {
  ignoredChatIds?: string[];
  projects: Project[];
  tasks: Task[];
  requests: PendingRequest[];
  events: CityEvent[];
  observedChats?: ObservedChat[];
  habitats?: Habitat[];
  runtime: {
    connected: boolean;
    authenticated: boolean;
    error?: string;
    mode: "real";
  };
}
export const level = (successes: number) => Math.min(5, 1 + successes);
const transitions: Record<TaskStatus, TaskStatus[]> = {
  queued: ["planning", "failed", "cancelled", "interrupted"],
  planning: ["running", "waiting", "failed", "cancelled", "interrupted"],
  running: ["integrating", "waiting", "failed", "cancelled", "interrupted"],
  integrating: ["checking", "waiting", "failed", "cancelled", "interrupted"],
  checking: ["succeeded", "waiting", "failed", "cancelled", "interrupted"],
  waiting: [
    "planning",
    "running",
    "integrating",
    "checking",
    "failed",
    "cancelled",
    "interrupted",
  ],
  succeeded: [],
  failed: [],
  cancelled: [],
  interrupted: [],
};
export function transition(task: Task, next: TaskStatus) {
  if (task.status === next) return;
  if (!transitions[task.status].includes(next))
    throw new Error(`Invalid transition ${task.status} → ${next}`);
  task.status = next;
  if (terminal(next)) task.endedAt = new Date().toISOString();
}
export function validatePlan(workers: Pick<Worker, "id" | "dependencies">[]) {
  if (workers.length > 8) throw new Error("Plan exceeds eight subtasks");
  const ids = new Set(workers.map((w) => w.id));
  if (ids.size !== workers.length) throw new Error("Duplicate subtask IDs");
  const visited = new Set<string>(),
    visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("Circular dependency");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const d of workers.find((w) => w.id === id)!.dependencies) {
      if (!ids.has(d)) throw new Error("Unknown dependency");
      visit(d);
    }
    visiting.delete(id);
    visited.add(id);
  }
  workers.forEach((w) => visit(w.id));
}
export function canSucceed(task: Task) {
  return (
    task.status === "checking" &&
    task.workers.length > 0 &&
    task.workers.every((w) => w.status === "completed") &&
    task.checks.length > 0 &&
    task.checks.every((c) => c.status === "passed") &&
    !task.error
  );
}

/** Prefer live work, then the most recently updated chat, without mutating snapshot order. */
export function currentObservedChat(chats: ObservedChat[] = []) {
  const busy = (c: ObservedChat) =>
    [
      "editing",
      "checking",
      "running commands",
      "inspecting",
      "planning",
    ].includes(c.worker.status)
      ? 1
      : 0;
  return [...chats].sort(
    (a, b) =>
      busy(b) - busy(a) || (b.sourceUpdatedAt || 0) - (a.sourceUpdatedAt || 0),
  )[0];
}
