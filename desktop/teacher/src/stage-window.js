"use strict";

/**
 * The class stage runs in its own OFFSCREEN window.
 *
 * Why: the stage (board + camera + mic → encoder) used to run inside the
 * teacher's window. When a teacher minimised that window or covered it with
 * another app, Windows/Chromium paused its page and YouTube got no video
 * ("No data", 11-second keyframes — seen in the first real test class).
 * An offscreen window is never shown, so it can never be minimised or
 * occluded: Chromium keeps rendering it at a fixed frame rate no matter
 * what the teacher does with the app.
 *
 * The stage window loads the class's /obs-stage page (same board mirror OBS
 * uses) from the trusted origin; that page sees `atomicDesktop.stage.isStage`
 * and runs the encoder itself. The stream key reaches it only over IPC
 * (stage:job), never in a URL.
 *
 *   stage:open  (teacher window) { stagePath, serverUrl, streamKey, profile }
 *   stage:job   (stage window only) → the job above
 *   stage:close (teacher window)
 *   desktop:is-stage (sync) → is the calling page the stage window?
 */

const { BrowserWindow } = require("electron");
const { appUrl, isTrustedUrl } = require("./config");

const FRAME_RATE = 30;
let stage = null; // { win, stagePath, job }
// Teacher's live switches for the class stream (camera off / mic muted). Kept
// here so a (re)started stage applies them from its first frame.
let control = { cameraOff: false, micMuted: false, chroma: null };

function isStageSender(event) {
  return Boolean(stage && !stage.win.isDestroyed() && event.sender.id === stage.win.webContents.id);
}

function closeStage() {
  const s = stage;
  stage = null;
  control = { cameraOff: false, micMuted: false, chroma: null };
  if (s && !s.win.isDestroyed()) s.win.destroy(); // encoder-ipc stops the run when its sender goes away
}

function openStage({ stagePath, job, preloadPath }) {
  const win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    useContentSize: true,
    webPreferences: {
      offscreen: true,
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  wc.setFrameRate(FRAME_RATE);
  // The stage window never attaches audio to speaker output elements, so local sound is never heard anyway.
  // Note: wc.setAudioMuted(true) must NOT be called because in Chromium/Electron it mutes WebAudio & MediaRecorder pipeline.
  wc.setWindowOpenHandler(() => ({ action: "deny" }));
  wc.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });
  wc.on("will-attach-webview", (event) => event.preventDefault());
  // The stage has no visible devtools; ATOMIC_STAGE_LOG=1 mirrors its console (tests/support).
  if (process.env.ATOMIC_STAGE_LOG === "1") {
    wc.on("console-message", (event) => console.log(`[stage] ${event.level ?? ""} ${event.message ?? ""}`));
    wc.on("render-process-gone", (_e, details) => console.log(`[stage] renderer gone: ${details.reason}`));
  }
  win.on("closed", () => {
    if (stage && stage.win === win) stage = null;
  });
  stage = { win, stagePath, job };
  win.loadURL(new URL(stagePath, appUrl()).toString());
  return stage;
}

function registerStageIpc({ ipcMain, trustedSender, preloadPath }) {
  const guard = (event) => {
    if (!trustedSender(event)) throw new Error("untrusted sender");
  };

  ipcMain.on("desktop:is-stage", (event) => {
    event.returnValue = isStageSender(event);
  });

  ipcMain.handle("stage:open", (event, opts) => {
    guard(event);
    if (isStageSender(event)) throw new Error("The stage can't open another stage.");
    const stagePath = typeof opts?.stagePath === "string" ? opts.stagePath : "";
    // A path on the trusted origin only ("/obs-stage/…?token=…"), never another site.
    if (!stagePath.startsWith("/") || stagePath.startsWith("//")) throw new Error("stagePath must be a path on the Atomic site.");
    if (typeof opts.serverUrl !== "string" || !/^rtmps?:\/\//i.test(opts.serverUrl)) throw new Error("serverUrl must be rtmp(s)://");
    if (typeof opts.streamKey !== "string" || !opts.streamKey) throw new Error("streamKey is required.");
    const job = { serverUrl: opts.serverUrl, streamKey: opts.streamKey, profile: opts.profile === "720p" ? "720p" : "1080p" };

    // Already sending this class (e.g. the teacher page was refreshed): keep
    // the running stage — the stream is never interrupted by a reload.
    if (stage && !stage.win.isDestroyed() && stage.stagePath === stagePath) {
      stage.job = job;
      return { opened: true, reused: true };
    }
    closeStage();
    openStage({ stagePath, job, preloadPath });
    return { opened: true, reused: false };
  });

  ipcMain.handle("stage:job", (event) => {
    guard(event);
    return isStageSender(event) ? { ...stage.job, control } : null;
  });

  // Teacher window → stage: camera off / mic mute in the class stream.
  ipcMain.handle("stage:control", (event, next) => {
    guard(event);
    if (isStageSender(event)) throw new Error("The stage can't control itself.");
    control = {
      cameraOff: typeof next?.cameraOff === "boolean" ? next.cameraOff : control.cameraOff,
      micMuted: typeof next?.micMuted === "boolean" ? next.micMuted : control.micMuted,
      // Plain data only; the stage page validates it (sanitizeChroma).
      chroma: next && typeof next.chroma === "object" ? JSON.parse(JSON.stringify(next.chroma)) : control.chroma,
    };
    if (stage && !stage.win.isDestroyed()) stage.win.webContents.send("stage:control", control);
    return control;
  });

  ipcMain.handle("stage:close", (event) => {
    guard(event);
    closeStage();
    return { closed: true };
  });
}

module.exports = { registerStageIpc, closeStage };
