import { Codex, textInput } from "../server/codex.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const cwd = resolve(".local/spike");
await mkdir(cwd, { recursive: true });
execFileSync("git", ["init", cwd]);
await writeFile(
  resolve(cwd, "README.md"),
  "Disposable execution verification\n",
);
execFileSync("git", ["-C", cwd, "add", "."]);
execFileSync("git", [
  "-C",
  cwd,
  "-c",
  "user.name=Galaxi",
  "-c",
  "user.email=galaxi@localhost",
  "commit",
  "--allow-empty",
  "-m",
  "fixture",
]);
const runtime = new Codex();
try {
  await runtime.connect();
  console.log("INITIALIZED");
  const account = await runtime.call("account/read", { refreshToken: false });
  console.log(
    "AUTH",
    JSON.stringify({
      authenticated: !!account.account,
      requiresOpenaiAuth: account.requiresOpenaiAuth,
    }),
  );
  const { thread } = await runtime.call("thread/start", {
    cwd,
    sandbox: "workspace-write",
    approvalPolicy: "on-request",
  });
  console.log("THREAD", thread.id);
  const done = new Promise<void>((res, rej) => {
    const timer = setTimeout(
      () => rej(new Error("Spike turn timed out")),
      120000,
    );
    runtime.on("message", (m) => {
      if (m.params?.threadId !== thread.id) return;
      if (m.id !== undefined) {
        console.log("REQUEST", m.method);
        runtime.reply(m.id, { decision: "decline" });
        return;
      }
      if (m.method === "item/completed")
        console.log("ITEM", JSON.stringify(m.params.item));
      if (m.method === "turn/completed") {
        clearTimeout(timer);
        console.log("TURN", m.params.turn.status);
        res();
      }
    });
  });
  await runtime.call("turn/start", {
    threadId: thread.id,
    input: textInput(
      "Create hello.txt containing exactly Hello Galaxi and run a shell command to read it back. This is a disposable integration smoke test. Do not spawn subagents.",
    ),
  });
  await done;
} catch (e) {
  console.error("BLOCKER", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  runtime.close();
}
