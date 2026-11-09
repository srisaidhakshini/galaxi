# Codex City

A local 3D workspace for real Codex coding agents. Connect a Git repository, submit a task, and watch a lead coordinate isolated implementation workers. Results stay in a separate task branch until you explicitly apply them.

## Run

The local companion can pair with a separately hosted website for read-only observation. Open **Browser connections** in the local window, approve the website's origin, and enter its one-time code on the website. Connections expire and can be revoked. See [pairing setup and deployment boundaries](docs/PAIRING.md).

The outpost gives each project a circular village on continuous terrain, with a central park, fountain and trees. Each Codex chat gets one persistent dome within its project. New prompts in that chat reuse the same building; different chats get separate domes. Earlier per-turn domes consolidate while preserving prompt history and construction progress. Separate City runner tasks retain their own work-site grouping. Related prompts share a habitat through lightweight keyword matching; use the **Habitats** tab to create, rename, or move assignments manually. The task composer can target a specific habitat. Click a dome to focus its crew, or focus the district to see its whole camp.

Workers appear at their assigned work site, collecting materials, carrying bricks, placing them and hammering during observed editing. New sites start as marked land, then gain a foundation, frame, glass, door and interior. Construction stages persist; previously built domes stay built. Stages illustrate recorded execution milestones rather than a measured percentage of code completion. Site grouping does not combine execution workspaces or change verification and success counts. Watching establishes the current turn as a baseline; subsequent prompts receive assignments without backfilling old chat history. Empty reserved sites do not render a dome until a prompt is assigned.

Prerequisites: Node.js **24+**, npm, Git, and an authenticated Codex CLI on PATH. Windows also needs Windows PowerShell (used for configured verification commands). Tested with Node 24.21.0 and Codex 0.164.0-alpha.11.1.

```powershell
npm ci
codex login
npm run dev
```

Open **http://127.0.0.1:4310**. Use this exact host; the controller deliberately rejects other hosts and origins. The controller launches its own `codex app-server --stdio`, using Codex's existing authentication. No API key needs to be pasted into the application. If already authenticated, skip `codex login`.

Production:

```powershell
npm run build
npm start
```

The production controller serves the built browser bundle and API on the same loopback port. Keep development dependencies installed: `tsx` runs the TypeScript controller. Backend edits require restarting the controller; Vite updates frontend edits automatically.

## First task

1. Select **Connect repository** and enter the absolute root of an existing Git repository with at least one commit.
2. Accept detected npm test/lint/typecheck/build scripts or specify trusted verification commands, one per line. Commands must terminate; do not use watch mode. No detected checks means you must supply a meaningful check.
3. Commit any existing uncommitted work yourself. The application refuses dirty checkouts and does not stash or discard changes.
4. Submit a coding prompt. The lead inspects and returns a structured plan; up to two implementation workers run at a time, each in its own worktree.
5. Inspect Chat, Activity, Changes, Checks, and History. Genuine requests appear prominently in the project panel. Steering targets a specific active worker; it does not create another task.
6. Successful execution plus passing controller-run checks upgrades the building once. A successful result is still **not applied** to your original checkout.
7. In Changes, select **Apply verified result…** and confirm. Application uses fast-forward only, and refuses a dirty or moved original branch. Otherwise merge the retained branch yourself after review.

Repository scripts are executable local code. Register repositories and verification commands you trust. Controller verification commands run with your normal account permissions; agent commands use Codex's sandbox and approval policies. Task worktrees do not inherit ignored `node_modules`, virtual environments, or secrets. Give the agent appropriate setup instructions, or configure an explicit setup-and-verification command such as `npm ci; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm test` on Windows. Network requests from agent execution may require approval.

## Watch work from your existing Codex chat

Select a project and choose **Watch Codex chat**, then pick a chat for that repository. Keep giving prompts in Codex: the city reads its latest recorded prompt, public messages, commands and file edits every two seconds. It does not submit another task, start extra agents, resume the chat, interrupt it, or control its approvals. Choose **Separate City task** only when you want the independent orchestration runner described above.

Watch connections persist. To attach a known chat when starting the controller, set `CITY_WATCH_THREAD` to its thread UUID. Its repository can be registered for observation without verification commands; such a project is watch-only until checks are configured. Observed work does not award upgrades or claim that City verification passed. Recorded activity can lag the desktop, and a separate App Server cannot reliably report another client's live turn status. The panel labels this limitation; no missing event is treated as success.

## City navigation

Use **Move** to pan by dragging, or **Orbit** to rotate. The scene toolbar also offers rotate left/right, zoom, top-down view and reset buttons. Focus a selected project from its panel. Worker badges open the real session details; walking, material carrying and hammering illustrate observed execution states. Enable reduced motion to stop scene animation.

## Configuration

Copy [.env.example](.env.example) to `.env` if needed. The run commands load it. No secrets are required in that file.

- `PORT`: loopback port, default `4310`.
- `CODEX_BIN`: absolute Codex executable path if unavailable on PATH.
- `CITY_DATA_DIR`: database and retained worktree directory, default `.local` relative to launch directory. Keep it outside tracked source.
- `CITY_MODEL`: optional model supported by your Codex account; unset uses the runtime default.
- `CITY_WATCH_THREAD`: optional existing Codex thread UUID to attach in read-only watch mode at startup. Watch selections also persist in SQLite.

Concurrency is selectable per task: one or two implementation workers plus a lead. At most eight subtasks, validated for unique IDs and acyclic dependencies. No automatic retries. Each check has a five-minute timeout; each worker turn has a thirty-minute timeout. A Git operation has a two-minute timeout.

## Persistence and recovery

SQLite initializes automatically; no database service is needed. Schema v1 creates snapshot, event-journal, and exactly-once award tables and sets `PRAGMA user_version=1`. WAL mode is enabled. Back up the data directory while the controller is stopped, **and the connected repositories**: worktrees depend on each repository's Git metadata. Future schema migrations must inspect `user_version`; there are no earlier supported schemas to migrate.

Browser refresh reconnects to authoritative snapshots and replays missing journal events by monotonically increasing ID. On controller restart, uncertain tasks become interrupted and pending runtime requests expire. Workspaces and completed history remain. Retry starts a new attempt from the original branch's current HEAD, rather than guessing whether old work finished. There is no automatic continuation of interrupted runtime threads.

Results live under `.local/workspaces/<task-id>/integration`, with worker worktrees alongside it and branches named `codex/city-<task-id>…`. Retention is intentional. No automatic worktree deletion is implemented. Review/export results before using Git's own `worktree remove` and branch deletion commands; never delete a directory merely because the task failed.

## Structure

- `src/City.tsx`: procedural city, five building levels, scene workers, camera and rendering fallback.
- `src/main.tsx`, `src/style.css`: project console, forms, approvals, replay and responsive layout.
- `shared/domain.ts`: renderer-independent entities, lifecycle, dependency validation and completion predicate.
- `server/codex.ts`: stdio App Server JSON-RPC adapter.
- `server/controller.ts`: planning, bounded scheduling, integration, checks and request routing.
- `server/git.ts`: repository validation, worktrees, commits and command execution.
- `server/store.ts`: SQLite snapshots, journal and transactional progression.
- `server/index.ts`: loopback API, same-origin sessions, SSE invalidations and Vite/static hosting.

Details: [architecture and lifecycle](docs/ARCHITECTURE.md), [protocol compatibility](docs/CODEX-INTEGRATION.md), [verification and limitations](docs/VERIFICATION.md).

## Verify

```powershell
npm test
npm run build
npm run spike
npm run test:e2e
```

The first two are deterministic local checks. Spike and E2E use real Codex authentication, consume account usage, and modify only newly created disposable repositories under `.local`. Browser QA requires the app running and Microsoft Edge installed:

```powershell
npm run test:browser
npm run test:browser-execution
```

The browser scripts register a clearly named **QA Workshop** disposable repository in the running city's database. Use a separate `CITY_DATA_DIR` for QA if you want to keep your normal city empty. They assume the default port and a fresh QA history. `test:browser-execution` submits and cancels a real task.

## Current limits

This is an exercised first implementation, not every acceptance scenario is verified against a live runtime. Authentication is handled through `codex login` in your terminal. Automatic resume after controller restart, MCP elicitation forms, attachment upload, automated dependency installation, manual check editing after project registration, conflict resolution, resource cleanup, and desktop packaging are not implemented. Conflicts preserve work and block the task; stop it before retrying. Checks are configured at registration; auto-detection currently covers npm scripts only. See the verification report for the precise boundary between real and deterministic tests.

Registered project chats are discovered automatically every 30 seconds, within the eight-chat observation limit. Each chat gets its own dome; selecting it shows that chat's recorded activity. Stop watching is remembered so discovery does not reconnect a chat you stopped. Discovery only reads history and never starts or resumes agents.
