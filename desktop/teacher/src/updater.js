"use strict";

/**
 * Silent updates for the installed Teacher app.
 *
 * A new version is downloaded in the background and installed the next time
 * the teacher closes the app — never during a class, no dialog, no "update
 * now" button, and the app is never blocked waiting for an update. If there
 * is no internet or the update server cannot be reached, nothing happens and
 * the app keeps working on the version it has.
 *
 * Releases are read from the "publish" entry in package.json (a folder in
 * file storage holding latest.yml + the installer).
 */

const { app } = require("electron");

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

function startSilentUpdates() {
  // Only an installed app updates itself (not `npm start`, not smoke tests).
  if (!app.isPackaged || process.env.ATOMIC_NO_UPDATES === "1") return;

  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (err) {
    console.warn("[updater] not available:", err && err.message);
    return;
  }

  autoUpdater.autoDownload = true;
  // Installed when the teacher closes the app; never forced while it runs.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = {
    info: (m) => console.log("[updater]", m),
    warn: (m) => console.warn("[updater]", m),
    error: (m) => console.warn("[updater]", m),
    debug: () => {},
  };
  autoUpdater.on("error", (err) => console.warn("[updater] check failed (will retry later):", err && err.message));
  autoUpdater.on("update-downloaded", (info) => console.log("[updater] version", info && info.version, "ready — installs when the app is closed"));

  // Test hook (scripts/test-silent-update): read releases from another folder and check at once.
  const testFeed = process.env.ATOMIC_UPDATE_URL;
  if (testFeed) autoUpdater.setFeedURL({ provider: "generic", url: testFeed });

  const check = () => autoUpdater.checkForUpdates().catch((err) => console.warn("[updater]", err && err.message));
  // A little after start, so it never competes with opening the classroom.
  setTimeout(check, testFeed ? 3000 : 60 * 1000);
  setInterval(check, CHECK_EVERY_MS).unref?.();
}

module.exports = { startSilentUpdates };
