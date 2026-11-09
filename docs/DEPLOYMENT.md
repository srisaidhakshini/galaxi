# Galaxi frontend deployment

Deployed on 2026-11-09 to the `galaxi` project in the `Dhakshini` Vercel workspace.

- Custom domain: <https://galaxi.dhakshini.studio>
- Vercel production alias: <https://galaxi-orcin.vercel.app>
- Deployment: `dpl_9Lr9Df8oNXiUd89UReYYYf7XfqYp`
- Status: READY, production. Vercel automatically assigned the new project's first deployment to production.
- Framework: Vite; cloud build approximately 22 seconds.
- Source: the local working tree based on `5ee0170`, including the subsequent pairing and deployment changes. Those local changes were not committed or pushed as part of this deployment.

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

Start the updated companion with `npm run dev`. Open <http://127.0.0.1:4310>, choose **Browser connections**, and approve `https://galaxi.dhakshini.studio`. Enter the code on the hosted site and allow loopback/local-network access if asked. Both browser and companion must be on the same computer. See [pairing details](PAIRING.md).

## Next releases

Galaxi branding release (2026-11-09): production deployment `dpl_7L5DrvBYGisBVwnMVg7FhQmJoEhw`, <https://galaxi-blxfddirw-dhakshini.vercel.app>, promoted to <https://galaxi.dhakshini.studio>. The domain and Vercel project were already named Galaxi; this release unifies the application branding and browser title.

Connection-page update (2026-11-09): staged and promoted production deployment `dpl_H8LmLCt1boaNnqmf1vt9LMWXngsZ`, <https://galaxi-3rnl7utli-dhakshini.vercel.app>. The public custom domain passed the full isolated pairing browser check after promotion. This release uses the current working tree based on `5ee0170`, including the pairing and UI changes.

The CLI directory is linked to `Dhakshini/galaxi`. Recheck that identity before deploying. Use a preview or staged production deployment for future changes, verify it, and promote only when authorized. Git-based automatic deployment and CI have not been connected; pushing this repository alone does not currently update the website.

Remaining production work includes release checks, companion health/readiness endpoints, database backup/recovery, and frontend monitoring. The existing large frontend bundle warning remains.
