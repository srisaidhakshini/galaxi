import { spawn } from "node:child_process";
import { realpath, readFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
export function command(
  file: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
  timeout = 120000,
): Promise<{ output: string; code: number }> {
  return new Promise((res, rej) => {
    if (signal?.aborted) {
      rej(new Error("Command cancelled"));
      return;
    }
    const p = spawn(file, args, {
      cwd,
      windowsHide: true,
      detached: process.platform !== "win32",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    let output = "",
      settled = false;
    function stopTree() {
      if (!p.pid) return;
      if (process.platform === "win32") {
        const killer = spawn(
          "taskkill.exe",
          ["/PID", String(p.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        killer.on("error", () => p.kill());
      } else {
        try {
          process.kill(-p.pid, "SIGKILL");
        } catch {
          p.kill();
        }
      }
    }
    const onAbort = () => {
      stopTree();
      finish(-1, "\nCancelled");
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      stopTree();
      finish(-1, "\nTimed out");
    }, timeout);
    function finish(code: number, extra = "") {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      res({ output: output + extra, code });
    }
    p.stdout.on("data", (d) => {
      output = (output + d).slice(-200000);
    });
    p.stderr.on("data", (d) => {
      output = (output + d).slice(-200000);
    });
    p.on("error", (e) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (!settled) {
        settled = true;
        rej(e);
      }
    });
    p.on("close", (code) => finish(code ?? -1));
  });
}
export async function git(cwd: string, ...args: string[]) {
  const r = await command("git", args, cwd);
  if (r.code !== 0) throw new Error(r.output || `git ${args[0]} failed`);
  return r.output.trim();
}
export async function repository(path: string) {
  const full = await realpath(resolve(path));
  const top = await git(full, "rev-parse", "--show-toplevel");
  if ((await realpath(top)).toLowerCase() !== full.toLowerCase())
    throw new Error("Enter the repository root path");
  await git(full, "rev-parse", "HEAD");
  return full;
}
export async function clean(cwd: string) {
  if (await git(cwd, "status", "--porcelain"))
    throw new Error(
      "Repository has uncommitted changes. Commit your work before starting an isolated task. Nothing was changed.",
    );
}
export async function worktree(
  repo: string,
  path: string,
  branch: string,
  base: string,
) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await git(repo, "worktree", "add", "-b", branch, path, base);
}
export async function commit(cwd: string) {
  await git(cwd, "add", "--all");
  if (await git(cwd, "diff", "--cached", "--name-only"))
    await git(
      cwd,
      "-c",
      "user.name=Codex City",
      "-c",
      "user.email=city@localhost",
      "commit",
      "-m",
      "Codex City task result",
    );
  return git(cwd, "rev-parse", "HEAD");
}
export async function discoverChecks(path: string) {
  try {
    const p = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
    return ["test", "lint", "typecheck", "build"]
      .filter((k) => p.scripts?.[k] && !/no test specified/.test(p.scripts[k]))
      .map((k) => `npm run ${k}`);
  } catch {
    return [];
  }
}
export async function runCheck(
  cwd: string,
  commandText: string,
  signal: AbortSignal,
) {
  return process.platform === "win32"
    ? command(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", commandText],
        cwd,
        signal,
        300000,
      )
    : command("/bin/sh", ["-c", commandText], cwd, signal, 300000);
}
export const workspaceRoot = resolve(
  process.env.CITY_DATA_DIR || ".local",
  "workspaces",
);
