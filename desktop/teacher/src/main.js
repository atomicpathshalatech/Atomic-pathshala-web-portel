"use strict";

/**
 * Atomic Pathshala Teacher — Electron main process.
 *
 * The app is a thin, locked-down shell around the existing teacher portal
 * (the same whiteboard, schedule and class controls teachers already use),
 * plus desktop-only capabilities the web page can't have — above all, a
 * local encoder that sends the class to YouTube (step 9). The teacher never
 * sees OBS, RTMP URLs or stream keys.
 *
 * Security posture:
 *   - one trusted origin (config.js); every other navigation/popup goes to
 *     the system browser;
 *   - contextIsolation + sandbox, no Node in the page; the page only gets
 *     the small `window.atomicDesktop` bridge from preload.js, and only on
 *     the trusted origin;
 *   - camera/mic/fullscreen are granted to the trusted origin only;
 *   - every IPC call re-checks that it came from the trusted origin.
 */

const { app, BrowserWindow, ipcMain, session, shell, Menu } = require("electron");
const path = require("node:path");
const { appUrl, isTrustedUrl } = require("./config");
const { registerEncoderIpc } = require("./encoder-ipc");

const SMOKE = process.argv.includes("--smoke") || process.argv.includes("--smoke-untrusted");
// --smoke-untrusted: loads a page from another origin and passes only if the
// desktop bridge is NOT exposed there.
const SMOKE_UNTRUSTED = process.argv.includes("--smoke-untrusted");
const ALLOWED_PERMISSIONS = new Set(["media", "fullscreen", "clipboard-sanitized-write"]);

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow = null;

function trustedSender(event) {
  const url = event.senderFrame?.url || "";
  return isTrustedUrl(url);
}

function hardenSession(ses) {
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details.requestingUrl || webContents.getURL();
    callback(ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(origin));
  });
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(requestingOrigin);
  });
}

function createWindow() {
  const start = SMOKE_UNTRUSTED ? "data:text/html,<h1>untrusted</h1>" : new URL("/team", appUrl()).toString();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: !SMOKE,
    title: "Atomic Pathshala Teacher",
    backgroundColor: "#0b0d14",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // The class keeps streaming when the window is covered or minimised:
      // the stage compositor's timers must not be throttled.
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  const wc = mainWindow.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (isTrustedUrl(url)) return { action: "allow" };
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(url)) {
      event.preventDefault();
      if (/^https:\/\//.test(url)) shell.openExternal(url);
    }
  });
  wc.on("will-attach-webview", (event) => event.preventDefault());

  mainWindow.loadURL(start);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

function registerIpc() {
  ipcMain.handle("desktop:info", (event) => {
    if (!trustedSender(event)) throw new Error("untrusted sender");
    return {
      appVersion: app.getVersion(),
      electron: process.versions.electron,
      platform: process.platform,
      arch: process.arch,
    };
  });
  ipcMain.on("desktop:trusted-origin", (event) => {
    // Answered synchronously to the preload, which exposes the bridge only
    // when the page it runs in is the trusted origin.
    event.returnValue = appUrl().origin;
  });
  registerEncoderIpc({ ipcMain, trustedSender });
}

async function runSmoke() {
  const win = createWindow();
  const wc = win.webContents;
  const result = { url: null, loaded: false, bridge: null, error: null };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("load timeout")), 45_000);
      wc.once("did-finish-load", () => {
        clearTimeout(timer);
        resolve();
      });
      wc.once("did-fail-load", (_e, code, desc) => {
        clearTimeout(timer);
        reject(new Error(`did-fail-load ${code} ${desc}`));
      });
    });
    result.loaded = true;
    result.url = wc.getURL();
    result.bridge = await wc.executeJavaScript(
      "(async () => window.atomicDesktop ? { isDesktop: window.atomicDesktop.isDesktop, info: await window.atomicDesktop.info(), encoder: await window.atomicDesktop.encoder.probe() } : null)()"
    );
  } catch (err) {
    result.error = String(err && err.message ? err.message : err);
  }
  process.stdout.write(`ATOMIC_SMOKE ${JSON.stringify(result)}\n`);
  const ok = SMOKE_UNTRUSTED ? result.loaded && result.bridge === null : result.loaded && Boolean(result.bridge);
  app.exit(ok ? 0 : 1);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  hardenSession(session.defaultSession);
  registerIpc();
  if (SMOKE) {
    runSmoke();
    return;
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});
