import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { EventEmitter } from "node:events";
import express from "express";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const CODE_TTL = 5 * 60_000;
export const CONNECTION_TTL = 8 * 60 * 60_000;
export function websiteOrigin(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error(
      "Enter the website origin only, without a path or credentials.",
    );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    )
  )
    throw Error(
      "Use an HTTPS website. HTTP is supported only for loopback development.",
    );
  return url.origin;
}
export type Connection = {
  id: string;
  mode: "local" | "paired";
  origin: string;
  createdAt: number;
  expiresAt: number;
};
export class PairingAuthority {
  codes = new Map<string, { origin: string; expiresAt: number }>();
  grants = new Map<string, Connection>();
  attempts = new Map<string, { count: number; reset: number }>();
  events = new EventEmitter();
  approvedOrigins = new Set<string>();
  constructor(
    public now = () => Date.now(),
    public ttl = CONNECTION_TTL,
  ) {
    this.events.setMaxListeners(100);
  }
  prune() {
    for (const [key, c] of this.codes)
      if (c.expiresAt <= this.now()) this.codes.delete(key);
    for (const [key, c] of this.grants)
      if (c.expiresAt <= this.now()) {
        this.grants.delete(key);
        this.events.emit("revoke", c.id);
      }
    for (const [key, a] of this.attempts)
      if (a.reset <= this.now()) this.attempts.delete(key);
  }
  issue(origin: string) {
    origin = websiteOrigin(origin);
    this.prune();
    for (const [key, c] of this.codes)
      if (c.origin === origin) this.codes.delete(key);
    if (this.codes.size >= 20)
      throw Error(
        "Too many pending codes. Wait for an existing code to expire.",
      );
    const raw = randomBytes(12).toString("hex").toUpperCase();
    const expiresAt = this.now() + CODE_TTL;
    this.codes.set(hash(raw), { origin, expiresAt });
    this.approvedOrigins.add(origin);
    return { code: raw.match(/.{4}/g)!.join("-"), origin, expiresAt };
  }
  redeem(code: string, origin: string) {
    this.prune();
    const attempt = this.attempts.get(origin) || {
      count: 0,
      reset: this.now() + 60_000,
    };
    this.attempts.set(origin, attempt);
    if (++attempt.count > 10)
      throw Error("Too many pairing attempts. Try again in a minute.");
    const key = hash(code.replace(/[\s-]/g, "").toUpperCase());
    const pending = this.codes.get(key);
    if (!pending || pending.origin !== origin)
      throw Error("Invalid or expired pairing code.");
    if (this.grants.size >= 32)
      throw Error("Revoke an existing browser connection first.");
    this.codes.delete(key);
    const token = randomBytes(32).toString("hex");
    const connection: Connection = {
      id: randomUUID(),
      mode: "paired",
      origin,
      createdAt: this.now(),
      expiresAt: this.now() + this.ttl,
    };
    this.grants.set(hash(token), connection);
    return { token, ...connection, permission: "read" as const };
  }
  authenticate(token: string, origin: string) {
    this.prune();
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    const grant = this.grants.get(hash(token));
    return grant?.origin === origin ? grant : undefined;
  }
  allows(origin: string) {
    this.prune();
    // Keep CORS for denial responses after revocation; authorization still requires a live grant.
    return this.approvedOrigins.has(origin);
  }
  revoke(id: string) {
    for (const [key, c] of this.grants)
      if (c.id === id) {
        this.grants.delete(key);
        this.events.emit("revoke", id);
        return true;
      }
    return false;
  }
  list() {
    this.prune();
    return [...this.grants.values()];
  }
}

export function installPairing(app: express.Express, localOrigin: string) {
  const authority = new PairingAuthority();
  const locals = new Map<string, Connection>();
  app.use((req, res, next) => {
    if (
      !["127.0.0.1", new URL(localOrigin).host].includes(req.headers.host || "")
    )
      return res.status(403).json({ error: "Invalid host" });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    if (origin && origin !== localOrigin) {
      if (!authority.allows(origin))
        return res
          .status(403)
          .json({ error: "Website has not been approved by this companion." });
      res.vary("Origin");
      res.setHeader("Access-Control-Allow-Origin", origin);
      if (req.method === "OPTIONS") {
        const headers = String(
          req.headers["access-control-request-headers"] || "",
        )
          .toLowerCase()
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean);
        if (headers.some((h) => !["authorization", "content-type"].includes(h)))
          return res.sendStatus(403);
        if (
          !["GET", "POST"].includes(
            String(req.headers["access-control-request-method"]),
          )
        )
          return res.sendStatus(403);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Authorization, Content-Type",
        );
        if (req.headers["access-control-request-private-network"] === "true")
          res.setHeader("Access-Control-Allow-Private-Network", "true");
        return res.sendStatus(204);
      }
    }
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.get("/api/session", (req, res) => {
    if (
      (req.headers.origin && req.headers.origin !== localOrigin) ||
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return res.sendStatus(403);
    for (const [key, c] of locals)
      if (c.expiresAt <= Date.now()) locals.delete(key);
    const cookie = String(req.headers.cookie || "").match(
      /(?:^|; )city_session=([a-f0-9]{64})/,
    )?.[1];
    let token = cookie,
      connection = cookie ? locals.get(hash(cookie)) : undefined;
    if (!connection) {
      if (locals.size >= 100)
        return res.status(429).json({ error: "Too many local sessions." });
      token = randomBytes(32).toString("hex");
      connection = {
        id: randomUUID(),
        mode: "local",
        origin: localOrigin,
        createdAt: Date.now(),
        expiresAt: Date.now() + CONNECTION_TTL,
      };
      locals.set(hash(token), connection);
    }
    res.cookie("city_session", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: Math.max(0, connection.expiresAt - Date.now()),
    });
    res.json({ token, ...connection, permission: "local" });
  });
  app.post("/api/pair", (req, res) => {
    if (
      !req.headers.origin ||
      req.headers.origin === localOrigin ||
      typeof req.body?.code !== "string" ||
      req.body.code.length > 100
    )
      return res.status(400).json({
        error: "Pair from the approved website using its one-time code.",
      });
    try {
      res.json(authority.redeem(req.body.code, req.headers.origin));
    } catch (e) {
      res.status(403).json({ error: (e as Error).message });
    }
  });
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin || localOrigin;
    const remote = origin !== localOrigin;
    const cookie = String(req.headers.cookie || "").match(
      /(?:^|; )city_session=([a-f0-9]{64})/,
    )?.[1];
    const bearer = String(req.headers.authorization || "").match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    const connection = remote
      ? authority.authenticate(bearer || "", origin)
      : cookie
        ? locals.get(hash(cookie))
        : undefined;
    if (!connection || connection.expiresAt <= Date.now())
      return res
        .status(401)
        .json({ error: "Connection expired or revoked. Connect again." });
    const csrf = req.get("x-city-session") || "";
    if (
      !remote &&
      req.method !== "GET" &&
      (!/^[a-f0-9]{64}$/.test(csrf) ||
        !cookie ||
        !timingSafeEqual(Buffer.from(csrf), Buffer.from(cookie)))
    )
      return res.status(403).json({ error: "Invalid local session token" });
    if (remote && req.method !== "GET" && req.path !== "/pair/disconnect")
      return res.status(403).json({
        error:
          "Paired browsers have read-only access. Use the local companion to make changes.",
      });
    res.locals.connection = connection;
    next();
  });
  const localOnly: express.RequestHandler = (_req, res, next) => {
    if (res.locals.connection.mode !== "local")
      return res.status(403).json({
        error: "Manage browser connections from the local companion.",
      });
    next();
  };
  app.get("/api/connection", (_req, res) =>
    res.json({
      ...res.locals.connection,
      permission: res.locals.connection.mode === "local" ? "local" : "read",
    }),
  );
  app.get("/api/pairings", localOnly, (_req, res) =>
    res.json({ connections: authority.list() }),
  );
  app.post("/api/pairings/code", localOnly, (req, res) => {
    try {
      const website = websiteOrigin(String(req.body?.origin || ""));
      if (website === localOrigin)
        throw Error(
          "This local window is already connected. Enter the separate website's origin.",
        );
      res.json(authority.issue(website));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.post("/api/pairings/:id/revoke", localOnly, (req, res) => {
    if (!authority.revoke(String(req.params.id)))
      return res.status(404).json({ error: "Connection no longer exists." });
    res.json({ ok: true });
  });
  app.post("/api/pair/disconnect", (_req, res) => {
    if (res.locals.connection.mode !== "paired")
      return res.status(400).json({ error: "This is a local session." });
    authority.revoke(res.locals.connection.id);
    res.json({ ok: true });
  });
  return {
    isLive(connection: Connection) {
      return (
        connection.expiresAt > Date.now() &&
        (connection.mode === "local"
          ? [...locals.values()]
          : authority.list()
        ).some((c) => c.id === connection.id)
      );
    },
    onRevoke(listener: (id: string) => void) {
      authority.events.on("revoke", listener);
      return () => {
        authority.events.off("revoke", listener);
      };
    },
  };
}
