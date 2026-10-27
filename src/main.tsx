import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import City, { type CameraCommand } from "./City";
import { WatchDialog, WatchedChat } from "./WatchedChat";
import {
  level,
  terminal,
  type Snapshot,
  type Project,
  type Task,
  type Worker,
  type PendingRequest,
} from "../shared/domain";
import "./style.css";
let session = "";
async function api(path: string, body?: unknown) {
  const res = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "X-City-Session": session },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Controller request failed");
  return data;
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.replaceAll(" ", "-")}`}>
      <span aria-hidden="true">
        {status === "succeeded" || status === "passed"
          ? "✓"
          : status === "failed"
            ? "!"
            : status === "cancelled" || status === "interrupted"
              ? "■"
              : "●"}
      </span>{" "}
      {status}
    </span>
  );
}
function RequestCard({
  request,
  send,
}: {
  request: PendingRequest;
  send: (path: string, body: unknown) => Promise<any>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <article className="request">
      <div className="eyebrow">ACTION NEEDED · {request.workerId}</div>
      <strong>
        {request.method.includes("UserInput")
          ? "Your worker has a question"
          : "Codex is requesting permission"}
      </strong>
      <p>
        {request.params.reason ||
          "Review the requested action before responding."}
      </p>
      {request.params.command && <pre>{request.params.command}</pre>}
      <details>
        <summary>Request context</summary>
        <pre>{JSON.stringify(request.params, null, 2)}</pre>
      </details>
      {request.params.questions?.map((q: any) => (
        <label key={q.id}>
          {q.question}
          {q.options?.length ? (
            <select
              value={answers[q.id] || ""}
              onChange={(e) =>
                setAnswers({ ...answers, [q.id]: e.target.value })
              }
            >
              <option value="">Choose an answer</option>
              {q.options.map((o: any) => (
                <option key={o.label} value={o.label}>
                  {o.label} — {o.description}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={answers[q.id] || ""}
              onChange={(e) =>
                setAnswers({ ...answers, [q.id]: e.target.value })
              }
            />
          )}
        </label>
      ))}
      <div className="button-row">
        {request.method.includes("UserInput") ? (
          <button
            className="primary"
            onClick={() =>
              void send("/requests/" + request.id, {
                answers: Object.fromEntries(
                  Object.entries(answers).map(([k, v]) => [k, [v]]),
                ),
              })
            }
          >
            Send answers
          </button>
        ) : (
          ["accept", "decline", "cancel"]
            .filter(
              (d) => !request.method.includes("permissions") || d !== "cancel",
            )
            .filter(
              (d) =>
                !request.params.availableDecisions ||
                request.params.availableDecisions.includes(d),
            )
            .map((d) => (
              <button
                key={d}
                className={d === "accept" ? "primary" : ""}
                onClick={() =>
                  void send("/requests/" + request.id, { decision: d })
                }
              >
                {d === "accept"
                  ? "Allow once"
                  : d === "decline"
                    ? "Decline"
                    : "Cancel"}
              </button>
            ))
        )}
      </div>
    </article>
  );
}
function App() {
  const [state, setState] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState(
    localStorage.getItem("city-project") || "",
  );
  const [tab, setTab] = useState("Chat");
  const [taskId, setTaskId] = useState("");
  const [adding, setAdding] = useState(false);
  const [watchPicker, setWatchPicker] = useState(false);
  const [cityExecution, setCityExecution] = useState(false);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [simple, setSimple] = useState(
    localStorage.getItem("city-simple") === "true",
  );
  const [motion, setMotion] = useState(
    localStorage.getItem("city-motion") !== "reduced",
  );
  const [reset, setReset] = useState(0);
  const [pan, setPan] = useState(true);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>();
  const moveCamera = (action: CameraCommand["action"]) =>
    setCameraCommand({ action, id: Date.now() });
  const [focus, setFocus] = useState<number>();
  const [inspectedWorker, setWorker] = useState<Worker>();
  const [concurrency, setConcurrency] = useState(2);
  const [follow, setFollow] = useState(false);
  const [target, setTarget] = useState("lead");
  const [applyConfirm, setApplyConfirm] = useState(false);
  const cursor = useRef(0);
  const refreshing = useRef(false);
  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const s: Snapshot = await api("/state?after=" + cursor.current);
      setState((prev) => {
        const events = [...(prev?.events || []), ...s.events].filter(
          (e, i, all) => all.findIndex((x) => x.id === e.id) === i,
        );
        cursor.current = Math.max(cursor.current, ...s.events.map((e) => e.id));
        return { ...s, events };
      });
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setError(String(e));
    } finally {
      refreshing.current = false;
    }
  }
  useEffect(() => {
    let source: EventSource;
    let timer: ReturnType<typeof setInterval>;
    void api("/session")
      .then((s) => {
        session = s.token;
        void refresh();
        source = new EventSource("/api/events");
        source.addEventListener("update", () => void refresh());
        source.onerror = () => setConnected(false);
        source.onopen = () => setConnected(true);
        timer = setInterval(() => void refresh(), 5000);
      })
      .catch((e) => setError(String(e)));
    return () => {
      source?.close();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("city-project", selected);
    setTaskId("");
    setWorker(undefined);
    setApplyConfirm(false);
  }, [selected]);
  const worker = inspectedWorker
    ? [
        ...(state?.tasks.flatMap((t) => t.workers) || []),
        ...(state?.observedChats?.map((c) => c.worker) || []),
      ].find(
        (w) =>
          w.workspace === inspectedWorker.workspace &&
          w.id === inspectedWorker.id,
      ) || inspectedWorker
    : undefined;
  const projects = state?.projects || [],
    tasks = state?.tasks || [],
    project = projects.find((p) => p.id === selected),
    projectTasks = tasks.filter((t) => t.projectId === selected);
  const task = projectTasks.find((t) => t.id === taskId) || projectTasks.at(-1);
  const observed = state?.observedChats
    ?.filter((c) => c.projectId === selected)
    .at(-1);
  const watching = !!observed && !cityExecution;
  const active = projectTasks.find((t) => !terminal(t.status));
  const events = (state?.events || []).filter((e) => e.taskId === task?.id);
  const requests = state?.requests.filter((r) => r.taskId === task?.id) || [];
  async function send(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await api(path, body);
      await refresh();
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function select(id: string) {
    setCityExecution(false);
    setTaskId("");
    setWorker(undefined);
    setApplyConfirm(false);
    setSelected(id);
    setTab("Chat");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !prompt.trim()) return;
    const r =
      follow && active
        ? await send(`/tasks/${active.id}/steer`, {
            text: prompt,
            workerId: target,
          })
        : await send("/tasks", { projectId: project.id, prompt, concurrency });
    if (r) {
      setPrompt("");
      if (r.id) setTaskId(r.id);
    }
  }
  const activeWorkers =
    tasks
      .filter((t) => !terminal(t.status))
      .flatMap((t) => t.workers)
      .filter((w) => w.threadId).length +
    (state?.observedChats?.filter(
      (c) => !["idle", "completed", "blocked"].includes(c.worker.status),
    ).length || 0);
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Codex City home">
          <span className="brand-icon">▥</span>
          <span>
            codex<span className="brand-light">city</span>
            <small>A PLACE FOR YOUR PROJECTS</small>
          </span>
        </a>
        <div className="workspace-label">
          YOUR WORKSPACE <span>LOCAL</span>
        </div>
        <button className="nav-current" onClick={() => setSelected("")}>
          <span>◈</span> City overview{" "}
          <span className="count">{projects.length}</span>
        </button>
        <div className="project-heading">
          <span>PROJECTS</span>
          <button
            title="Add project"
            aria-label="Add project"
            onClick={() => setAdding(true)}
          >
            ＋
          </button>
        </div>
        <input
          className="search"
          aria-label="Search projects"
          placeholder="⌕  Find a project"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <nav className="projects">
          {projects
            .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
            .map((p) => {
              const t = tasks.filter((t) => t.projectId === p.id).at(-1);
              return (
                <button
                  key={p.id}
                  className={`project-nav ${selected === p.id ? "active" : ""}`}
                  onClick={() => select(p.id)}
                >
                  <span
                    className="project-glyph"
                    style={{
                      background: ["#e9d7c8", "#d5e2db", "#e8dfc6"][p.plot % 3],
                    }}
                  >
                    ▤
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {t && !terminal(t.status)
                        ? t.status
                        : `Level ${level(p.successes)} · ${p.successes} completed`}
                    </small>
                  </span>
                  <span className={`status-dot ${t?.status || "idle"}`} />
                </button>
              );
            })}
          {!projects.length && (
            <p className="nav-empty">
              A little empty, for now.
              <br />
              Connect a repository to break ground.
            </p>
          )}
        </nav>
        <button className="add-project" onClick={() => setAdding(true)}>
          ＋ Add project
        </button>
        <div className="sidebar-bottom">
          <div className="runtime-state">
            <span
              className={`status-dot ${state?.runtime.connected ? "succeeded" : "failed"}`}
            />
            <strong>
              {state?.runtime.connected
                ? "Codex connected"
                : "Codex unavailable"}
            </strong>
            <span className="real-label">REAL</span>
          </div>
          <p>
            {state?.runtime.authenticated
              ? "Using your local Codex session"
              : "Run codex login, then reconnect."}
          </p>
          <button
            className="text-button"
            onClick={() => void send("/runtime/reconnect", {})}
          >
            ↻ Reconnect runtime
          </button>
          <div className="user">
            <span>Y</span>
            <div>
              Your local workspace
              <small>On your machine. In your control.</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              Workspace <span>/</span>
            </span>{" "}
            Your city
          </div>
          <div className="top-status">
            <span
              className={`status-dot ${connected ? "succeeded" : "failed"}`}
            />
            {connected ? "Controller online" : "Controller disconnected"}
            <span className="top-separator" /> <span>Local execution</span>
          </div>
        </header>
        <div className="page-heading">
          <div className="eyebrow">BUILD SOMETHING THAT LASTS</div>
          <div className="heading-row">
            <div>
              <h1>
                Your projects, taking shape<span>.</span>
              </h1>
              <p>A living workspace. Real agents. One building at a time.</p>
            </div>
            <button className="primary" onClick={() => setAdding(true)}>
              ＋ Connect repository
            </button>
          </div>
        </div>
        <section className="stats" aria-label="Workspace statistics">
          <div>
            <span className="stat-icon">▥</span>
            <span>
              <strong>{projects.length.toString().padStart(2, "0")}</strong>
              <small>Projects in your city</small>
            </span>
          </div>
          <div>
            <span className="stat-icon amber">⚒</span>
            <span>
              <strong>{activeWorkers.toString().padStart(2, "0")}</strong>
              <small>Workers on site</small>
            </span>
          </div>
          <div>
            <span className="stat-icon green">✓</span>
            <span>
              <strong>
                {projects
                  .reduce((n, p) => n + p.successes, 0)
                  .toString()
                  .padStart(2, "0")}
              </strong>
              <small>Tasks completed</small>
            </span>
          </div>
          <div className="city-note">
            <span>✦</span>
            <p>
              Small tasks.
              <br />
              <strong>Lasting foundations.</strong>
            </p>
          </div>
        </section>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {!!state?.requests.length && !requests.length && (
          <button
            className="urgent-banner"
            onClick={() =>
              select(
                tasks.find((t) => t.id === state.requests[0].taskId)!.projectId,
              )
            }
          >
            ! A worker needs your response. Open project →
          </button>
        )}
        {!!state?.observedChats?.length && (
          <button
            className="watch-linkbar"
            onClick={() => {
              const c = state.observedChats!.at(-1)!;
              const p = projects.find((p) => p.id === c.projectId);
              select(c.projectId);
              if (p) {
                setFocus(p.plot);
                setReset((x) => x + 1);
              }
            }}
          >
            ◉ Watching your Codex chat{" "}
            <span>{state.observedChats.at(-1)!.name}</span>
            <strong>View work in the city →</strong>
          </button>
        )}
        <section className={`city-shell ${project ? "with-panel" : ""}`}>
          <div className="world">
            <div className="world-top">
              <span>
                <span className="live-dot" /> CITY VIEW{" "}
                <small>01 / YOUR NEIGHBORHOOD</small>
              </span>
              <div>
                <button
                  title="Reset city camera"
                  aria-label="Reset city camera"
                  onClick={() => {
                    setFocus(undefined);
                    setReset((x) => x + 1);
                  }}
                >
                  ⌂ <span>Reset view</span>
                </button>
                <button
                  aria-pressed={simple}
                  onClick={() => {
                    setSimple(!simple);
                    localStorage.setItem("city-simple", String(!simple));
                  }}
                >
                  {simple ? "3D view" : "Simple view"}
                </button>
              </div>
            </div>
            <City
              projects={projects}
              tasks={tasks}
              selected={selected}
              onSelect={select}
              onWorker={setWorker}
              motion={motion}
              simple={simple}
              reset={reset}
              focus={focus}
              onFail={() => setSimple(true)}
              pan={pan}
              cameraCommand={cameraCommand}
              observedChats={state?.observedChats}
            />
            {!projects.length && (
              <div className="city-welcome">
                <div>
                  <strong>Your next project lives here.</strong>
                  <span>Connect a repository to break ground.</span>
                </div>
                <button className="primary" onClick={() => setAdding(true)}>
                  ＋ Add project
                </button>
              </div>
            )}
            {!simple && (
              <div
                className="camera-tools"
                role="toolbar"
                aria-label="City camera controls"
              >
                <div>
                  <button
                    aria-label="Pan camera with drag"
                    aria-pressed={pan}
                    onClick={() => setPan(true)}
                  >
                    ✥ Move
                  </button>
                  <button
                    aria-label="Orbit camera with drag"
                    aria-pressed={!pan}
                    onClick={() => setPan(false)}
                  >
                    ⟳ Orbit
                  </button>
                </div>
                <div>
                  <button
                    aria-label="Rotate camera left"
                    onClick={() => moveCamera("left")}
                  >
                    ↶
                  </button>
                  <button
                    aria-label="Rotate camera right"
                    onClick={() => moveCamera("right")}
                  >
                    ↷
                  </button>
                  <span />
                  <button aria-label="Zoom in" onClick={() => moveCamera("in")}>
                    ＋
                  </button>
                  <button
                    aria-label="Zoom out"
                    onClick={() => moveCamera("out")}
                  >
                    −
                  </button>
                  <button
                    aria-label="Top down view"
                    onClick={() => moveCamera("top")}
                  >
                    ▦
                  </button>
                </div>
              </div>
            )}
            <div className="world-bottom">
              <span>
                {pan ? "Drag to move" : "Drag to orbit"} <i /> Scroll to zoom
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={!motion}
                  onChange={(e) => {
                    setMotion(!e.target.checked);
                    localStorage.setItem(
                      "city-motion",
                      e.target.checked ? "reduced" : "animated",
                    );
                  }}
                />{" "}
                Reduced motion
              </label>
            </div>
          </div>
          {project && (
            <aside className="detail-panel">
              <div className="panel-header">
                <div className="eyebrow">
                  PROJECT WORKSHOP <span>LEVEL {level(project.successes)}</span>
                </div>
                <div className="panel-title">
                  <h2>{project.name}</h2>
                  <button
                    aria-label="Close project"
                    onClick={() => setSelected("")}
                  >
                    ×
                  </button>
                </div>
                <p title={project.path}>{project.path}</p>
                <div className="button-row">
                  <button onClick={() => setWatchPicker(true)}>
                    ◉ Watch Codex chat
                  </button>
                  <button
                    onClick={() => {
                      setFocus(project.plot);
                      setReset((x) => x + 1);
                    }}
                  >
                    ◎ Focus building
                  </button>
                  <button
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(task?.workspace || project.path)
                        .catch(() => setError("Clipboard unavailable"))
                    }
                  >
                    Copy workspace
                  </button>
                </div>
              </div>
              {observed && (
                <div className="watch-mode">
                  <button
                    aria-pressed={watching}
                    onClick={() => setCityExecution(false)}
                  >
                    Watch Codex
                  </button>
                  <button
                    aria-pressed={!watching}
                    onClick={() => setCityExecution(true)}
                  >
                    Separate City task
                  </button>
                </div>
              )}
              <div className="tabs" role="tablist">
                {["Chat", "Activity", "Changes", "Checks", "History"].map(
                  (t) => (
                    <button
                      role="tab"
                      aria-selected={tab === t}
                      key={t}
                      onClick={() => setTab(t)}
                    >
                      {t}
                      {t === "Checks" &&
                      task?.checks.some((c) => c.status === "failed")
                        ? " !"
                        : ""}
                    </button>
                  ),
                )}
              </div>
              <div className="panel-content">
                {watching && observed && (
                  <WatchedChat chat={observed} tab={tab} />
                )}
                {requests.map((r) => (
                  <RequestCard key={r.id} request={r} send={send} />
                ))}
                {task && !watching && (
                  <div className="task-summary">
                    <Badge status={task.status} />
                    <span>
                      {new Date(task.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <p>{task.prompt}</p>
                    {task.error && (
                      <div className="task-error">{task.error}</div>
                    )}
                  </div>
                )}
                {!watching && tab === "Chat" && (
                  <>
                    {!task && (
                      <div className="panel-empty">
                        <span>↗</span>
                        <h3>What are we building?</h3>
                        <p>
                          Describe a coding task. A lead will plan the work,
                          delegate when useful, and verify the result in an
                          isolated workspace.
                        </p>
                        <div className="check-preview">
                          <strong>Required checks</strong>
                          {project.checks.map((c) => (
                            <code key={c}>{c}</code>
                          ))}
                        </div>
                      </div>
                    )}
                    {task?.plan && (
                      <details className="plan" open>
                        <summary>Lead’s plan</summary>
                        <p>{task.plan}</p>
                        {task.workers
                          .filter((w) => w.role !== "Lead")
                          .map((w) => (
                            <button
                              className="assignment"
                              key={w.id}
                              onClick={() => setWorker(w)}
                            >
                              <strong>
                                {w.id} <Badge status={w.status} />
                              </strong>
                              <span>{w.description}</span>
                              <small>
                                Depends on:{" "}
                                {w.dependencies.join(", ") || "none"}
                              </small>
                            </button>
                          ))}
                      </details>
                    )}
                    {task?.messages
                      .filter((m, i) => m.role !== "user" || i > 0)
                      .map((m, i) => (
                        <article className="message" key={i}>
                          <strong>
                            <span className="agent-avatar">⌘</span> {m.role}
                            <small>{m.workerId}</small>
                          </strong>
                          <p>{m.text}</p>
                        </article>
                      ))}
                  </>
                )}
                {!watching && tab === "Activity" && (
                  <div className="activity-list">
                    {events.length ? (
                      events.map((e) => (
                        <article key={e.id}>
                          <span className="event-dot" />
                          <div>
                            <small>
                              {new Date(e.at).toLocaleTimeString()} ·{" "}
                              {e.workerId || "controller"}
                            </small>
                            <p>{e.message}</p>
                            {e.details !== undefined && (
                              <details>
                                <summary>Execution details</summary>
                                <pre>{JSON.stringify(e.details, null, 2)}</pre>
                              </details>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="muted">
                        Actual execution events will appear here.
                      </p>
                    )}
                  </div>
                )}
                {!watching && tab === "Changes" && (
                  <>
                    {task ? (
                      <>
                        <div className="result-status">
                          <strong>
                            {task.applied
                              ? "✓ Applied to original checkout"
                              : "Isolated result · not applied"}
                          </strong>
                          <code>{task.workspace}</code>
                        </div>
                        {task.files.map((f) => (
                          <div className="file" key={f}>
                            {f}
                          </div>
                        ))}
                        <pre className="diff">
                          {task.diff ||
                            "No recorded diff yet. Changes are captured after integration or when execution stops."}
                        </pre>
                        {task.status === "succeeded" &&
                          !task.applied &&
                          (applyConfirm ? (
                            <div className="request">
                              <p>
                                Fast-forward the clean original checkout to this
                                task’s verified result? This changes the
                                original branch.
                              </p>
                              <button
                                className="primary"
                                onClick={() =>
                                  void send(`/tasks/${task.id}/apply`, {}).then(
                                    () => setApplyConfirm(false),
                                  )
                                }
                              >
                                Confirm apply result
                              </button>
                              <button onClick={() => setApplyConfirm(false)}>
                                Keep isolated
                              </button>
                            </div>
                          ) : (
                            <button
                              className="primary"
                              onClick={() => setApplyConfirm(true)}
                            >
                              Apply verified result…
                            </button>
                          ))}
                      </>
                    ) : (
                      <p className="muted">
                        Changes from your tasks will appear here.
                      </p>
                    )}
                  </>
                )}
                {!watching && tab === "Checks" && (
                  <>
                    {(
                      task?.checks ||
                      project.checks.map((command) => ({
                        command,
                        cwd: project.path,
                        status: "pending",
                      }))
                    ).map((c, i) => (
                      <article className="check" key={i}>
                        <Badge status={c.status} />
                        <code>{c.command}</code>
                        <small>{c.cwd}</small>
                        {"output" in c && (
                          <details>
                            <summary>
                              Output · exit {c.exitCode} ·{" "}
                              {c.startedAt &&
                                new Date(c.startedAt).toLocaleTimeString()}{" "}
                              →{" "}
                              {c.endedAt &&
                                new Date(c.endedAt).toLocaleTimeString()}
                            </summary>
                            <pre>{c.output || "No output"}</pre>
                          </details>
                        )}
                      </article>
                    ))}
                    <p className="muted">
                      Every required check must pass against the combined
                      result. Failed checks never award a building upgrade.
                    </p>
                  </>
                )}
                {!watching && tab === "History" && (
                  <>
                    {projectTasks.length ? (
                      projectTasks.toReversed().map((t) => (
                        <button
                          className="history-item"
                          key={t.id}
                          onClick={() => {
                            setTaskId(t.id);
                            setTab("Chat");
                          }}
                        >
                          <Badge status={t.status} />
                          <strong>{t.prompt}</strong>
                          <small>
                            {new Date(t.createdAt).toLocaleString()} ·{" "}
                            {t.endedAt
                              ? `${Math.round((Date.parse(t.endedAt) - Date.parse(t.createdAt)) / 1000)}s`
                              : "in progress"}
                          </small>
                          <small>
                            {t.workers.length} workers ·{" "}
                            {t.awarded ? "Upgrade awarded" : "No upgrade"} ·{" "}
                            {t.applied ? "Applied" : "Retained result"}
                          </small>
                        </button>
                      ))
                    ) : (
                      <p className="muted">
                        Your project’s story starts with its first task.
                      </p>
                    )}
                  </>
                )}
              </div>
              {watching && observed ? (
                <div className="watch-footer">
                  <strong>Keep prompting in Codex.</strong>
                  <p>
                    This city watches that chat; it does not queue another
                    coding task.
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      void send(`/watch/${observed.threadId}/stop`, {})
                    }
                  >
                    Stop watching
                  </button>
                </div>
              ) : (
                <form className="composer" onSubmit={submit}>
                  {active && (
                    <div className="composer-mode">
                      <label>
                        <input
                          type="checkbox"
                          checked={follow}
                          onChange={(e) => setFollow(e.target.checked)}
                        />{" "}
                        Steer active task
                      </label>
                      {follow && (
                        <select
                          aria-label="Worker to steer"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        >
                          {active.workers
                            .filter((w) => w.turnId)
                            .map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.id}
                              </option>
                            ))}
                        </select>
                      )}
                      <button
                        type="button"
                        className="danger-link"
                        onClick={() =>
                          void send(`/tasks/${active.id}/cancel`, {})
                        }
                      >
                        Stop task
                      </button>
                    </div>
                  )}
                  <textarea
                    aria-label="Coding task"
                    placeholder={
                      follow && active
                        ? "Send guidance to an active worker…"
                        : "Describe what you’d like to build…"
                    }
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={busy}
                  />
                  <div className="composer-bottom">
                    <label>
                      <select
                        aria-label="Worker concurrency"
                        value={concurrency}
                        onChange={(e) => setConcurrency(Number(e.target.value))}
                      >
                        <option value={2}>2 workers + lead</option>
                        <option value={1}>1 worker + lead</option>
                      </select>
                    </label>
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        !prompt.trim() ||
                        (!!active && !follow) ||
                        !state?.runtime.authenticated
                      }
                    >
                      {follow && active ? "Send follow-up" : "Start task"} ↗
                    </button>
                  </div>
                  {task &&
                    ["failed", "interrupted", "cancelled"].includes(
                      task.status,
                    ) && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy || !!active}
                        onClick={() =>
                          void send("/tasks", {
                            projectId: project.id,
                            prompt: task.prompt,
                            concurrency,
                            attemptOf: task.id,
                          })
                        }
                      >
                        ↻ Retry as a new attempt
                      </button>
                    )}
                </form>
              )}
            </aside>
          )}
        </section>
        <footer className="page-footer">
          <span>
            <span className="status-dot succeeded" /> Your city is saved locally
          </span>
          <span>Built with intention. Powered by Codex.</span>
        </footer>
      </main>
      {watchPicker && project && (
        <WatchDialog
          project={project}
          load={api}
          send={send}
          onClose={() => setWatchPicker(false)}
        />
      )}
      {adding && (
        <div className="modal-backdrop" onClick={() => setAdding(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close"
              onClick={() => setAdding(false)}
            >
              ×
            </button>
            <div className="eyebrow">BREAK NEW GROUND</div>
            <h2 id="add-title">A place for your project.</h2>
            <p>
              Connect an existing local Git repository. Tasks run in isolated
              worktrees and leave your checkout intact.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const checks = String(f.get("checks"))
                  .split("\n")
                  .map((c) => c.trim())
                  .filter(Boolean);
                const p: Project | undefined = await send("/projects", {
                  path: f.get("path"),
                  name: f.get("name") || undefined,
                  ...(checks.length ? { checks } : {}),
                });
                if (p) {
                  setAdding(false);
                  select(p.id);
                }
              }}
            >
              <label>
                Project name <span>optional</span>
                <input name="name" placeholder="My next great idea" autoFocus />
              </label>
              <label>
                Absolute repository path
                <input
                  name="path"
                  required
                  placeholder="D:\Projects\my-project"
                />
              </label>
              <label>
                Required verification commands <span>one per line</span>
                <textarea
                  name="checks"
                  placeholder={
                    "Auto-detect npm scripts, or enter commands\ne.g. npm test\nnpm run build"
                  }
                />
              </label>
              <p className="form-note">
                Commands run locally with your account’s permissions. Enter
                commands you trust. Repositories without detectable checks need
                an explicit verification command.
              </p>
              {error && (
                <p className="task-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? "Connecting…" : "Connect repository →"}
              </button>
            </form>
          </section>
        </div>
      )}
      {worker && (
        <div className="modal-backdrop" onClick={() => setWorker(undefined)}>
          <section
            className="modal worker-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Worker details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setWorker(undefined)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="eyebrow">EXECUTION ROLE</div>
            <h2>
              {worker.role} · {worker.id}
            </h2>
            <Badge status={worker.status} />
            <p>{worker.description}</p>
            <strong>Latest activity</strong>
            <p>{worker.latest}</p>
            <strong>Expected output</strong>
            <p>{worker.expectedOutput}</p>
            <strong>Workspace</strong>
            <code>{worker.workspace}</code>
            <details>
              <summary>Session details</summary>
              <pre>{JSON.stringify(worker, null, 2)}</pre>
            </details>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
