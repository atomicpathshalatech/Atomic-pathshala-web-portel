"use strict";

/**
 * The ONLY thing the Atomic web page can reach in the desktop app:
 * `window.atomicDesktop`. Exposed only when the page is the trusted Atomic
 * origin (see config.js); on any other page nothing is exposed. The main
 * process re-checks the origin of every call as well.
 */
const { contextBridge, ipcRenderer } = require("electron");

const trustedOrigin = ipcRenderer.sendSync("desktop:trusted-origin");

if (window.location.origin === trustedOrigin) {
  contextBridge.exposeInMainWorld("atomicDesktop", {
    isDesktop: true,
    info: () => ipcRenderer.invoke("desktop:info"),
    encoder: {
      /** What this machine can encode with (hardware encoders, FFmpeg present). */
      probe: () => ipcRenderer.invoke("encoder:probe"),
      /** Opens an encoder run for a class; resolves with a run id. */
      start: (opts) => ipcRenderer.invoke("encoder:start", opts),
      /**
       * Sends one chunk of the stage recording (ArrayBuffer). `generation`
       * is the encoder restart counter from the latest status: after a
       * reconnect the page starts a fresh recorder for the new generation.
       */
      push: (runId, generation, chunk) => ipcRenderer.send("encoder:chunk", runId, generation, chunk),
      stop: (runId) => ipcRenderer.invoke("encoder:stop", runId),
      status: (runId) => ipcRenderer.invoke("encoder:status", runId),
      onStatus: (listener) => {
        const handler = (_event, status) => listener(status);
        ipcRenderer.on("encoder:status-changed", handler);
        return () => ipcRenderer.removeListener("encoder:status-changed", handler);
      },
    },
    /**
     * The class stage runs in a hidden offscreen window (never minimised or
     * covered, so the stream never pauses). The teacher window opens/closes
     * it; the stage page itself sees isStage=true and asks for its job.
     */
    stage: {
      isStage: ipcRenderer.sendSync("desktop:is-stage"),
      open: (opts) => ipcRenderer.invoke("stage:open", opts),
      close: () => ipcRenderer.invoke("stage:close"),
      job: () => ipcRenderer.invoke("stage:job"),
      /** Teacher window: camera off / mic muted in the class stream. */
      control: (state) => ipcRenderer.invoke("stage:control", state),
      /** Stage window: hear those switches. */
      onControl: (listener) => {
        const handler = (_event, state) => listener(state);
        ipcRenderer.on("stage:control", handler);
        return () => ipcRenderer.removeListener("stage:control", handler);
      },
    },
  });
}
