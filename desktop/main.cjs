const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  session,
} = require("electron");
const { spawn } = require("node:child_process");
const { join } = require("node:path");
const net = require("node:net");
const { mkdirSync } = require("node:fs");
if (
  process.env.GALAXI_DESKTOP_TEST === "1" &&
  process.env.GALAXI_DESKTOP_TEST_DATA
) {
  mkdirSync(process.env.GALAXI_DESKTOP_TEST_DATA, { recursive: true });
  app.setPath("userData", process.env.GALAXI_DESKTOP_TEST_DATA);
  app.setPath("sessionData", process.env.GALAXI_DESKTOP_TEST_DATA);
  if (app.isDefaultProtocolClient("galaxi"))
    app.removeAsDefaultProtocolClient("galaxi");
}
const origin = "http://127.0.0.1:4310";
let mainWindow,
  approvalWindow,
  child,
  stopping = false,
  pendingLink;
const externalOrigins = new Set([
  "https://galaxi.dhakshini.studio",
  "https://git-scm.com",
  "https://auth.openai.com",
  "https://auth0.openai.com",
  "https://chatgpt.com",
]);
const localFrame = (event) => {
  if (
    new URL(event.senderFrame.url).origin !== origin ||
    event.senderFrame !== event.sender.mainFrame
  )
    throw Error("Only the local companion can use desktop features.");
};
function external(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !externalOrigins.has(url.origin)
  )
    throw Error("This external address is not allowed.");
  return shell.openExternal(url.href);
}
function windowFor(path = "/") {
  const win = new BrowserWindow({
    width: path === "/" ? 1360 : 660,
    height: path === "/" ? 920 : 760,
    minWidth: 390,
    minHeight: 600,
    title: "Galaxi",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    void external(url).catch(() => {});
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) {
      event.preventDefault();
      void external(url).catch(() => {});
    }
  });
  win.loadURL(origin + path);
  return win;
}
function connectLink(value) {
  try {
    const link = new URL(value);
    if (
      link.protocol !== "galaxi:" ||
      link.hostname !== "connect" ||
      link.username ||
      link.password
    )
      return;
    const website = new URL(link.searchParams.get("origin"));
    const state = link.searchParams.get("state") || "";
    if (
      website.protocol !== "https:" ||
      website.origin !== link.searchParams.get("origin") ||
      !/^[a-f0-9-]{36}$/.test(state)
    )
      return;
    externalOrigins.add(website.origin);
    if (!mainWindow) {
      pendingLink = value;
      return;
    }
    if (approvalWindow && !approvalWindow.isDestroyed()) approvalWindow.close();
    approvalWindow = windowFor(
      "/connect?" + new URLSearchParams({ origin: website.origin, state }),
    );
  } catch {}
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, args) => {
    const link = args.find((a) => a.startsWith("galaxi://"));
    if (link) connectLink(link);
    else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    connectLink(url);
  });
  app
    .whenReady()
    .then(async () => {
      if (!app.isPackaged && process.env.GALAXI_DESKTOP_TEST !== "1")
        throw Error("Build the desktop app before launching it.");
      if (app.isPackaged && process.env.GALAXI_DESKTOP_TEST !== "1")
        app.setAsDefaultProtocolClient("galaxi");
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      ipcMain.handle("galaxi:directory", async (event) => {
        localFrame(event);
        const r = await dialog.showOpenDialog(
          BrowserWindow.fromWebContents(event.sender),
          { properties: ["openDirectory"] },
        );
        return r.canceled ? undefined : r.filePaths[0];
      });
      ipcMain.handle("galaxi:external", (event, url) => {
        localFrame(event);
        return external(url);
      });
      const resourceRoot =
        !app.isPackaged && process.env.GALAXI_DESKTOP_TEST === "1"
          ? join(app.getAppPath(), "..", "desktop-runtime")
          : join(process.resourcesPath, "companion");
      const probe = net.createServer();
      await new Promise((resolve, reject) => {
        probe.once("error", () =>
          reject(
            Error(
              "Port 4310 is already in use. Close the other Galaxi companion and open this app again.",
            ),
          ),
        );
        probe.listen(4310, "127.0.0.1", () => probe.close(resolve));
      });
      mkdirSync(app.getPath("userData"), { recursive: true });
      const env = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "",
        NODE_OPTIONS: "",
        PORT: "4310",
        GALAXI_DESKTOP: "1",
        CITY_DATA_DIR: app.getPath("userData"),
        GALAXI_STATIC_DIR: join(resourceRoot, "dist"),
        CITY_WATCH_THREAD: "",
        CODEX_BIN: join(
          resourceRoot,
          "vendor",
          "x86_64-pc-windows-msvc",
          "bin",
          "codex.exe",
        ),
        PATH:
          join(resourceRoot, "node") +
          ";" +
          join(resourceRoot, "vendor", "x86_64-pc-windows-msvc", "codex-path") +
          ";" +
          process.env.PATH,
      };
      child = spawn(
        join(resourceRoot, "node", "node.exe"),
        [join(resourceRoot, "server.mjs"), "--production"],
        {
          cwd: app.getPath("userData"),
          env,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      // Only the fixed startup marker is used; runtime output is never rendered or uploaded.
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("The companion did not start within 30 seconds.")),
          30000,
        );
        child.stdout.on("data", (b) => {
          if (b.toString().includes("Galaxi: " + origin)) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.stderr.on("data", () => {});
        child.once("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.once("exit", () => {
          clearTimeout(timer);
          reject(Error("The companion stopped before it was ready."));
        });
      });
      child.on("exit", () => {
        if (!stopping) {
          dialog.showErrorBox(
            "Galaxi stopped",
            "Close and reopen Galaxi. Your projects and history remain saved.",
          );
          app.quit();
        }
      });
      mainWindow = windowFor();
      const requested =
        pendingLink || process.argv.find((a) => a.startsWith("galaxi://"));
      if (requested) connectLink(requested);
    })
    .catch((error) => {
      dialog.showErrorBox("Could not start Galaxi", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (stopping || !child || child.exitCode !== null) return;
    event.preventDefault();
    stopping = true;
    const timer = setTimeout(() => {
      if (child?.pid) {
        const killer = spawn(
          "taskkill.exe",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        killer.on("error", () => child.kill());
      }
      app.quit();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      app.quit();
    });
    child.stdin.write("shutdown\n");
  });
}
