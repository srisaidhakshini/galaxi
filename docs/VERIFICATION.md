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

## Workspace UI polish (2026-10-28)

Reworked the interface with a dark project rail, clearer inline SVG icons, compact workspace statistics, a larger scene area, stronger text contrast and a cleaner project inspector. Project navigation now includes actual watch-connection status. Command records collapse into terminal cards, newest recorded activity is shown first outside Chat, and the latest request is shown only in Chat so other tabs have room for their contents. Connection limitations remain available under an expandable explanation.

The inspector supports pointer dragging and keyboard arrow resizing, persists its preferred width, and stacks below the still-visible city on narrow screens. Escape dismisses dialogs. The scene and real execution integration are unchanged.

`npm run test:ui` passed using isolated browser-only fixtures at 1440×1000, 1024×768 and 390×844: keyboard/pointer resizing, width restoration after refresh, collapsed command expansion, watch/runner mode switching, dialog dismissal, visible city on mobile, zero horizontal overflow and zero page errors. The real chat-watching browser test also passed with zero duplicate tasks. TypeScript and production build passed. Screenshots: `.local/ui-polish-desktop.png`, `.local/ui-polish-activity.png`, `.local/ui-polish-laptop.png`, `.local/ui-polish-mobile.png`, `.local/ui-polish-empty.png`.

## Research outpost districts and habitats (2026-10-28)

Replaced the single-building project scene with large expandable project districts, per-task domes, mission tents, solar arrays and continuous terrain. Stable habitat membership persists in the existing snapshot. Similar prompts use keyword matching; the Habitats tab supports explicit creation, renaming and same-project regrouping. Workers are rendered at their current assignment's dome and retain material collection, walking, brick placement and hammering choreography.

Production build and all 35 tests passed. Six habitat tests cover grouping, stable slots, migration/restart persistence, manual reassignment, cross-project rejection, historical versus current watched turns and expandable layout spacing. The fake concurrent-worker test now allows time for both real Git worktrees to be created before its short simulated turns finish.

`npm run test:outpost` passed with isolated browser fixtures: two districts, related-task grouping, rendered worker brick placement, dome focus, create/rename/reassign, reload, unchanged success count, 1024px and 390px layouts, zero horizontal overflow and zero browser errors. These fixture checks do not execute coding tasks or modify live projects. Screenshots: `.local/outpost-overview.png`, `.local/outpost-habitat.png`, `.local/outpost-1024.png`, `.local/outpost-390.png`. Visual inspection caught and corrected terrain shadow striping.

## Prompt-grown circular villages (2026-10-28)

Removed watched-chat history backfill: attachment establishes a baseline, and only subsequent prompts create sites. Kept existing habitats intact. Empty manually reserved groups no longer render domes. Circular village rings replace the rectangular grid and vacant pads, with a central park, benches, animated fountain and perimeter trees. Village spacing scales with ring extent.

Construction stages persist in the snapshot: marked land, foundation, frame, glass, door and finished interior. Distinct completed file-change evidence and execution milestones advance stages monotonically; repeated polling does not advance them. Existing built domes remain built. These stages illustrate recorded work, not numerical code completion.

All 36 tests passed, including no historical dome creation, new-prompt land creation, deduplicated evidence, completion, preservation of older buildings and restart persistence. Browser fixtures exercised all six rendered stages and captured .local/village-stage-0.png through .local/village-stage-5.png, plus grouping and responsive checks.

## Village scenery and colour (2026-10-28)

Added a procedural scenery module with individual coral, teal, blue, lavender and gold habitat accents; clearer tinted glass; foundation fittings, door trim/handles/steps, solar equipment, utility tanks and planters. Active sites gain cones and a wheelbarrow without adding decorative workers or creating new habitats. Park details include slatted benches with supports, flower planters, path lights, branching tree crowns with subtle wind, fountain droplets and expanding/fading water ripples. Tree and water animation respects Reduced motion. Existing prompt-driven construction, stage persistence and real worker assignments remain unchanged.

Production build passed. The outpost browser checks passed at desktop and mobile sizes with zero page errors: all six construction stages, actual worker brick-placement cycle, habitat create/rename/regroup and reload. Final screenshots include .local/village-stage-5.png and .local/outpost-overview.png. All scenery is local procedural geometry and materials; no external assets or network image dependencies were added.

## Clear scene names, visible crew and town furniture (2026-10-28)

Removed permanent project and habitat headings from the 3D scene. Buildings and village ground reveal name-only tooltips on pointer hover. Only the current assignment receives the gold work-site ring; selecting an older site does not highlight it as active work. Workers are larger, with a Find current crew control that focuses the real task/chat assignment. No decorative workers were introduced. Added inner-village trees, full-height street lamps, litter bins, a bike rack and hydrant, retaining existing park furniture and construction stages.

The stylesheet was restored from the prior successful production asset after a scripting error; browser validation confirmed the restored layout and the new scene overrides. Production build and outpost browser checks passed, covering current-site metadata, hidden headings, visible worker/crew focus, all construction stages, assignment controls and desktop/mobile layouts. Screenshots: .local/outpost-overview.png and .local/outpost-habitat.png.

## One dome per chat (2026-10-28)

Consolidated legacy per-turn chat sites into one persistent dome per project/chat pair, preserving every membership and the furthest construction stage. Current worker associations follow the merged home. New prompts reuse that home regardless of topic; different chats remain separate. Separate City task sites are preserved. Backed up the live database with SQLite VACUUM INTO before migration.

All 37 tests and the production build passed. New coverage checks unrelated prompts reuse one chat dome, different chats remain distinct, individual turns cannot be split across buildings, legacy consolidation preserves history/task sites/progression and repeated migration is stable. The live galaxi project now has one chat dome with its retained turn history. Browser verification uses scripts/chat-dome-qa.ts without submitting coding tasks.

## Discover all project chats (2026-10-28)

Fixed the missing second galaxi dome: previously only explicitly watched chats populated the village. Read-only discovery now checks registered project chat lists every 30 seconds and connects previously unseen chats within the existing eight-chat observation limit. It seeds one dome from the latest recorded turn without importing separate buildings for older prompts. Stop-watching choices persist and prevent automatic reattachment; City-owned task sessions are excluded and repository paths are validated.

The galaxi project now has separate Build Codex City app and Teach me tech concepts domes. Clicking a dome selects the matching observed chat. Crew focus/highlighting prefers active work, then the newest chat, rather than list order. Targeted tests passed for two-chat discovery, idempotency, completed-site appearance, stop preferences and read-only method use. Production build passed; live browser checks cover both galaxi chat IDs and switching to the teaching chat.

## Sparse planting and keyboard movement (2026-10-28)

Reduced trees from 22 to at most five in uneven small groups, excluding positions near buildings. Replaced dome rings with deterministic irregular clearings and varied street furniture/planting angles. The occupied extent determines district size; existing site IDs and prompt history are unchanged.

WASD and arrow keys pan relative to the camera while the 3D region is focused or hovered. Held keys move smoothly with normalized diagonals and elapsed-time scaling; page blur/visibility loss clears movement. Inputs, selects, editable text and modifier shortcuts are excluded. A visible hint lists the keys. Live browser verification exercised W, D, ArrowUp and ArrowLeft, verified no camera movement while typing WASD/arrows into a text field, and found no page errors. Layout tests verify stable positions, at least 8.5 units between sites and containment within the project boundary. Screenshot: .local/organic-village.png.

## Prompt-count dome growth (2026-10-28)

Domes grow from 85% scale at one unique recorded prompt to 145% scale at 20 prompts, then stop growing. Counts use persisted, deduplicated memberships scoped to the chat; no new progression counter is required. Architecture, fixtures, depot and placed bricks grow together with a damped transition. Workers retain human scale and their walking/construction routes expand to the corresponding work positions. Reduced motion applies the new size directly. Selected-site details show prompt count, size and growth cap. Maximum adjacent foundations fit within the existing 8.5-unit site separation.

Two focused growth tests passed for monotonic growth, the cap, duplicate/foreign-chat exclusion, reload stability and footprint spacing. Live browser checks passed for chat domes, crew focus and matching activity; screenshots show the long-running galaxi dome larger than the teaching dome. The first concurrent build attempt hit system memory exhaustion; a sequential retry passed after the browser finished.

## Architectural additions instead of size alone (2026-11-01)

Prompt milestones now add actual geometry, constrained by the saved construction phase: one prompt gives a foundation; two add framing; three install four glass sectors; four complete all eight sectors; five attach the door; six add framed windows; seven furnish a table; eight add chairs; nine add a monitor and keyboard; later milestones add interior lighting and shelving. The architectural milestone and observed construction phase are separate, so completed first-turn history no longer renders a fully furnished dome. Size growth remains capped. Features are derived from persisted unique prompt memberships and therefore restore on reload. Selected glass becomes clearer for interior inspection, and the inspector lists installed parts.

Three growth/feature tests and the production build passed. scripts/dome-features-qa.ts passed ten isolated browser snapshots at prompt counts 1,2,3,4,5,6,7,8,9 and14, checking physical-stage/feature metadata, partial versus complete panels and no page errors. Screenshots .local/dome-features-1.png through .local/dome-features-14.png were inspected; the table, chair legs/backs and framed windows are visible through the glass. Fixtures do not alter real chat history or submit tasks.

## Local companion pairing (2026-11-09)

Added local approval of an exact website origin, single-use five-minute codes, eight-hour read-only browser grants, local revoke controls and paired-browser self-disconnect. Codes and tokens are stored as hashes by the companion; browser tokens use session storage and Authorization headers. Local sessions remain cookie/CSRF protected and now expire without clearing unrelated sessions. The server stays on loopback. CORS approvals are exact; they never grant access without authentication. Paired clients cannot start tasks, mutate projects, reconnect the runtime or administer other browser grants. Revocation closes an open event stream immediately.

All 45 tests passed. The production-startup integration uses a nonexistent Codex executable and verifies single-use redemption, approved preflight/private-network headers, rejected foreign bootstrap, origin-bound bearer authentication, denied mutations, local-only grant management, no URL-token authentication, revocation and self-disconnect. Three pairing authority tests cover expiry, replacement, throttling, hashed storage and origin validation. The final targeted security tests also passed after constant-time CSRF comparison was added.

Production build passed with the existing bundle-size warning. The two-origin browser test passed local code approval, pairing, read-only UI/API, refresh restoration, an interrupted-state-fetch/recovery cycle, revocation, re-pairing, self-disconnect and a 390px layout with no overflow or browser page errors. It found and corrected a hidden mobile disconnect control and a stale reconnect error banner. Screenshots: `.local/pairing-local.png`, `.local/pairing-readonly.png`, `.local/pairing-mobile.png`.

The browser test uses separate loopback origins and an isolated temporary fixture database. It does not run real agents, access user authentication or alter the user's city. It does not verify an actual hosted HTTPS domain's local-network permission prompts. Public hosting and production permission checks remain deployment work; see `docs/PAIRING.md`.

## Vercel and custom-domain release (2026-11-09)

Created the isolated Vercel `galaxi` project in the verified Dhakshini workspace and deployed the frontend working tree with explicit Vite settings. The first deployment was automatically assigned to production by Vercel. A dry run verified that server code, private data, environment files and local caches were excluded. The cloud install used `npm ci --ignore-scripts`, and `build:web` passed in a roughly 22-second build. Local web type-check/build checks passed.

The user chose galaxi.dhakshini.studio and added Vercel's project-specific CNAME at Name.com. Vercel returned configured_correctly. HTTPS returned 200 and the real frontend. Public API/source/env/database paths returned 404. Error-log inspection returned zero records in the available ten-minute interval; no client monitoring or drains setup was claimed.

The browser integration then passed against the actual public HTTPS domain and an isolated local companion: approval, read-only UI/API, reload, recovery, revocation, re-pairing, disconnect, mobile layout and no page errors. Playwright's permission-name wrapper did not support the browser's newer loopback permission, so the test uses the browser's origin-scoped permission API inside its cleanup boundary. No browser security flags were disabled. See docs/DEPLOYMENT.md for exact deployment metadata and limitations.

## Connection-page usability (2026-11-09)

Replaced the dense setup instructions with three numbered sections: open the local app, copy the website address to obtain a code, and paste the code to connect. Troubleshooting and the companion address are collapsed by default. Added clipboard feedback, full-code validation, readable connection failures, permission guidance, and a copy-code button in local browser management.

The production build and all 45 regression tests passed. The first sandboxed test run could not reach its startup-test server; the targeted test and complete suite passed with local networking enabled. Browser checks passed on both separate local origins and the actual public HTTPS domain, including approval, read-only access, reload, recovery, revocation, re-pairing, disconnect and no page errors. The setup page has no horizontal overflow at 390px; desktop and mobile screenshots were reviewed (`.local/pairing-connect-desktop.png`, `.local/pairing-connect-mobile.png`).

Staged production deployment `dpl_H8LmLCt1boaNnqmf1vt9LMWXngsZ` returned HTTPS 200 through authenticated Vercel access, was promoted without rebuilding, and passed the public-domain browser check. The existing large frontend bundle warning remains.
