import { companionAddress } from "./companionClient";

const PREFIX = "galaxi-connect-request:";
const TTL = 5 * 60_000;
export function beginConnection(base: string) {
  const state = crypto.randomUUID();
  const request = {
    state,
    base: companionAddress(base),
    origin: location.origin,
    createdAt: Date.now(),
  };
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)!;
    if (key.startsWith(PREFIX)) {
      try {
        if (Date.now() - JSON.parse(localStorage.getItem(key)!).createdAt > TTL)
          localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    }
  }
  localStorage.setItem(PREFIX + state, JSON.stringify(request));
  return request;
}
export function takeConnection(value: unknown, expectedBase?: string) {
  const data = value as { type?: string; state?: string; code?: string };
  if (
    data?.type !== "galaxi-connect" ||
    typeof data.state !== "string" ||
    !/^[a-f0-9-]{36}$/.test(data.state) ||
    typeof data.code !== "string" ||
    !/^[A-F0-9]{4}(?:-[A-F0-9]{4}){5}$/.test(data.code)
  )
    throw Error("Invalid connection response. Connect again.");
  const saved = localStorage.getItem(PREFIX + data.state);
  if (!saved)
    throw Error(
      "This connection request expired. Connect again from this browser.",
    );
  const request = JSON.parse(saved);
  if (
    request.origin !== location.origin ||
    !Number.isFinite(request.createdAt) ||
    Date.now() < request.createdAt ||
    Date.now() - request.createdAt > TTL ||
    (expectedBase && request.base !== expectedBase)
  )
    throw Error("This connection request expired. Connect again.");
  localStorage.removeItem(PREFIX + data.state);
  return { base: companionAddress(request.base), code: data.code };
}
