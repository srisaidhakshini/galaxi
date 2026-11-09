import { useEffect, useState } from "react";
import type { ObservedChat, Project } from "../shared/domain";
export function WatchDialog({
  project,
  load,
  send,
  onClose,
}: {
  project: Project;
  load: (path: string) => Promise<any>;
  send: (path: string, body: unknown) => Promise<any>;
  onClose: () => void;
}) {
  const [chats, setChats] = useState<{ id: string; name: string }[]>([]),
    [id, setId] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    void load(`/projects/${project.id}/chats`)
      .then(setChats)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [project.id]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Watch a Codex chat"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="eyebrow">YOUR CODEX WORK, IN THE CITY</div>
        <h2>Watch a Codex chat</h2>
        <p>
          Keep prompting in Codex. The city reads recorded activity and
          illustrates the work without launching extra agents or changing the
          chat.
        </p>
        {loading ? (
          <p>Finding chats for this repository…</p>
        ) : (
          chats.map((c) => (
            <button
              className="watch-choice"
              key={c.id}
              onClick={() => setId(c.id)}
              aria-pressed={id === c.id}
            >
              {c.name}
              <small>{c.id}</small>
            </button>
          ))
        )}
        <label>
          Chat ID
          <input
            aria-label="Codex chat ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Paste a Codex thread UUID"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          disabled={!id.trim()}
          onClick={() =>
            void send("/watch", {
              threadId: id.trim(),
              projectId: project.id,
            }).then((r) => {
              if (r) onClose();
            })
          }
        >
          Watch this chat
        </button>
      </section>
    </div>
  );
}
export function WatchedChat({
  chat,
  tab,
}: {
  chat: ObservedChat;
  tab: string;
}) {
  const work = chat.activity.filter(
    (a) => a.kind === "commandExecution" || a.kind === "fileChange",
  );
  const visible =
    tab === "Chat"
      ? chat.activity.filter((a) =>
          ["userMessage", "agentMessage"].includes(a.kind),
        )
      : tab === "Changes"
        ? work.filter((a) => a.kind === "fileChange")
        : tab === "Checks"
          ? work.filter(
              (a) =>
                a.kind === "commandExecution" &&
                /\b(test|pytest|tsc|build|lint|typecheck)\b/.test(a.message),
            )
          : chat.activity;
  const displayed = tab === "Chat" ? visible : visible.toReversed();
  return (
    <div className="watched-chat">
      <div className="watch-summary">
        <span className={`badge ${chat.connected ? "running" : "failed"}`}>
          {chat.connected ? "◉ Watching Codex" : "! Watch disconnected"}
        </span>
        <h3>{chat.name}</h3>
        {chat.error && <p role="alert">{chat.error}</p>}
        <small>
          Checked{" "}
          {chat.checkedAt ? new Date(chat.checkedAt).toLocaleTimeString() : "—"}{" "}
          · Recorded activity
        </small>
        <details>
          <summary>About this connection</summary>
          <p>
            Keep prompting in Codex. This read-only view reflects recent
            recorded activity, which can lag the desktop. Execution and
            approvals stay in Codex.
          </p>
        </details>
      </div>
      {chat.prompt && tab === "Chat" && (
        <div className="watched-prompt">
          <div className="eyebrow">YOUR LATEST REQUEST</div>
          <p>{chat.prompt}</p>
        </div>
      )}
      {tab === "History" && (
        <p className="muted">
          Showing the latest recorded turn. Full conversation history stays in
          Codex. Watching never awards a building upgrade or applies changes.
        </p>
      )}
      {tab === "Checks" && (
        <p className="muted">
          Recorded verification commands. These are not Galaxi’s required-check
          gate; no success or upgrade is inferred here.
        </p>
      )}
      {displayed.length ? (
        displayed.map((a, i) => {
          if (a.kind === "commandExecution")
            return (
              <article
                key={`${a.id}-${i}`}
                className="observed-item commandExecution"
              >
                <details className="command-card">
                  <summary>
                    <span>↳ Terminal</span>
                    <span
                      className={`badge ${a.status === "completed" ? "completed" : a.status === "failed" ? "failed" : "running"}`}
                    >
                      {a.status || "Recorded"}
                    </span>
                    <code>{a.message}</code>
                  </summary>
                  <pre>{a.message}</pre>
                  {a.output && (
                    <details>
                      <summary>Command output</summary>
                      <pre>{a.output}</pre>
                    </details>
                  )}
                </details>
              </article>
            );
          return (
            <article key={`${a.id}-${i}`} className={`observed-item ${a.kind}`}>
              <small>
                {a.kind === "userMessage"
                  ? "You"
                  : a.kind === "agentMessage"
                    ? "Codex"
                    : a.kind === "fileChange"
                      ? "File edit"
                      : "Recorded command"}{" "}
                {a.status && `· ${a.status}`}
              </small>
              <p>{a.message}</p>
              {a.output && (
                <details>
                  <summary>Recorded output or patch</summary>
                  <pre>{a.output}</pre>
                </details>
              )}
            </article>
          );
        })
      ) : (
        <p className="muted">No recorded items in this view yet.</p>
      )}
    </div>
  );
}
