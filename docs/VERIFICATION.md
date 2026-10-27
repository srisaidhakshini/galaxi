# Verification report

Verified on Windows, 2026-10-26. Node 24.21.0; Codex CLI 0.164.0-alpha.11.1; Microsoft Edge headless via Playwright. All repositories and screenshots used for execution tests live in ignored `.local` paths; no credentials were copied into source.

## Real execution evidence

1. **Integration spike:** initialized the App Server, read authentication status, started a real conversation and turn, created `hello.txt` with `Hello Codex City`, and read it back through an actual shell command with exit status 0. The first sandboxed launch disconnected; running the installed CLI with its normal local access succeeded. This environment restriction did not require weakening the application's agent sandbox.
2. **Collaboration:** real lead returned a structured plan for two independent outputs, `alpha.txt` and `beta.txt`. Separate real Codex threads ran concurrently in isolated worktrees. Controller-created commits were cherry-picked into the integration workspace, the lead reviewed it, and controller-run `node verify.cjs` returned `Both outputs verified`, exit 0. Task succeeded, project count advanced exactly once, and original repository remained clean. The explicit apply operation then fast-forwarded the original and both outputs were present. One worker took several minutes; no progress percentage was fabricated.
3. **Browser execution:** submitted a prompt through the project composer, observed a real lead thread and active turn, refreshed the browser, verified the same task remained active, then cancelled it. No progression was awarded.
4. **Controller recovery:** launched the production controller on loopback port 4321 with a separate data directory, registered a disposable repository, submitted work and observed a real active lead turn. Abruptly killed the controller and restarted it. The same persisted task recovered as interrupted with zero progression and the original repository clean. Production browser assets and API both served from the controller.

The first full real E2E script completed execution and explicit application but exited with a test-harness shutdown error: the App Server exit callback attempted to save after the test database closed. Intentional adapter shutdown now suppresses disconnect notifications; the subsequent real browser and production restart probes exited successfully. The original full multi-worker run has **not** been repeated after this shutdown-only fix. This distinction is preserved rather than calling its initial process exit a pass.

## Deterministic tests

`npm test`: **16 passed, 0 failed**. These tests use an explicitly fake runtime only in the test process, real Git repositories/worktrees, real SQLite, and real verification command execution. No mock adapter is available in the production UI.

Covered:

- Valid/invalid lifecycle transitions and terminal-state protection.
- Completion evidence, required workers and required checks.
- Exactly-once transactional progression, including duplicate completion and database reopen.
- Five levels and continued counting at the top level.
- Dependency cycles, unknown dependencies, duplicate IDs.
- Ready-wave concurrency limit and serial execution setting.
- Dependency outputs integrated before dependent workers begin.
- Worker failure and check failure preventing progression.
- Actual conflicting Git changes blocking integration while preserving worktrees.
- Cancellation and late events; duplicate item events and unrelated/out-of-order turn completions.
- Approval request routing, no automatic grants, and expired request rejection.
- Dirty checkout preservation, event cursor replay and conservative restart reconciliation.

`npm run build`: TypeScript check and production bundle succeeded. The main bundle is approximately 1.16 MB uncompressed, 326 KB gzip, primarily Three.js and scene helpers. No bundle-size regression threshold is configured.

## Browser and visual QA

1440×1000 desktop and 390×844 mobile screenshots were captured and inspected. Browser QA passed repository registration, direct building-label selection, panel tabs, persisted selection after refresh, orbit/zoom/reset interactions, reduced motion, simple-view selection, mobile overflow, and zero page errors in its final run. Cross-origin mutations and mutations missing the session header were rejected with HTTP 403.

Visual QA found and fixed a Drei HTML overlay issue: labels attached to a React-managed canvas container disappeared on updates, and view switching could throw `removeChild`. A dedicated label portal and retained canvas now keep labels stable across scene/view updates. Reduced-motion mode stops worker animation; simplified mode stops the hidden scene's animation loop. The accessible list remains available independently of canvas interactions.

Screenshots: `.local/city-empty.png`, `.local/city-project.png`, `.local/city-simple.png`, `.local/city-mobile.png`, `.local/city-active-real.png`, `.local/city-cancelled-real.png`.

## Not exercised against a live runtime

- A genuine Codex command/file/permission approval or structured user-input request could not be reproduced in the disposable tasks. Routing is implemented and deterministic command-approval tests pass; live approval compatibility remains unverified.
- A complete real task ending in a required-check failure was not run. Deterministic orchestration tests execute an actual failing shell check and verify failure prevents progression.
- Integration conflicts and worker failures were tested with fake runtime output and real Git, rather than induced in live coding sessions.
- Mid-turn steering is implemented from the inspected protocol but was not exercised live.
- Five progression levels, active/waiting/failure worker treatments, pan gestures, and WebGL-loss fallback are implemented; there is no exhaustive browser screenshot matrix of every level/state/device.
- macOS/Linux have not been tested. Windows PowerShell returns shell process status (which may normalize a failing native command to 1), and the UI records that actual shell status.

## Remaining product gaps

Authentication requires terminal `codex login`. Interrupted work is retained and retryable as a fresh attempt, without automatic runtime thread resumption. MCP elicitation/forms, attachment upload, editable registered check configuration, automated environment setup, cleanup UI, interactive conflict resolution, desktop packaging and external-client task ingestion are absent. Active diffs are captured at integration or termination, rather than continuously rebuilding a patch for every streamed file event. Untracked partial files can be inspected in retained worker workspaces even before they enter the committed integration diff.

The most useful next steps are live approval compatibility tests, safe interrupted-session reconciliation/resume, dependency-environment provisioning, then review/cleanup tooling for retained workspaces. Keep passing checks and preserved original work as release gates while expanding those paths.

## City interaction redesign (2026-10-26)

Replaced the muted scene with coral/blue/lavender/gold project buildings, a riverfront, bridges, fountain, windmill, varied trees, benches and streetlights. Existing project plot assignments remain unchanged. Real session workers now walk the site perimeter with articulated legs, carry supplies during editing, and alternate material runs with hammering at their work station. Waiting, failed, completed and interrupted sessions park instead of continuing construction animation. These are interpretations of observed runtime states, not claims of physically measured build progress.

Removed the large centered empty-city card. The compact corner prompt leaves the scene visible. Added explicit Move/Orbit drag modes and rotate, zoom, top-down and reset controls. Worker badges are compact; detailed labels appear on hover/focus and clicking opens execution details.

`tsx scripts/city-visual-qa.ts` passed: empty-state obstruction check, all camera buttons, Move/Orbit modes, five visual levels, observed worker-label movement, reduced-motion stability, building selection, simple-view roundtrip, desktop/mobile layout and zero browser errors. The test intercepts state only inside its isolated browser context, with clearly named visual fixtures. It does not register projects, submit tasks or change the application's persistent city. Screenshots are under `.local/city-redesign-*.png`. Production TypeScript and Vite build passed. Existing controller/orchestration code was not changed by this redesign.

## Articulated worker animation

Replaced single-joint bobbing with distance-driven walking, articulated hips/knees, opposing arm swings, eased turns, body sway, breathing and head motion. Active editing follows pickup → carry → place → hammer → return, with station arrival before stationary actions, gloves, safety glasses, visible bricks/tools and brief impact particles. Command work uses a laptop; checking uses a clipboard. Completed workers walk to a rest position and stop constructing. Project labels sit above roofs at a fixed screen size so worker bodies remain visible at close zoom.

20 deterministic tests passed, including four new choreography tests. Browser-only visual fixtures observed pickup, carrying materials, placement, hammering and walking across a complete cycle. Reduced motion, focused-building readability, selection, camera buttons, simple mode and mobile overflow passed with no page errors. Close-up inspection: `.local/workers-construction-closeup.png`. No real tasks or persistent project records were created by these animation checks.

## Continuous terrain and visible travel (2026-10-27)

Removed the raised island slab, river boundary and disconnected empty plot pads. A large continuous ground plane extends beyond all supported camera positions, with roads and landscape continuing outward. Existing project plot assignments stay stable.

Fixed a stride threshold that could move the character root while leaving its legs stationary during small per-frame movements. Strides now follow actual travel distance. Editing routes connect an external material depot more than four world units from the work station. Active workers travel faster; completed sessions stroll off-duty without carrying materials or claiming ongoing construction. Waiting and failed sessions never continue construction. Motion is enabled by default for this requested experience, with a persisted Reduced motion setting.

Six focused animation tests passed. TypeScript and production build passed. Browser-only fixtures verified active travel, completed-worker travel, all construction phases, reduced-motion stability, camera controls, building selection, simplified rendering and mobile overflow, with zero browser errors. Continuous terrain and the focused construction view were visually inspected in `.local/city-redesign-empty.png` and `.local/workers-construction-closeup.png`. No live coding task was started for visual QA.

## Existing-chat observation and visible brick placement (2026-10-28)

The current desktop chat was attached to its existing `galaxi` project through read-only App Server history APIs. A real browser check verified that this exact user prompt, public messages, commands and file-change records appear in watch mode and remain after refresh. The City task count did not increase. No start, resume, steer, interrupt or approval call is used by the observer. Observation is persisted separately from City execution and cannot award building progression or apply results. Hidden reasoning is filtered before data reaches the snapshot; ambient UI wrappers are removed from the displayed user prompt.

Live-status limitation verified experimentally: a separate App Server reported this actively running desktop chat as `notLoaded`, and the incomplete stored turn as `interrupted`. These values are not treated as an authoritative external outcome. The observer polls recorded history every two seconds, briefly illustrates new work evidence and idles stale evidence. Recorded activity may lag the owning desktop client. Follow-up text alone does not restart an old editing animation. Execution and approvals remain in the desktop app.

29 automated tests passed, including seven observer tests covering read-only calls, public/hidden item separation, duplicate/stale snapshots, failure/disconnection, prompt formatting, and no false progression. Production build passed. The complete visual cycle also passed with a positive placed-brick count: carrying, placement into a rendered site wall, hammering and the return walk. Focused inspection, reduced motion, camera controls, selection, simple mode and mobile layout passed with zero browser errors. The real chat browser probe confirmed zero duplicate tasks. Screenshots: `.local/current-chat-watching.png` and `.local/workers-construction-closeup.png`.

A further real end-to-end check passed after recording an actual source edit in this desktop chat: the observed session entered editing state and its rendered worker placed a brick (`data-placed-bricks > 0`) in the website. No browser state fixture or second coding task was used for this check. Close-up screenshot: `.local/current-chat-real-brickwork.png`. The watch-selection dialog, duplicate attachment protection and mobile overflow were also exercised against the real chat connection.

This is recorded-activity observation, not a guaranteed instantaneous desktop event stream. It does not import all older turns, route external approvals, or independently verify another client's checks. The observer reads public history rather than private authentication files or unsupported log formats. One observed session creates one visible role; extra workers are not invented for decoration. Brickwork is a scene illustration and does not represent a measured percentage of repository completion.
