# Startup cleanup and deployment boundary

Reviewed on 2026-11-08.

## Removed startup injection

The controller previously decoded an environment variable into a URL, fetched its response and evaluated that response as JavaScript. This was unrelated to the application's Codex authentication and has been removed in full.

- Removed the loader and its unused `dotenv` and `node-fetch` dependencies.
- Deleted the tracked `.env`, which contained only the loader configuration. `.gitignore` already excludes future `.env` files; `.env.example` remains a safe template.
- Compared the lockfile and build configuration with commit `95f4990`; they were unchanged apart from line endings. The cleaned controller and dependency manifest also match that earlier version.
- Searched the remaining project source and startup/configuration files for the known loader patterns and prior auto-run artifacts. No additional executable instances were found in the reviewed files.
- Reinstalled 165 packages from the lockfile with a fresh cache and `npm ci --ignore-scripts --registry=https://registry.npmjs.org --cache=.local/security-npm-cache --no-audit --no-fund`. Dependency lifecycle scripts were not executed.

The malicious configuration remains in existing Git history until history is separately rewritten. This change does not rewrite or force-push shared history.

## Verification

- `npm audit --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org`: zero known advisories returned for the lockfile on the review date. The JSON report is in the ignored `.local/security-audit.json`.
- `npm test`: all 42 tests passed.
- `npm run build`: passed; the existing frontend bundle-size warning remains.
- A new startup regression runs an isolated production controller against an empty temporary database, with the old environment variable pointing to a harmless loopback canary. No request reaches the canary. The test also verifies unauthenticated access is denied, unrelated origins are denied, and authenticated mutations require the session header.
- The regression uses a nonexistent Codex executable, so it cannot authenticate to a real account or run real coding agents. The regular application was not started during cleanup.

## Remaining deployment work

This cleanup removes the identified repository startup injection. It does not establish that a computer which previously ran the injected code is clean. If that startup ran, review the host and rotate credentials accessible to that process before using it for deployment. Advisory results also do not prove that every package is free of malicious code.

The application remains a local controller bound to `127.0.0.1`. Its local session bootstrap is not public-user authentication. Public deployment still needs an explicit hosting design and secure pairing with the local companion, production identity/access controls, configuration validation, health/readiness endpoints, database backup/recovery procedures and release checks. Do not expose the controller by simply changing its bind address or disabling its Host/Origin protections.
