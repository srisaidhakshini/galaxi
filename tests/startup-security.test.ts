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
