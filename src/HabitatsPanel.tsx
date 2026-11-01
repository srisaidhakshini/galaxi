import {
  habitatPromptCount,
  habitatFeatures,
  domeScale,
  DOME_MAX_PROMPTS,
} from "../shared/habitatGrowth";
import { useEffect, useState } from "react";
import type { Habitat, Task, ObservedChat } from "../shared/domain";
export function HabitatsPanel({
  projectId,
  habitats,
  tasks,
  chats,
  selected,
  onSelect,
  send,
  onOpenTask,
}: {
  projectId: string;
  habitats: Habitat[];
  tasks: Task[];
  chats: ObservedChat[];
  selected?: string;
  onSelect: (id: string) => void;
  send: (path: string, body: unknown) => Promise<any>;
  onOpenTask?: (id: string) => void;
}) {
  const [name, setName] = useState(""),
    [rename, setRename] = useState("");
  const active = habitats.find((h) => h.id === selected);
  useEffect(() => setRename(active?.name || ""), [active?.id, active?.name]);
  return (
    <div className="habitats-panel">
      <div className="habitats-intro">
        <div className="eyebrow">PROJECT RESEARCH DISTRICT</div>
        <h3>
          {habitats.length} habitat{habitats.length === 1 ? "" : "s"} ·{" "}
          {habitats.reduce((n, h) => n + h.members.length, 0)} assignments
        </h3>
        <p>
          Each Codex chat has one dome. New prompts in that chat continue work
          on the same building.
        </p>
      </div>
      <form
        className="new-habitat"
        onSubmit={async (e) => {
          e.preventDefault();
          const h = await send("/habitats", { projectId, name });
          if (h) {
            setName("");
            onSelect(h.id);
          }
        }}
      >
        <input
          aria-label="New habitat name"
          placeholder="Reserve a site for your next prompt…"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="primary" disabled={!name.trim()}>
          ＋ Reserve site
        </button>
      </form>
      <div className="habitat-list">
        {habitats.map((h) => {
          const running =
            tasks.some(
              (t) =>
                t.habitatId === h.id &&
                !["succeeded", "failed", "cancelled", "interrupted"].includes(
                  t.status,
                ),
            ) ||
            chats.some(
              (c) =>
                c.habitatId === h.id &&
                [
                  "editing",
                  "checking",
                  "running commands",
                  "inspecting",
                ].includes(c.worker.status),
            );
          return (
            <button
              className={`habitat-card ${selected === h.id ? "selected" : ""}`}
              key={h.id}
              onClick={() => onSelect(h.id)}
            >
              <span className="habitat-card-icon">⌒</span>
              <span>
                <strong>{h.name}</strong>
                <small>
                  {h.members.length} assignment
                  {h.members.length === 1 ? "" : "s"} ·{" "}
                  {running ? "Recent work" : "Recorded site"}
                </small>
              </span>
              <span className="habitat-visit">View ↗</span>
            </button>
          );
        })}
      </div>
      {!habitats.length && (
        <p className="muted">
          A site appears after a new prompt. Completed buildings stay in your
          village.
        </p>
      )}
      {active && (
        <section className="habitat-inspector">
          <div className="eyebrow">SELECTED HABITAT</div>
          <p className="muted">
            {habitatPromptCount(active)} recorded prompts ·{" "}
            {Math.round(domeScale(habitatPromptCount(active)) * 100)}% dome size
            · Growth caps at {DOME_MAX_PROMPTS} prompts.
          </p>
          <p className="muted">
            Built features:{" "}
            {Object.entries(
              habitatFeatures(
                habitatPromptCount(active),
                active.constructionStage ?? 5,
              ),
            )
              .filter(
                ([key, value]) =>
                  key !== "stage" && key !== "glassPanels" && value === true,
              )
              .map(([key]) => key)
              .join(", ") || "marked land"}
            . Glass panels:{" "}
            {
              habitatFeatures(
                habitatPromptCount(active),
                active.constructionStage ?? 5,
              ).glassPanels
            }
            /8.
          </p>
          <form
            className="rename-habitat"
            onSubmit={async (e) => {
              e.preventDefault();
              await send(`/habitats/${active.id}`, { name: rename });
            }}
          >
            <input
              aria-label="Habitat name"
              value={rename}
              maxLength={60}
              onChange={(e) => setRename(e.target.value)}
            />
            <button disabled={!rename.trim() || rename === active.name}>
              Rename
            </button>
          </form>
          <p className="muted">
            Choose where each assignment belongs. Related work can share a
            habitat, and these choices persist across restarts.
          </p>
          {active.members.map((m) => {
            const task = tasks.find((t) => t.id === m.id),
              chat = chats.find(
                (c) => c.threadId === m.threadId && c.turnId === m.turnId,
              );
            return (
              <article className="habitat-member" key={`${m.kind}-${m.id}`}>
                <small>
                  {m.kind === "task" ? "City task" : "Codex chat turn"} ·{" "}
                  {task?.status || chat?.worker.status || "Recorded"}
                </small>
                <p>{m.prompt}</p>
                {task && onOpenTask && (
                  <button
                    className="text-button"
                    onClick={() => onOpenTask(task.id)}
                  >
                    View execution, changes and checks →
                  </button>
                )}
                {m.kind === "task" && (
                  <label>
                    Habitat
                    <select
                      aria-label={`Habitat for ${m.prompt.slice(0, 50)}`}
                      value={active.id}
                      onChange={(e) =>
                        void send(`/habitats/${e.target.value}/assign`, {
                          kind: m.kind,
                          memberId: m.id,
                        })
                      }
                    >
                      {habitats.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
