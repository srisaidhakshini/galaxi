import { useEffect, useState } from "react";
import { companionAddress } from "./companionClient";
import { AutomaticConnect } from "./DesktopSetup";

export function ConnectCompanion({
  reason,
  onConnect,
}: {
  reason: string;
  onConnect: (address: string, code: string) => Promise<void>;
}) {
  const [address, setAddress] = useState("http://127.0.0.1:4310");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  let link = "http://127.0.0.1:4310";
  try {
    link = companionAddress(address);
  } catch {}
  const validCode = /^[A-F0-9]{24}$/i.test(code.replace(/[-\s]/g, ""));
  return (
    <main className="companion-gate">
      <section className="companion-card" aria-labelledby="connect-title">
        <header className="connect-header">
          <span className="connect-brand">✦ GALAXI</span>
          <span className="connect-badge">One-time setup</span>
        </header>
        <h1 id="connect-title">Connect your village.</h1>
        <p className="connect-intro">
          See your Codex chats come to life. Connect to the Galaxi app on this
          computer to watch your village grow.
        </p>
        {/expired|revoked/i.test(reason) && (
          <p className="connect-notice" role="status">
            Your connection expired or revoked. Get a new code below to
            reconnect.
          </p>
        )}
        <AutomaticConnect address={link} onConnect={onConnect} />
        <details className="connect-help manual-connection">
          <summary>Manual connection with a code</summary>
          <div className="connect-steps">
            <section className="connect-step" aria-labelledby="open-app-title">
              <span className="connect-number" aria-hidden="true">
                1
              </span>
              <div>
                <h2 id="open-app-title">Open Galaxi on this computer</h2>
                <p>Keep the local app running while you use this website.</p>
                <a
                  className="connect-open"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open local app <span aria-hidden="true">↗</span>
                </a>
                <details className="connect-help">
                  <summary>Local app not opening?</summary>
                  <p>
                    Start Galaxi on this computer first. If you have the project
                    installed, run <code>npm run dev</code> from its folder,
                    then try again. This website cannot start the local app for
                    you.
                  </p>
                  <p>
                    Using a different port? Change the address in Advanced
                    settings below. Use this website on the same computer as the
                    local app.
                  </p>
                </details>
              </div>
            </section>
            <section className="connect-step" aria-labelledby="get-code-title">
              <span className="connect-number" aria-hidden="true">
                2
              </span>
              <div>
                <h2 id="get-code-title">Get a connection code</h2>
                <p>
                  In the local app, open <strong>Browser connections</strong>.
                  Paste this address into <strong>Website origin</strong>, then
                  select <strong>Generate pairing code</strong>.
                </p>
                <div className="connect-origin">
                  <code>{window.location.origin}</code>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          window.location.origin,
                        );
                        setCopyMessage(
                          "Address copied. Paste it in the local app.",
                        );
                      } catch {
                        setCopyMessage(
                          "Select and copy the website address above.",
                        );
                      }
                    }}
                  >
                    {copyMessage.startsWith("Address copied")
                      ? "Copied!"
                      : "Copy address"}
                  </button>
                </div>
                {copyMessage && (
                  <p className="connect-copy-feedback" role="status">
                    {copyMessage}
                  </p>
                )}
              </div>
            </section>
            <section
              className="connect-step connect-step-last"
              aria-labelledby="paste-code-title"
            >
              <span className="connect-number" aria-hidden="true">
                3
              </span>
              <div>
                <h2 id="paste-code-title">Paste your code here</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!validCode || busy) return;
                    setBusy(true);
                    setError("");
                    try {
                      await onConnect(address, code);
                      setCode("");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label htmlFor="pairing-code">One-time pairing code</label>
                  <input
                    id="pairing-code"
                    className="connect-code"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Paste your code"
                    required
                    maxLength={40}
                    aria-describedby="code-help"
                  />
                  <p id="code-help" className="connect-code-help">
                    {code.trim() && !validCode
                      ? "Paste the full 24-character code."
                      : "Valid for 5 minutes. If it expires, generate a new code."}
                  </p>
                  <details className="connect-help connect-advanced">
                    <summary>Advanced settings</summary>
                    <label>
                      Companion address
                      <input
                        aria-label="Companion address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                      />
                    </label>
                    <p>
                      Only change this if your local app uses a different port.
                    </p>
                  </details>
                  {error && (
                    <div className="connect-notice" role="alert">
                      <strong>We couldn’t connect.</strong>
                      <p>
                        {/fetch|network|timeout/i.test(error)
                          ? "Check that the local app is running on this computer. Allow local-network access in your browser, then try again."
                          : error}
                      </p>
                    </div>
                  )}
                  <button
                    className="primary connect-submit"
                    disabled={busy || !validCode}
                  >
                    {busy ? "Connecting…" : "Pair this browser"}
                    <span aria-hidden="true"> →</span>
                  </button>
                </form>
                <p className="connect-permission">
                  If your browser asks for local-network access, choose{" "}
                  <strong>Allow</strong> so Galaxi can reach the local app.
                </p>
              </div>
            </section>
          </div>
        </details>
        <footer className="connect-footer">
          <span aria-hidden="true">◇</span>
          <p>
            Your code and repositories stay on your computer. This website
            connects to the companion. Sending prompts requires your approval in
            the local app.
          </p>
        </footer>
      </section>
    </main>
  );
}

type BrowserGrant = {
  id: string;
  origin: string;
  expiresAt: number;
  permission?: "read" | "prompt";
};
export function BrowserConnections({
  api,
  onClose,
}: {
  api: (path: string, body?: unknown) => Promise<any>;
  onClose: () => void;
}) {
  const [origin, setOrigin] = useState("");
  const [permission, setPermission] = useState<"read" | "prompt">("read");
  const [issued, setIssued] = useState<{ code: string; expiresAt: number }>();
  const [connections, setConnections] = useState<BrowserGrant[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = async () => {
    try {
      const result = await api("/pairings");
      setConnections(result.connections);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [api]);
  return (
    <div className="modal-backdrop">
      <section
        className="modal companion-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="browser-connections-title"
      >
        <div className="modal-header">
          <h2 id="browser-connections-title">Browser connections</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close browser connections"
          >
            Close
          </button>
        </div>
        <p>
          Connect the Galaxi website to this computer. Paired browsers can view
          activity for all registered projects. Optionally allow prompts to run
          on this computer. Repository setup, approvals and applying changes
          stay local.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              setIssued(await api("/pairings/code", { origin, permission }));
              setCopied(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Website origin
            <input
              aria-label="Website origin"
              placeholder="https://galaxi.dhakshini.studio"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              required
            />
          </label>
          <label>
            Browser permission
            <select
              value={permission}
              onChange={(e) =>
                setPermission(e.target.value as "read" | "prompt")
              }
            >
              <option value="read">View activity only</option>
              <option value="prompt">View activity and send prompts</option>
            </select>
          </label>
          {permission === "prompt" && (
            <p>
              Prompts can edit files and run commands in registered project
              worktrees, using your Codex account limits. Approvals and applying
              results still require the local app.
            </p>
          )}
          <button className="primary" disabled={busy || !origin.trim()}>
            {busy ? "Generating…" : "Generate pairing code"}
          </button>
        </form>
        {issued && (
          <div className="pairing-code-box">
            <strong>Paste this code into the website</strong>
            <output aria-label="Generated pairing code">{issued.code}</output>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(issued.code);
                  setCopied(true);
                } catch {
                  setError("Select and copy the code above.");
                }
              }}
            >
              {copied ? "Copied!" : "Copy code"}
            </button>
            <small>
              Expires at {new Date(issued.expiresAt).toLocaleTimeString()}. Use
              once, within 5 minutes. Generating another code replaces this one.
            </small>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <h3>Connected browsers</h3>
        <p>
          Connections last 8 hours. Revoke a connection to disconnect it
          immediately.
        </p>
        {!connections.length && (
          <p className="muted">No paired browsers yet.</p>
        )}
        {connections.map((c) => (
          <div className="paired-browser" key={c.id}>
            <div>
              <strong>{c.origin}</strong>
              <p>
                {c.permission === "prompt" ? "Prompts enabled" : "View only"} ·
                expires {new Date(c.expiresAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api(`/pairings/${c.id}/revoke`, {});
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Revoke
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
