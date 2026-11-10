# Galaxi Windows companion

The companion runs coding work on the user's computer with their own Codex account. The website hosts the village interface and talks only to the approved loopback companion. No cloud coding machines, database subscriptions or developer-funded AI API are needed. Codex account eligibility and usage limits still apply; this is not unlimited free inference.

## First use

1. Download `Galaxi-Setup.exe` from the [official Galaxi GitHub release](https://github.com/srisaidhakshini/galaxi-companion/releases/tag/v0.2.0). Do not use binaries from an unrelated mirror.
2. Run the per-user installer and open Galaxi. The current release is unsigned; Windows may display an unverified-publisher warning. No paid certificate is required to build it.
3. Install Git if it is not already present. Node.js, npm and Codex are included in the companion.
4. Select **Sign in with ChatGPT**. Authentication happens in your browser through Codex; no password or API key is entered into Galaxi.
5. Select **Connect repository**, then **Choose project folder…**. Use an existing Git repository with a commit and configure meaningful checks. Keep the checkout clean before submitting a separate Galaxi task.
6. Open the Galaxi website on this computer. Select **Connect installed companion**, verify the requesting origin in the local window, and choose whether to allow prompts. Browser/local-network permission may also be required.

Keep the companion running while using the website. Approvals and applying results must be handled in the local window. Results stay in retained branches until reviewed. Users can continue watching existing Codex chats without creating another task.

## Installation boundaries

- Windows x64 is the initial packaging target; macOS, Linux and Windows ARM installers are not provided by this configuration.
- Installation is per user and registers `galaxi://` to open a local connection approval window. It does not expose the API on the network.
- Only the loopback app loads in Electron. Node integration is off, context isolation and renderer sandboxing are on, remote navigation is denied, and IPC checks the calling frame.
- User data lives in Electron's Galaxi user-data directory, outside the installation. Uninstalling does not intentionally delete project history or retained worktrees. Back up the data and associated repositories before any manual cleanup.
- Port 4310 must be free. Close a source-running companion before starting the installed app. A conflicting listener produces a startup error instead of silently trusting it.
- There are no automatic binary updates in this first release. Update through reviewed GitHub releases.
- Installed-app callbacks return through the system's default browser. Start the website in that browser. If using a different browser, the **Already running from source? Connect in browser** action also works with an installed companion and keeps approval in the current browser.
- This is not a cloud relay. A phone cannot reach a companion on another computer through the website alone.

## Build an installer

On Windows x64 with Node.js 24.x, npm and Git installed:

```powershell
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run desktop:build
```

The preparation step bundles the server, copies the production frontend, and includes the pinned Codex distribution, Node.js, npm and licenses. Only explicit runtime files enter `.local/desktop-runtime`; source repositories, `.env`, `.local` databases and Codex credentials are not copied. `npmRebuild` is disabled because the server uses bundled Node.js's built-in SQLite module.

Output: `.local/desktop-release/Galaxi-Setup.exe`. This is a build artifact, not a Git-tracked file. `desktop:prepare` prepares resources without packaging; `scripts/desktop-qa.ts` tests the packaged application using an isolated profile and Codex home, without signing in or running live tasks.

Publish the tested installer and a SHA-256 checksum to a repository release using an explicitly authenticated GitHub session. The website's stable download URL is `https://github.com/srisaidhakshini/galaxi-companion/releases/latest/download/Galaxi-Setup.exe`; do not advertise the first installer as available until that release exists. Public distribution and updating the hosted website are final release steps.
