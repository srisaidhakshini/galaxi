import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

test(
  "production startup ignores the removed loader variable and retains local session protection",
  { timeout: 30000 },
  async () => {
    let remoteRequests = 0;
    const canary = createServer((_req, res) => {
      remoteRequests++;
      res.end("globalThis.untrustedStartupCodeExecuted = true;");
    });
    canary.listen(0, "127.0.0.1");
    await once(canary, "listening");
    const canaryPort = (canary.address() as { port: number }).port;
    const reservation = createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((r) => reservation.close(() => r()));
    const dataDir = await mkdtemp(join(tmpdir(), "city-startup-security-"));
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts", "--production"],
      {
        cwd: resolve("."),
        env: {
          ...process.env,
          NODE_OPTIONS: "",
          PORT: String(port),
          CITY_DATA_DIR: dataDir,
          CITY_WATCH_THREAD: "",
          CODEX_BIN: join(dataDir, "nonexistent-codex.exe"),
          // A loopback canary replaces the malicious URL. Nothing is downloaded from the Internet.
          AUTH_API_KEY: Buffer.from(
            `http://127.0.0.1:${canaryPort}/payload`,
          ).toString("base64"),
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (b) => {
      output = (output + b).slice(-8000);
    });
    child.stderr.on("data", (b) => {
      output = (output + b).slice(-8000);
    });
    try {
      const origin = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) assert.fail(`Startup exited: ${output}`);
        try {
          ready = (
            await fetch(`${origin}/api/session`, {
              signal: AbortSignal.timeout(500),
            })
          ).ok;
        } catch {
          /* Wait for the isolated controller to bind. */
        }
        if (ready) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(ready, `Production server did not start: ${output}`);
      assert.equal((await fetch(`${origin}/api/state`)).status, 401);
      assert.equal(
        (
          await fetch(`${origin}/api/session`, {
            headers: { Origin: "https://unrelated.example" },
          })
        ).status,
        403,
      );
      const session = await fetch(`${origin}/api/session`);
      const cookie = session.headers.get("set-cookie")!.split(";")[0];
      const { token } = (await session.json()) as { token: string };
      assert.equal(
        (await fetch(`${origin}/api/state`, { headers: { Cookie: cookie } }))
          .status,
        200,
      );
      assert.equal(
        (
          await fetch(`${origin}/api/habitats`, {
            method: "POST",
            headers: { Cookie: cookie, "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${origin}/api/habitats`, {
            method: "POST",
            headers: {
              Cookie: cookie,
              "X-City-Session": token,
              "Content-Type": "application/json",
            },
            body: "{}",
          })
        ).status,
        400,
      );
      const website = "https://city.example";
      const localHeaders = {
        Cookie: cookie,
        "X-City-Session": token,
        "Content-Type": "application/json",
      };
      const unknown = await fetch(origin + "/api/state", {
        headers: { Origin: website },
      });
      assert.equal(unknown.status, 403);
      assert.equal(unknown.headers.get("access-control-allow-origin"), null);
      const generate = async (permission = "read") => {
        const response = await fetch(origin + "/api/pairings/code", {
          method: "POST",
          headers: localHeaders,
          body: JSON.stringify({ origin: website, permission }),
        });
        assert.equal(response.status, 200);
        return response.json() as Promise<{ code: string }>;
      };
      const code = await generate();
      const preflight = await fetch(origin + "/api/state", {
        method: "OPTIONS",
        headers: {
          Origin: website,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization",
          "Access-Control-Request-Private-Network": "true",
        },
      });
      assert.equal(preflight.status, 204);
      assert.equal(
        preflight.headers.get("access-control-allow-origin"),
        website,
      );
      assert.equal(
        preflight.headers.get("access-control-allow-private-network"),
        "true",
      );
      assert.equal(
        preflight.headers.get("access-control-allow-credentials"),
        null,
      );
      assert.equal(
        (await fetch(origin + "/api/session", { headers: { Origin: website } }))
          .status,
        403,
      );
      const redeem = async (value: string) =>
        fetch(origin + "/api/pair", {
          method: "POST",
          headers: { Origin: website, "Content-Type": "application/json" },
          body: JSON.stringify({ code: value }),
        });
      const redeemed = await redeem(code.code);
      assert.equal(redeemed.status, 200);
      assert.equal(redeemed.headers.get("set-cookie"), null);
      const grant = (await redeemed.json()) as {
        token: string;
        id: string;
        permission: string;
      };
      assert.equal(grant.permission, "read");
      assert.equal((await redeem(code.code)).status, 403);
      const remoteHeaders = {
        Origin: website,
        Authorization: "Bearer " + grant.token,
      };
      assert.equal(
        (await fetch(origin + "/api/state", { headers: remoteHeaders })).status,
        200,
      );
      assert.equal(
        (
          await fetch(origin + "/api/state", {
            headers: { Authorization: "Bearer " + grant.token },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fetch(origin + "/api/state", {
            headers: { ...remoteHeaders, Origin: "https://other.example" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(origin + "/api/state?token=" + grant.token, {
            headers: { Origin: website },
          })
        ).status,
        401,
      );
      assert.equal(
        (await fetch(origin + "/api/pairings", { headers: remoteHeaders }))
          .status,
        403,
      );
      for (const path of [
        "/api/tasks",
        "/api/projects",
        "/api/runtime/reconnect",
        "/api/pairings/code",
      ])
        assert.equal(
          (
            await fetch(origin + path, {
              method: "POST",
              headers: { ...remoteHeaders, "Content-Type": "application/json" },
              body: "{}",
            })
          ).status,
          403,
        );
      const listed = await (
        await fetch(origin + "/api/pairings", { headers: { Cookie: cookie } })
      ).text();
      assert.ok(!listed.includes(grant.token));
      const promptCode = await generate("prompt");
      const promptGrant = (await (await redeem(promptCode.code)).json()) as {
        token: string;
        id: string;
        permission: string;
      };
      assert.equal(promptGrant.permission, "prompt");
      const promptHeaders = {
        Origin: website,
        Authorization: "Bearer " + promptGrant.token,
        "Content-Type": "application/json",
      };
      assert.equal(
        (
          await fetch(origin + "/api/tasks", {
            method: "POST",
            headers: promptHeaders,
            body: "{}",
          })
        ).status,
        400,
      );
      for (const path of [
        "/api/projects",
        "/api/runtime/login",
        "/api/tasks/test/apply",
        "/api/requests/test",
        "/api/pairings/code",
        "/api/habitats",
        "/api/watch",
      ]) {
        assert.equal(
          (
            await fetch(origin + path, {
              method: "POST",
              headers: promptHeaders,
              body: "{}",
            })
          ).status,
          403,
        );
      }
      assert.equal(
        (
          (await fetch(origin + "/api/connection", {
            headers: promptHeaders,
          }).then((r) => r.json())) as { permission: string }
        ).permission,
        "prompt",
      );
      await fetch(origin + "/api/pairings/" + promptGrant.id + "/revoke", {
        method: "POST",
        headers: localHeaders,
        body: "{}",
      });
      assert.equal(
        (
          await fetch(origin + "/api/tasks", {
            method: "POST",
            headers: promptHeaders,
            body: "{}",
          })
        ).status,
        401,
      );
      const events = await fetch(origin + "/api/events", {
        headers: remoteHeaders,
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(events.status, 200);
      const stream = events.body!.getReader();
      assert.equal((await stream.read()).done, false);
      const revoke = await fetch(
        origin + "/api/pairings/" + grant.id + "/revoke",
        { method: "POST", headers: localHeaders, body: "{}" },
      );
      assert.equal(revoke.status, 200);
      assert.equal((await stream.read()).done, true);
      stream.releaseLock();
      const denied = await fetch(origin + "/api/state", {
        headers: remoteHeaders,
      });
      assert.equal(denied.status, 401);
      assert.equal(denied.headers.get("access-control-allow-origin"), website);
      const next = await generate(),
        newGrant = (await (await redeem(next.code)).json()) as {
          token: string;
        };
      const headers = {
        Origin: website,
        Authorization: "Bearer " + newGrant.token,
        "Content-Type": "application/json",
      };
      assert.equal(
        (
          await fetch(origin + "/api/pair/disconnect", {
            method: "POST",
            headers,
            body: "{}",
          })
        ).status,
        200,
      );
      assert.equal(
        (await fetch(origin + "/api/state", { headers })).status,
        401,
      );
      assert.equal(
        remoteRequests,
        0,
        "Startup contacted the former remote-code endpoint",
      );
      assert.doesNotMatch(output, /Auth Error|untrustedStartupCodeExecuted/);
    } finally {
      const exited =
        child.exitCode === null ? once(child, "exit") : Promise.resolve();
      if (child.exitCode === null) child.kill();
      await Promise.race([
        exited,
        new Promise<void>((r) => setTimeout(r, 3000)),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
      canary.closeAllConnections();
      await new Promise<void>((r) => canary.close(() => r()));
    }
  },
);
