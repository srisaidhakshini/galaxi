import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { observedItems } from "../shared/observedViews";
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

function RecordedItems({ activity }: { activity: ObservedChat["activity"] }) {
  return (
    <>
      {activity.map((a) => {
        if (a.kind === "commandExecution") {
          const failed =
            a.status === "failed" ||
            (a.exitCode !== undefined && a.exitCode !== 0);
          const status = failed
            ? "failed"
            : a.status === "completed"
              ? "completed"
              : a.status || "Recorded";
          return (
            <article key={a.id} className="observed-item commandExecution">
              <details className="command-card">
                <summary>
                  <span>↳ Terminal</span>
                  <span
                    className={`badge ${failed ? "failed" : status === "completed" ? "completed" : "running"}`}
                  >
                    {status}
                    {a.exitCode !== undefined ? ` · exit ${a.exitCode}` : ""}
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
        }
        const label =
          {
            userMessage: "You",
            agentMessage: "Codex",
            fileChange: "File edit",
            plan: "Plan",
            mcpToolCall: "Tool",
            dynamicToolCall: "Tool",
            collabAgentToolCall: "Delegation",
          }[a.kind] || "Recorded activity";
        return (
          <article key={a.id} className={`observed-item ${a.kind}`}>
            <small>
              {label}
              {a.status ? ` · ${a.status}` : ""}
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
      })}
    </>
  );
}

export function WatchedChat({
  chat,
  tab,
  load,
  onTabChange,
  onRefresh,
}: {
  chat: ObservedChat;
  tab: string;
  load: (path: string) => Promise<any>;
  onTabChange: (tab: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now);
  const [turnId, setTurnId] = useState("");
  const [archived, setArchived] = useState<{
    turnId: string;
    activity: ObservedChat["activity"];
    truncated?: boolean;
  }>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const view = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useEffect(() => {
    const panel = view.current?.closest<HTMLElement>(".panel-content");
    if (!panel) return;
    const onScroll = () => {
      following.current =
        panel.scrollHeight - panel.scrollTop - panel.clientHeight < 100;
    };
    panel.addEventListener("scroll", onScroll, { passive: true });
    return () => panel.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const historical = !!turnId && turnId !== chat.turnId;
  useLayoutEffect(() => {
    const panel = view.current?.closest<HTMLElement>(".panel-content");
    following.current = true;
    if (panel)
      panel.scrollTop = tab === "Chat" && !historical ? panel.scrollHeight : 0;
  }, [tab, historical, turnId]);
  useLayoutEffect(() => {
    const panel = view.current?.closest<HTMLElement>(".panel-content");
    if (panel && tab === "Chat" && !historical && following.current)
      panel.scrollTop = panel.scrollHeight;
  }, [chat.activity, chat.history, tab, historical]);
  useEffect(() => {
    if (!historical) {
      setArchived(undefined);
      setLoading(false);
      setLoadError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setArchived(undefined);
    void load(
      `/watch/${encodeURIComponent(chat.threadId)}/turns/${encodeURIComponent(turnId)}`,
    )
      .then((result) => {
        if (!cancelled) setArchived(result);
      })
      .catch((e) => {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chat.threadId, turnId, historical, load]);
  const history = chat.history || [];
  const age = chat.checkedAt
    ? Math.max(0, Math.floor((now - Date.parse(chat.checkedAt)) / 1000))
    : undefined;
  const stale = age !== undefined && age > 15;
  const activity = historical
    ? archived?.turnId === turnId
      ? archived.activity
      : []
    : chat.activity;
  const turn = history.find(
    (t) => t.id === (historical ? turnId : chat.turnId),
  );
  const conversation =
    !historical && tab === "Chat"
      ? [
          ...history
            .toReversed()
            .filter((t) => t.id !== chat.turnId)
            .flatMap((t) =>
              t.messages.map((a) => ({ ...a, id: `${t.id}/${a.id}` })),
            ),
          ...chat.activity,
        ]
      : activity;
  const visible = observedItems(conversation, tab);
  const displayed = tab === "Chat" ? visible : visible.toReversed();
  return (
    <div
      ref={view}
      className="watched-chat"
      data-thread-id={chat.threadId}
      aria-busy={loading}
    >
      <div className="watch-summary">
        <div className="watch-sync-row">
          <span
            className={`badge ${!chat.connected ? "failed" : stale ? "waiting" : "running"}`}
          >
            {!chat.connected
              ? "● Disconnected"
              : stale
                ? "● Updates delayed"
                : "● Live mirror"}
          </span>
          <button
            className="text-button"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
              } finally {
                setRefreshing(false);
              }
            }}
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
        <h3>{chat.name}</h3>
        <small role="status">
          {age === undefined
            ? "Waiting for first update"
            : `Checked ${age < 2 ? "just now" : `${age}s ago`}`}{" "}
          · Recorded Codex activity
        </small>
        {chat.error && <p role="alert">{chat.error}</p>}
      </div>
      {tab !== "History" && (
        <div className="turn-scope">
          <label htmlFor="watched-turn">
            {historical
              ? "Viewing a past turn"
              : tab === "Chat"
                ? "Recent conversation · latest turn is live"
                : "Latest turn · updates automatically"}
          </label>
          <select
            id="watched-turn"
            aria-label="Recorded turn"
            value={historical ? turnId : ""}
            onChange={(e) => setTurnId(e.target.value)}
          >
            <option value="">Latest turn (live)</option>
            {history
              .filter((t) => t.id !== chat.turnId)
              .map((t, i) => (
                <option key={t.id} value={t.id}>
                  {t.prompt.slice(0, 80) || `Earlier turn ${i + 1}`}
                </option>
              ))}
          </select>
          {historical && (
            <button className="text-button" onClick={() => setTurnId("")}>
              Return to latest turn →
            </button>
          )}
        </div>
      )}
      {tab === "History" ? (
        <div className="recorded-history">
          <p className="muted">
            Recent recorded turns for this house’s chat. Open a turn to inspect
            its messages, changes and checks.
          </p>
          {(history.length
            ? history
            : chat.turnId
              ? [
                  {
                    id: chat.turnId,
                    status: chat.worker.status,
                    prompt: chat.prompt,
                    startedAt: undefined,
                    messages: [],
                  },
                ]
              : []
          ).map((t) => (
            <button
              className="history-item"
              key={t.id}
              onClick={() => {
                setTurnId(t.id === chat.turnId ? "" : t.id);
                onTabChange("Chat");
              }}
            >
              <span className="badge">
                {t.id === chat.turnId ? "Latest turn" : t.status}
              </span>
              <strong>{t.prompt || "Recorded turn"}</strong>
              <small>
                {t.startedAt
                  ? new Date(t.startedAt).toLocaleString()
                  : "Recorded in Codex"}{" "}
                · Open turn ↗
              </small>
            </button>
          ))}
          {!history.length && !chat.turnId && (
            <p className="muted">No turns recorded yet.</p>
          )}
          {chat.historyHasMore && (
            <p className="muted">
              Showing the 20 most recent turns. Older history remains in Codex.
            </p>
          )}
        </div>
      ) : (
        <>
          {loading && (
            <p className="muted" role="status">
              Loading recorded turn…
            </p>
          )}
          {loadError && <p role="alert">{loadError}</p>}
          {tab === "Chat" &&
            !visible.some((a) => a.kind === "userMessage") &&
            (historical ? turn?.prompt : chat.prompt) && (
              <div className="watched-prompt">
                <div className="eyebrow">YOUR REQUEST</div>
                <p>{historical ? turn?.prompt : chat.prompt}</p>
              </div>
            )}
          {tab === "Changes" && (
            <p className="view-note">
              Recorded patches and file-writing commands for this turn.
              Command-based edits may not include a patch.
            </p>
          )}
          {tab === "Checks" && (
            <p className="view-note">
              Recorded verification commands and their reported exit codes. A
              completed command alone does not verify the whole project.
            </p>
          )}
          <RecordedItems activity={displayed} />
          {!loading && !loadError && !displayed.length && (
            <p className="muted">
              {tab === "Checks"
                ? "No verification commands recorded for this turn yet."
                : tab === "Changes"
                  ? "No file changes recorded for this turn yet."
                  : "No recorded items in this view yet."}
            </p>
          )}
          {(historical ? archived?.truncated : chat.activityTruncated) && (
            <p className="view-note">
              Showing the latest 100 recorded items in this turn. Earlier items
              remain in Codex.
            </p>
          )}
        </>
      )}
    </div>
  );
}
