import { useEffect, useState } from "react";
import { CompanionClient } from "./companionClient";
import { beginConnection, takeConnection } from "./connectionHandoff";

declare global {
  interface Window {
    galaxiDesktop?: {
      pickDirectory: () => Promise<string | undefined>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}

export function AutomaticConnect({
  address,
  onConnect,
}: {
  address: string;
  onConnect: (address: string, code: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const receive = async (event: MessageEvent) => {
      if (
        event.origin !== address ||
        !event.source ||
        event.data?.type !== "galaxi-connect"
      )
        return;
      try {
        const response = takeConnection(event.data, event.origin);
        await onConnect(response.base, response.code);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
      }
    };
    window.addEventListener("message", receive);
    if (location.hash.startsWith("#galaxi-connect=")) {
      const value = location.hash.slice("#galaxi-connect=".length);
      history.replaceState(null, "", location.pathname + location.search);
      void (async () => {
        try {
          const response = takeConnection(
            JSON.parse(decodeURIComponent(value)),
          );
          await onConnect(response.base, response.code);
        } catch (e) {
          setMessage(e instanceof Error ? e.message : String(e));
        }
      })();
    }
    return () => {
      window.removeEventListener("message", receive);
    };
  }, [address, onConnect]);
  function request(native: boolean) {
    try {
      const pending = beginConnection(address);
      const query = new URLSearchParams({
        origin: location.origin,
        state: pending.state,
      });
      if (native) location.href = "galaxi://connect?" + query;
      else {
        const popup = window.open(
          address + "/connect?" + query,
          "galaxi-connect",
          "popup,width=660,height=760",
        );
        if (!popup) throw Error("Allow pop-ups for Galaxi, then try again.");
      }
      setMessage(
        "Approve the connection in your companion window. No code to copy.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="automatic-connect">
      <h2>Your projects stay on your computer.</h2>
      <p>
        Install the free Windows companion once, sign in to your own Codex
        account, and choose a project. Your account’s usage limits apply.
      </p>
      <a
        className="connect-open"
        href="https://github.com/srisaidhakshini/galaxi/releases/latest/download/Galaxi-Setup.exe"
      >
        Download for Windows
      </a>
      <p>
        <small>
          Windows 10/11 · x64 · no Node.js or terminal setup. Git must be
          installed for repository work.
        </small>
      </p>
      <button
        type="button"
        className="primary connect-submit"
        onClick={() => request(true)}
      >
        Connect installed companion →
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => request(false)}
      >
        Already running from source? Connect in browser
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

export function ApproveBrowser() {
  const [client] = useState(() => new CompanionClient());
  const [ready, setReady] = useState(false),
    [permission, setPermission] = useState<"read" | "prompt">("read"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const params = new URLSearchParams(location.search);
  const origin = params.get("origin") || "",
    state = params.get("state") || "";
  let valid = false;
  try {
    const url = new URL(origin);
    valid =
      url.origin === origin &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && url.hostname === "127.0.0.1")) &&
      /^[a-f0-9-]{36}$/.test(state) &&
      url.origin !== location.origin;
  } catch {}
  useEffect(() => {
    void client
      .bootstrap()
      .then((c) => {
        if (c.mode !== "local")
          throw Error("Approve this request in the local app.");
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, [client]);
  async function approve() {
    setBusy(true);
    setError("");
    try {
      const result = await client.request("/pairings/code", {
        origin,
        permission,
      });
      const response = { type: "galaxi-connect", state, code: result.code };
      if (window.opener && !window.galaxiDesktop) {
        window.opener.postMessage(response, origin);
        window.close();
      } else {
        const target =
          origin +
          "/#galaxi-connect=" +
          encodeURIComponent(JSON.stringify(response));
        if (window.galaxiDesktop)
          await window.galaxiDesktop.openExternal(target);
        else location.replace(target);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="companion-gate">
      <section className="companion-card">
        <span className="connect-brand">✦ GALAXI</span>
        <h1>Connect this browser?</h1>
        {valid ? (
          <>
            <p>
              Only approve a connection you started yourself. This website will
              see activity for registered projects:
            </p>
            <div className="connect-notice">
              <strong>{origin}</strong>
            </div>
            <fieldset className="connection-options">
              <legend>What can this browser do?</legend>
              <label>
                <input
                  type="radio"
                  name="permission"
                  checked={permission === "read"}
                  onChange={() => setPermission("read")}
                />{" "}
                View activity only
              </label>
              <label>
                <input
                  type="radio"
                  name="permission"
                  checked={permission === "prompt"}
                  onChange={() => setPermission("prompt")}
                />{" "}
                View activity and send prompts
              </label>
            </fieldset>
            {permission === "prompt" && (
              <p>
                Prompts can edit files and execute commands in registered
                project worktrees using your Codex account. Approvals,
                repository setup and applying results stay in the local app.
              </p>
            )}
            <p>
              Access expires in 8 hours. Revoke it at any time in Browser
              connections.
            </p>
            <button
              className="primary connect-submit"
              disabled={!ready || busy}
              onClick={() => void approve()}
            >
              {busy ? "Connecting…" : "Allow connection"}
            </button>
            <button type="button" onClick={() => window.close()}>
              Cancel
            </button>
          </>
        ) : (
          <p role="alert">
            Invalid connection request. Start again from the Galaxi website.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}

export function DesktopSetup({
  api,
  authenticated,
}: {
  api: (path: string, body?: unknown) => Promise<any>;
  authenticated: boolean;
}) {
  const [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false);
  if (!window.galaxiDesktop || authenticated) return null;
  return (
    <div className="desktop-setup">
      <strong>Welcome to Galaxi</strong>
      <p>
        Sign in to your own Codex account to start. Your account’s usage limits
        apply; Galaxi does not provide unlimited AI usage.
      </p>
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await api("/runtime/login", {});
            setUrl(result.authUrl);
            await window.galaxiDesktop!.openExternal(result.authUrl);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening sign-in…" : "Sign in with ChatGPT"}
      </button>
      {url && (
        <p>Finish signing in in your browser, then select Reconnect runtime.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
