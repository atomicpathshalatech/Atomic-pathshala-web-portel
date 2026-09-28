"use strict";

/**
 * IPC surface of the built-in encoder (see encoder.js). One encoder run at a
 * time. Every call re-checks that it came from the trusted Atomic origin.
 *
 *   encoder:probe   → { available, hardwareEncoders, chosen, reason? }
 *   encoder:start   → { runId }            (serverUrl + streamKey from the class's own lease)
 *   encoder:chunk   (runId, generation, ArrayBuffer)   fire-and-forget
 *   encoder:stop    → { stopped }
 *   encoder:status  → current status
 *   push "encoder:status-changed" to the page on every change
 *
 * While a run is active the machine is kept from suspending (the lid may
 * close on a laptop teaching from a second screen).
 */

const { app, BrowserWindow, powerSaveBlocker } = require("electron");
const { isTrustedUrl } = require("./config");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { EncoderRun, probeEncoders } = require("./encoder");

function ffmpegPath() {
  if (process.env.ATOMIC_FFMPEG_PATH) return process.env.ATOMIC_FFMPEG_PATH;
  return app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg", "ffmpeg.exe")
    : path.join(__dirname, "..", "vendor", "ffmpeg", "ffmpeg.exe");
}

let probeCache = null;
// ATOMIC_STAGE_LOG=1: once a second, how many chunk bytes reached the encoder (tests/support).
let chunkBytes = 0;
if (process.env.ATOMIC_STAGE_LOG === "1") setInterval(() => { console.log(`[stage] ipc ${chunkBytes} B/s`); chunkBytes = 0; }, 1000).unref?.();
let current = null; // { run, sender, blockerId }

function probe() {
  if (probeCache) return probeCache;
  const bin = ffmpegPath();
  if (!existsSync(bin)) {
    probeCache = { available: false, reason: "The encoder component is missing from this installation. Reinstall the app." };
    return probeCache;
  }
  const usable = probeEncoders(bin);
  probeCache = usable.length
    ? { available: true, hardwareEncoders: usable.filter((e) => e !== "libopenh264"), encoders: usable, chosen: usable[0] }
    : { available: false, reason: "No working H.264 encoder was found on this computer." };
  return probeCache;
}

function registerEncoderIpc({ ipcMain, trustedSender }) {
  const guard = (event) => {
    if (!trustedSender(event)) throw new Error("untrusted sender");
  };

  ipcMain.handle("encoder:probe", (event) => {
    guard(event);
    return probe();
  });

  ipcMain.handle("encoder:start", async (event, opts) => {
    guard(event);
    const p = probe();
    if (!p.available) throw new Error(p.reason);
    if (!opts || typeof opts.serverUrl !== "string" || typeof opts.streamKey !== "string") {
      throw new Error("serverUrl and streamKey are required.");
    }
    if (!/^rtmps?:\/\//i.test(opts.serverUrl)) throw new Error("serverUrl must be rtmp(s)://");
    if (current) await stopCurrent();

    const run = new EncoderRun({
      runId: randomUUID(),
      ffmpegPath: ffmpegPath(),
      encoder: p.chosen,
      serverUrl: opts.serverUrl,
      streamKey: opts.streamKey,
      fps: Number(opts.fps) || 30,
      profile: opts.profile === "720p" ? "720p" : "1080p",
    });
    const sender = event.sender;
    // Every Atomic window hears the status: the run belongs to the offscreen
    // stage window, but the teacher's window shows "Sending to YouTube".
    run.on("status", (status) => {
      if (process.env.ATOMIC_STAGE_LOG === "1") console.log(`[stage] status ${status.state} ${status.bitrateKbps ?? ""}kbps fps=${status.fps ?? ""}${status.error ? " error=" + status.error : ""}`);
      for (const win of BrowserWindow.getAllWindows()) {
        const wc = win.webContents;
        if (!wc.isDestroyed() && isTrustedUrl(wc.getURL())) wc.send("encoder:status-changed", status);
      }
    });
    const blockerId = powerSaveBlocker.start("prevent-app-suspension");
    current = { run, sender, blockerId };
    // Stop streaming if the page that owns the run goes away.
    sender.once("destroyed", () => {
      if (current && current.run === run) stopCurrent();
    });
    run.start();
    return { runId: run.runId, encoder: p.chosen };
  });

  ipcMain.on("encoder:chunk", (event, runId, generation, chunk) => {
    if (!trustedSender(event)) return;
    if (!current || current.run.runId !== runId) return;
    chunkBytes += chunk?.byteLength ?? 0;
    current.run.write(generation, chunk);
  });

  ipcMain.handle("encoder:stop", async (event, runId) => {
    guard(event);
    if (current && (!runId || current.run.runId === runId)) await stopCurrent();
    return { stopped: true };
  });

  ipcMain.handle("encoder:status", (event, runId) => {
    guard(event);
    if (!current || (runId && current.run.runId !== runId)) return { state: "stopped" };
    return current.run.status();
  });

  app.on("before-quit", () => {
    if (current) stopCurrent();
  });
}

async function stopCurrent() {
  const c = current;
  if (!c) return;
  current = null;
  try {
    await c.run.stop();
  } finally {
    if (powerSaveBlocker.isStarted(c.blockerId)) powerSaveBlocker.stop(c.blockerId);
  }
}

module.exports = { registerEncoderIpc };
