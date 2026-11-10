# Galaxi frontend deployment

Current release: **2026-11-10**, the `galaxi` project in the `Dhakshini` Vercel workspace.

- Custom domain: <https://galaxi.dhakshini.studio>
- Vercel production alias: <https://galaxi-orcin.vercel.app>
- Deployment: `dpl_4R9qcGYaC4gezqrbwCpagAdfT84Z`
- Deployment URL: <https://galaxi-expc2ketb-dhakshini.vercel.app>
- Status: READY, production; staged, checked over HTTPS, then promoted without rebuilding.
- Framework: Vite; build command `npm run build:web`.
- Application source: committed and pushed at `e749d81`. Later release-verification documentation does not change the deployed application.
- Windows installer: <https://github.com/srisaidhakshini/galaxi-companion/releases/latest/download/Galaxi-Setup.exe>
- Release notes and checksum: <https://github.com/srisaidhakshini/galaxi-companion/releases/tag/v0.2.0>

The application repository remains private. The public `galaxi-companion` repository distributes only binaries, checksums and installation instructions, so downloads do not require GitHub sign-in. The original private draft was removed before publication. No paid cloud coding resources or GitHub Actions jobs were created.

## Static frontend only

`vercel.json` explicitly selects Vite, runs `npm ci --ignore-scripts`, builds with `npm run build:web`, and publishes `dist`. The web build type-checks only frontend/shared code and Vite configuration. The package and lockfile declare Node 24.x, matching the tested companion runtime.

`.vercelignore` excludes the companion server, tests, scripts, documentation, local databases, dependencies, existing build output and environment files. A dry run confirmed Vite detection and the actual upload list before deployment. The public site does not host the companion API or execute Codex agents.

The local project link and development authentication files are ignored by Git. Never commit `.env.local`, `.vercel` environment files, CLI credentials or protection-bypass secrets. Authenticated `vercel curl` created Vercel's project-scoped automation-bypass secret during inspection; its value was not printed or committed, and Deployment Protection was not disabled.

## Domain

Registration and authoritative DNS remain at Name.com. Only this subdomain was assigned to Galaxi; the root domain is reserved for the user's portfolio.

Name.com record verified by Vercel:

| Type  | Host     | Answer                                |
| ----- | -------- | ------------------------------------- |
| CNAME | `galaxi` | `a2559b7585ffecb4.vercel-dns-017.com` |

This is the record returned for this project on the deployment date. Obtain fresh instructions from Vercel before moving the domain or recreating the project; it is not a universal target. No nameserver migration or email-record changes were required.

## Verification

- The CNAME resolved to the assigned target. `vercel domains verify` returned `configured_correctly` for `galaxi`.
- Public HTTPS returned 200 with the actual frontend and valid TLS verification. Certificate provisioning briefly lagged DNS, then succeeded without bypassing TLS checks.
- Public `/api/state`, `/server/index.ts`, `/.env` and `/.local/city.sqlite` each returned 404.
- The cloud install reported zero npm advisories, and the frontend build passed. Vercel error logs returned zero records for the available ten-minute interval. This static deployment is not a cloud companion or a client-error monitoring system. Drains and ongoing monitoring were not separately inspected/configured.
- The real public HTTPS origin passed the companion browser test: local approval, code redemption, read-only UI/API, reload, interruption recovery, revocation, re-pairing, disconnect and the 390px layout. It used temporary fixture data and a nonexistent Codex executable. Loopback permission was granted only to the isolated browser context through the browser's permission API. Actual users may need to approve their browser's local-network prompt.

Run the deployed-origin test with:

```powershell
$env:PAIRING_WEBSITE_URL = 'https://galaxi.dhakshini.studio'
npx tsx scripts/pairing-browser-qa.ts
```

## Use your own village

Install and open the Windows companion, sign in to your own eligible Codex account, and register a Git repository and its checks locally. Open <https://galaxi.dhakshini.studio> on this computer, select **Connect installed companion**, verify the requesting website locally, and choose view-only access or prompt permission. Allow local-network access if asked. Source users can still use `npm run dev` and the browser-popup connection option. See [companion setup](COMPANION.md) and [pairing details](PAIRING.md).

## Companion release verification (2026-11-10)

The public installer has size `276338593` bytes and SHA-256 `20691c20df016057c614109c63faf81dfc830ecd10169e1c828f9cc05711063b`. GitHub's server-reported digest matches the local build. An unauthenticated HTTPS request to the stable download returned 200, and the public Releases API returned the same digest. The installer is unsigned; see its release notes for tested limitations.

The public site passed the complete isolated browser integration after promotion: read-only pairing, local approval of prompt permission, prompt UI, denied administration, reload/recovery, revocation, native callback fragment removal and replay rejection. No real agents or user data were used. A large installer upload initially timed out; HTTP/1.1 succeeded without bypassing TLS verification. Public release hosting required a separate download repository because the source repository is private.

## Next releases

Galaxi branding release (2026-11-09): production deployment `dpl_7L5DrvBYGisBVwnMVg7FhQmJoEhw`, <https://galaxi-blxfddirw-dhakshini.vercel.app>, promoted to <https://galaxi.dhakshini.studio>. The domain and Vercel project were already named Galaxi; this release unifies the application branding and browser title.

Connection-page update (2026-11-09): staged and promoted production deployment `dpl_H8LmLCt1boaNnqmf1vt9LMWXngsZ`, <https://galaxi-3rnl7utli-dhakshini.vercel.app>. The public custom domain passed the full isolated pairing browser check after promotion. This release uses the current working tree based on `5ee0170`, including the pairing and UI changes.

The CLI directory is linked to `Dhakshini/galaxi`. Recheck that identity before deploying. Use a preview or staged production deployment for future changes, verify it, and promote only when authorized. Git-based automatic deployment and CI have not been connected; pushing this repository alone does not currently update the website.

Remaining production work includes release checks, companion health/readiness endpoints, database backup/recovery, and frontend monitoring. The existing large frontend bundle warning remains.
