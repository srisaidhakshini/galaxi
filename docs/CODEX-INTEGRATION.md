# Codex integration notes

Verified 2026-10-26 against [official App Server documentation](https://learn.chatgpt.com/docs/app-server) and the installed `codex-cli 0.164.0-alpha.11.1` bindings generated using `codex app-server generate-ts --out .local/protocol`. The generated files are ignored local inspection artifacts; the app does not require them at runtime. No generic chat-completion API is used.

## Exercised protocol

- Launch `codex app-server --stdio` as a controller-owned child.
- `initialize` with client metadata; then `initialized` notification.
- `account/read` with `refreshToken:false`; expose only connected/authenticated booleans.
- `thread/start` with `cwd`, sandbox, approval policy and orchestration instructions.
- `turn/start` with text input, optional output schema and per-turn sandbox policy.
- `item/started`, `item/completed`, `turn/started`, `turn/completed` notifications.
- Actual command exit codes/output and file-change items from real coding execution.
- Separate worker conversations, isolated worktrees, lead review, controller-side checks and explicit fast-forward application.
- Browser-submitted real lead turn and interruption, with browser refresh preserving that active task.

## Implemented from the verified contract; deterministic routing tests

- `turn/steer` with expected active turn ID and selected worker thread.
- `item/commandExecution/requestApproval` and `item/fileChange/requestApproval`: allow once, decline or cancel. The browser filters decisions if the runtime supplies an allowed list. The client never grants requests automatically.
- `item/permissions/requestApproval`: grant the requested profile for that turn or deny it.
- `item/tool/requestUserInput`: answer by question ID.
- `serverRequest/resolved`: remove expired/resolved request references.

No genuine approval or structured-input request was reproducibly encountered during the real disposable-repository tests. These paths are not claimed as live-verified. Unsupported server requests receive a protocol error and a visible activity event; MCP elicitation and extended forms are not implemented.

## Recovery and compatibility

The current official protocol supports `thread/resume`, history pagination and native collaboration-related events. Galaxi-owned execution still uses bounded worktree orchestration and does not automatically resume interrupted execution. A separate read-only observer now ingests selected existing chats through `thread/read`, `thread/list`, `thread/turns/list` and `thread/items/list`. It never calls start, resume, steer, interrupt or approval methods. A controller restart marks Galaxi executions interrupted and reconnects stored watch selections.

Verified 2026-10-28: a separately started App Server can read this desktop chat's current recorded prompt, command items and file-change items. Its metadata reported `notLoaded` and its incomplete turn snapshot reported `interrupted` while the desktop chat was still working. Therefore those fields are not used as authoritative live status for external chats. Observation polls every two seconds, animates newly observed public work briefly, and becomes idle when evidence is stale. Hidden reasoning is discarded. Watching cannot award upgrades, apply changes, or turn recorded prose into verified success. The existing desktop remains the execution and approval owner.

The adapter opts into `experimentalApi` for structured-input compatibility; CLI revisions may change these contracts. If upgrading Codex, regenerate its local bindings and rerun both smoke and real E2E tests. If authentication is absent, use the CLI's supported terminal login flow and reconnect. The application never reads or copies private authentication files.

Runtime RPC request timeout: 45 seconds. Worker turn timeout: 30 minutes. A model/provider error is recorded as a failure, not success. An unexpected process disconnect interrupts active tasks; late execution events cannot award progression.
