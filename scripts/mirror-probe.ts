import { Codex } from "../server/codex.ts";
const c = new Codex();
try {
  await c.connect();
  const id = process.env.CITY_WATCH_THREAD || process.env.CODEX_THREAD_ID;
  if (!id) throw Error("No current chat ID in environment");
  const meta = await c.call("thread/read", { threadId: id });
  const turns = await c.call("thread/turns/list", {
    threadId: id,
    limit: 1,
    sortDirection: "desc",
    itemsView: "full",
  });
  const r = {
    id,
    thread: {
      cwd: meta.thread.cwd,
      status: meta.thread.status,
      name: meta.thread.name,
      source: meta.thread.source,
    },
  };
  console.log(
    JSON.stringify({
      id,
      thread: r.thread,
      turns: turns.data.map((t: any) => ({
        id: t.id,
        status: t.status,
        items: t.items
          ?.filter((i: any) =>
            [
              "userMessage",
              "agentMessage",
              "commandExecution",
              "fileChange",
              "collabAgentToolCall",
            ].includes(i.type),
          )
          .map((i: any) => ({ type: i.type, id: i.id })),
      })),
    }),
  );
} finally {
  c.close();
}
