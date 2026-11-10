# Website and local companion pairing

The website can observe a local companion without starting another Codex session. The companion stays bound to `127.0.0.1`. The website and companion must run in the same computer's browser/network environment; this is not a relay for connecting a phone to another computer.

## Connect without copying a code

The Windows companion bundles Node.js, npm and Codex. Users still need Git for repository work and their own eligible Codex account. Galaxi does not pay for or provide unlimited AI usage. See [desktop setup and build instructions](COMPANION.md).

1. Install and open the companion. Sign in with ChatGPT from its window, then use **Choose project folder…** to register a repository and its checks.
2. In the website, select **Connect installed companion**. The browser may ask permission to open Galaxi.
3. In the local approval window, verify the website address. Choose **View activity only** or **View activity and send prompts**, then select **Allow connection**.
4. The website reconnects using a single-use handoff; no manual code copying is needed. Allow local-network access if the browser requests it.

Source users can choose **Already running from source? Connect in browser**. This opens a local approval popup instead of the installed-app protocol. The callback requires a matching random request state, expires after five minutes and consumes a single-use code. The installer callback puts only that short-lived code in the fragment, clears it immediately, and exchanges it for a session-stored bearer credential. Bearer credentials never appear in a URL. Native callbacks return to the approved website root only.

## Manual code fallback

1. Start the companion with `npm run dev`, or build and run it with `npm run build` followed by `npm start`.
2. Open its local window at `http://127.0.0.1:4310`. Select **Browser connections**. This control is available on narrow screens too.
3. Enter the website's exact origin, such as `https://your-village.example`, choose the browser permission and select **Generate pairing code**. View-only access is the default. Prompt permission also allows starting, steering and cancelling tasks in already-registered projects.
4. Open the hosted website, enter the companion's loopback address and the generated code, then select **Pair this browser**. If the browser requests permission to contact the local computer, allow it for the website you approved.
5. The website displays **Read-only paired browser** or **Prompts enabled**, matching the locally approved permission. Repository registration, watch settings, connection management, approval decisions and applying results remain local-only under both permissions. Task submission still requires a registered repository, configured checks and an authenticated local Codex runtime.

Codes expire after five minutes, work once and are bound to the approved origin. Generating another code for an origin replaces its earlier unused code. Connections expire after eight hours. Browser refresh restores a live connection from that tab's session storage. Companion restart invalidates its connections; obtain a new code and use **Pair again** to reconnect. A temporary network interruption is retried automatically.

Use **Revoke** in the local window to disconnect a paired browser. Its open event stream closes and later requests fail authentication. Use **Disconnect browser** in the paired window to revoke its own grant and clear its saved credential. Neither action stops existing Codex work or deletes village progress.

## Host the frontend

Build the app and serve only `dist/` from an HTTPS static host. The same bundle detects whether a local controller is available at its own origin; otherwise it displays the pairing screen. Configure the static host's SPA fallback if needed. Do not upload the database, `.local`, source environment files or account authentication files.

Do not publish the companion API through a public proxy or change its bind address. Its local session bootstrap is intended for a trusted local browser, not public-user login. Public hosting, custom-domain configuration and any website account system are separate deployment work.

Local Network Access behavior varies between browsers. Production websites must use HTTPS, and browser permission or policy can prevent access to loopback even after application pairing. The UI explains this when a connection cannot be made. See the [Chrome Local Network Access guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access) and [Microsoft Edge guidance](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access). HTTP origins are accepted only for loopback development; the companion itself is addressed with `http://127.0.0.1:<port>`.

## Security properties

- Codes have 96 bits of randomness and are stored as SHA-256 digests. Redemption is throttled per approved origin.
- Browser credentials have 256 bits of randomness. Only their digests and nonsecret connection metadata are retained by the companion. Grants are memory-only and disappear at restart.
- Exact-origin CORS approval is distinct from authentication. Revoked origins can still receive readable denial responses; they cannot access project data without a live grant.
- Paired requests use an origin-bound bearer credential in the `Authorization` header with browser cookies omitted. Credentials never appear in URLs or event-stream query parameters.
- Local administration retains HttpOnly, SameSite=Strict cookies and a matching CSRF header for mutations. Local sessions expire after eight hours; session bootstrap does not revoke unrelated sessions.
- Event streams use authenticated fetch, end at expiry and close on revocation. Polling and reconnecting do not mint a replacement paired credential.
- Paired access defaults to read-only. A separately approved `prompt` grant allows only POST `/tasks`, `/tasks/:id/steer`, `/tasks/:id/cancel`, and self-disconnect. It never permits applying results or answering runtime approval requests. Browser connection management remains local-only. Permissions cover all registered projects; per-project sharing is not implemented.

## Verification

`npm test` covers origin validation, single-use codes, replacement/expiry, redemption throttling and grant revocation. The production-startup regression also exercises real HTTP preflights, denied cross-origin bootstrap, origin-bound authorization, read-only mutations, management isolation, absence of URL-token authentication and closing a live stream on revocation.

`npm run test:pairing` builds the frontend and runs an isolated companion plus a static website at a different loopback origin. It verifies local approval, remote read-only UI/API, refresh restoration, offline recovery, revocation, re-pairing, self-disconnect and a 390px layout. It uses temporary fixture data and a nonexistent Codex executable, so it cannot run real coding agents or modify the user's city. This test does not substitute for testing local-network permissions on the eventual public HTTPS domain.

Screenshots are saved under the ignored `.local/` directory: `pairing-local.png`, `pairing-readonly.png` and `pairing-mobile.png`.

For a deployed-origin browser test, set `PAIRING_WEBSITE_URL` to the HTTPS website before running `npx tsx scripts/pairing-browser-qa.ts`. It still uses an isolated temporary companion. The test grants loopback permission only in its own browser context. See [the verified deployment](DEPLOYMENT.md).
