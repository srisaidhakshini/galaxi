import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";
export type RpcMessage = {
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code?: number; message: string };
};
export class Codex extends EventEmitter {
  process?: ChildProcessWithoutNullStreams;
  sequence = 0;
  ready = false;
  closing = false;
  pending = new Map<
    number,
    {
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  async connect() {
    this.closing = false;
    this.process = spawn(
      process.env.CODEX_BIN || "codex",
      ["app-server", "--stdio"],
      { stdio: "pipe", windowsHide: true },
    );
    this.process.stdin.on("error", (e) => this.disconnected(e));
    this.process.on("error", (e) => this.disconnected(e));
    this.process.on("exit", () =>
      this.disconnected(new Error("Codex App Server disconnected")),
    );
    this.process.stderr.on("data", () => {}); // Never forward potentially sensitive runtime diagnostics to browsers.
    createInterface({ input: this.process.stdout }).on("line", (line) => {
      let m: RpcMessage;
      try {
        m = JSON.parse(line);
      } catch {
        return;
      }
      if (m.id !== undefined && !m.method) {
        const p = this.pending.get(Number(m.id));
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(Number(m.id));
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        }
      } else this.emit("message", m);
    });
    await this.call("initialize", {
      clientInfo: { name: "galaxi", title: "Galaxi", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.send({ method: "initialized", params: {} });
    this.ready = true;
  }
  disconnected(e: Error) {
    this.ready = false;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(e);
    }
    this.pending.clear();
    if (!this.closing) this.emit("disconnect", e);
  }
  send(m: RpcMessage) {
    if (!this.process?.stdin.writable)
      throw new Error("Runtime is not connected");
    this.process.stdin.write(JSON.stringify(m) + "\n");
  }
  call(method: string, params: any = {}): Promise<any> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Runtime request timed out: ${method}`));
      }, 45000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ id, method, params });
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }
  reply(id: number | string, result: any) {
    this.send({ id, result });
  }
  close() {
    this.closing = true;
    this.ready = false;
    this.process?.kill();
  }
}
export const textInput = (text: string) => [
  { type: "text", text, text_elements: [] },
];
