export type CompanionConnection = {
  id: string;
  mode: "local" | "paired";
  permission: "local" | "read" | "prompt";
  origin: string;
  expiresAt: number;
};
export class CompanionHttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const STORAGE = "city-companion-pairing";
export function companionAddress(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error(
      "Use the local companion address, such as http://127.0.0.1:4310.",
    );
  return url.origin;
}
export class CompanionClient {
  base = window.location.origin;
  token = "";
  paired = false;
  async response(path: string, body?: unknown, signal?: AbortSignal) {
    return fetch(this.base + "/api" + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: this.paired ? "omit" : "same-origin",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.paired
          ? { Authorization: `Bearer ${this.token}` }
          : { "X-City-Session": this.token }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      cache: "no-store",
    });
  }
  async request(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<any> {
    const res = await this.response(path, body, signal);
    if (!res.headers.get("content-type")?.includes("application/json"))
      throw Error("No companion is connected to this website.");
    const data = await res.json();
    if (!res.ok)
      throw new CompanionHttpError(
        data.error || "Companion request failed",
        res.status,
      );
    return data;
  }
  async bootstrap(signal?: AbortSignal): Promise<CompanionConnection> {
    const saved = sessionStorage.getItem(STORAGE);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.base = companionAddress(data.base);
        if (!/^[a-f0-9]{64}$/.test(data.token) || data.expiresAt <= Date.now())
          throw new Error();
        this.token = data.token;
        this.paired = true;
      } catch {
        this.forget();
        throw new CompanionHttpError(
          "Pairing expired. Get a new code from your local companion.",
          401,
        );
      }
      return this.request("/connection", undefined, signal);
    }
    this.base = window.location.origin;
    this.paired = false;
    const result = await this.request("/session", undefined, signal);
    if (!/^[a-f0-9]{64}$/.test(result.token))
      throw Error("No local companion session is available.");
    this.token = result.token;
    return result;
  }
  async pair(address: string, code: string): Promise<CompanionConnection> {
    this.base = companionAddress(address);
    this.token = "";
    this.paired = true;
    try {
      const result = await this.request("/pair", { code });
      if (
        !/^[a-f0-9]{64}$/.test(result.token) ||
        result.origin !== window.location.origin
      )
        throw Error("Companion returned an invalid pairing.");
      this.token = result.token;
      sessionStorage.setItem(
        STORAGE,
        JSON.stringify({
          base: this.base,
          token: this.token,
          expiresAt: result.expiresAt,
        }),
      );
      return result;
    } catch (e) {
      this.forget();
      throw e;
    }
  }
  forget() {
    sessionStorage.removeItem(STORAGE);
    this.token = "";
    this.paired = false;
    this.base = window.location.origin;
  }
  async disconnect() {
    try {
      await this.request("/pair/disconnect", {});
    } finally {
      this.forget();
    }
  }
  async events(signal: AbortSignal, update: () => void) {
    const res = await fetch(this.base + "/api/events", {
      headers: this.paired ? { Authorization: `Bearer ${this.token}` } : {},
      credentials: this.paired ? "omit" : "same-origin",
      signal,
      cache: "no-store",
    });
    if (!res.ok)
      throw new CompanionHttpError(
        "Companion event connection ended.",
        res.status,
      );
    if (
      !res.headers.get("content-type")?.includes("text/event-stream") ||
      !res.body
    )
      throw Error("Companion event stream unavailable.");
    const reader = res.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split: number;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          if (event.includes("event: update")) update();
        }
        if (buffer.length > 65536)
          throw Error("Invalid companion event stream.");
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!signal.aborted) throw Error("Companion connection interrupted.");
  }
}
