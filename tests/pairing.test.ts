import test from "node:test";
import assert from "node:assert/strict";
import { pairedMutationAllowed } from "../shared/companionPermissions.ts";
import {
  PairingAuthority,
  websiteOrigin,
  CODE_TTL,
} from "../server/pairing.ts";

test("pairing accepts exact HTTPS origins and loopback development only", () => {
  assert.equal(websiteOrigin("https://city.example/"), "https://city.example");
  assert.equal(websiteOrigin("http://127.0.0.1:4311"), "http://127.0.0.1:4311");
  for (const value of [
    "null",
    "http://public.example",
    "https://city.example/path",
    "https://u:p@city.example",
    "https://city.example?token=x",
    "file:///tmp",
  ])
    assert.throws(() => websiteOrigin(value));
});
test("codes are single-use and origin-bound; grants are revocable and stored hashed", () => {
  const a = new PairingAuthority();
  const { code } = a.issue("https://city.example");
  assert.throws(() => a.redeem(code, "https://other.example"));
  const grant = a.redeem(code, "https://city.example");
  assert.throws(() => a.redeem(code, "https://city.example"));
  assert.equal(a.authenticate(grant.token, grant.origin)?.id, grant.id);
  assert.equal(a.authenticate(grant.token, "https://other.example"), undefined);
  assert.ok(!a.grants.has(grant.token));
  assert.ok(!JSON.stringify(a.list()).includes(grant.token));
  let revoked = "";
  a.events.on("revoke", (id) => {
    revoked = id;
  });
  assert.equal(a.revoke(grant.id), true);
  assert.equal(revoked, grant.id);
  assert.equal(a.authenticate(grant.token, grant.origin), undefined);
});
test("code expiry, replacement, attempt throttling and grant expiry are enforced", () => {
  let now = 1000;
  const a = new PairingAuthority(() => now, 2000),
    origin = "https://city.example";
  const old = a.issue(origin);
  const replacement = a.issue(origin);
  assert.throws(() => a.redeem(old.code, origin));
  const grant = a.redeem(replacement.code, origin);
  now += 2000;
  assert.equal(a.authenticate(grant.token, origin), undefined);
  const expired = a.issue(origin);
  now += CODE_TTL;
  assert.throws(() => a.redeem(expired.code, origin));
  const live = a.issue(origin);
  for (let i = 0; i < 10; i++) {
    try {
      a.redeem("not-the-code", origin);
    } catch {}
  }
  assert.throws(() => a.redeem(live.code, origin), /Too many/);
  now += 60001;
  assert.equal(a.redeem(live.code, origin).permission, "read");
});

test("prompt permission is granted locally, origin-bound, and never includes administration", () => {
  const authority = new PairingAuthority();
  const origin = "https://galaxi.example";
  const issued = authority.issue(origin, "prompt");
  const grant = authority.redeem(issued.code, origin);
  assert.equal(grant.permission, "prompt");
  assert.equal(
    authority.authenticate(grant.token, origin)?.permission,
    "prompt",
  );
  assert.equal(
    authority.authenticate(grant.token, "https://other.example"),
    undefined,
  );
  for (const path of [
    "/tasks",
    "/tasks/a/steer",
    "/tasks/a/cancel",
    "/pair/disconnect",
  ])
    assert.equal(pairedMutationAllowed("prompt", path), true);
  for (const path of [
    "/projects",
    "/runtime/login",
    "/runtime/reconnect",
    "/tasks/a/apply",
    "/requests/a",
    "/pairings/code",
    "/pairings/a/revoke",
    "/watch",
    "/habitats",
    "/tasks/a/steer/extra",
  ])
    assert.equal(pairedMutationAllowed("prompt", path), false);
  assert.equal(pairedMutationAllowed("read", "/tasks"), false);
  assert.equal(pairedMutationAllowed(undefined, "/tasks"), false);
  assert.throws(() => authority.issue(origin, "admin" as any));
});
