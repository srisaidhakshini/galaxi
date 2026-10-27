# Architecture and lifecycle

The browser is an execution monitor and task client. It cannot launch arbitrary controller commands, browse arbitrary files, access runtime authentication, or award progression. The 3D scene consumes the same domain snapshot as the accessible project list and project panel. Simplified rendering is available even when WebGL fails. Procedural trees and unassigned plots are decorative; visible workers correspond to actual coding sessions.

Selected desktop/CLI chats can also be observed as real external session roles. `server/observer.ts` uses only read-only App Server history methods, scoped to the selected chat and validated repository. Its optional snapshot collection is separate from City tasks, so observed outcomes cannot enter the task completion/award pipeline. Watch mode replaces the composer with a read-only panel; starting a separate City task is an explicit mode switch. Observation reconnects after controller restart and excludes reasoning items and ambient UI wrappers. Recent public file changes and command events drive the scene; stale evidence becomes idle. No extra model execution is required to watch an existing chat.

The loopback Node controller owns an App Server child process. JSON-RPC messages use one stdio connection; requests have monotonically increasing IDs and bounded timeouts. The browser receives SSE invalidations, then fetches snapshots with journal events after its last cursor. SQLite, rather than a live stream, is authoritative. Repeated item events are ignored by thread/method/item ID, and unrelated/late turn completions cannot resolve another turn.

A task advances through:

`queued → planning → running → integrating → checking → succeeded`

Active states may fail, be cancelled, or become interrupted. An integration conflict enters `waiting` with its error and retained workspaces; cancellation releases the project for a fresh attempt. Worker waiting reasons are tracked separately from the task phase, so one worker awaiting approval does not misrepresent another worker's activity. The UI highlights pending requests independently of phase.

The lead first runs in a read-only sandbox and emits a schema-constrained plan. The controller validates IDs, dependencies and bounds. Each ready wave runs up to the configured concurrency limit in separate Git worktrees based on the current integration HEAD. The controller collects commits and cherry-picks them in plan order. Dependent workers therefore see prior integrated outputs. Native recursive agent spawning is disabled by developer instructions: application-level orchestration owns the bounded worker pool.

The lead then reviews the combined workspace. The controller commits the final review, records its actual diff, and runs the predeclared required checks in that integration workspace. Every worker must have completed and every check must have passed before completion is legal. Checks altering tracked files cause failure. Final assistant prose cannot bypass these conditions.

Successful completion inserts a task ID into SQLite's unique award ledger and updates successful-task count plus task state in one transaction. Duplicate completion cannot award again. Building level is `min(5, 1 + successfulTasks)`; successful count continues above level five. Failed, cancelled, waiting and interrupted tasks award nothing. Steering adds input to an active turn and never creates an independent progression opportunity.

Results are not merged automatically. Explicit application checks the original checkout is clean and still at the task's original base, then fast-forwards to its retained task branch. Conflicts during worker integration never abort or reset user changes; all relevant worktrees stay available for inspection. Worktree creation can leave retained application-owned resources after a failure, intentionally.

On runtime disconnection, active work is interrupted. On controller restart, persisted active executions are conservatively interrupted; the app does not assume a child survived. Session references remain available in worker details for manual investigation. Browser refresh can reconnect to running work while that same controller remains alive.

Local security: the server binds `127.0.0.1`, validates Host and Origin, rejects cross-site session bootstrap, and uses an HttpOnly SameSite=Strict cookie plus a session token header for mutations. Browser API payloads are validated with Zod. Project paths are canonicalized and checked against the Git repository root. Shell arguments for Git and Codex are passed as arrays. Only verification commands explicitly configured through the local project-registration flow use a shell. Runtime credentials and account objects are never returned to the browser. This controller trusts its local user and registered repository code; it is not a service intended for a shared network.
