"use strict";

/**
 * Encoder IPC surface. Step 8 ships the shell and the stage compositor; the
 * FFmpeg-backed encoder behind these channels arrives in step 9. Until
 * then probe() reports it unavailable and start() refuses, so the web page
 * keeps using the manual OBS path.
 */
function registerEncoderIpc({ ipcMain, trustedSender }) {
  const guard = (event) => {
    if (!trustedSender(event)) throw new Error("untrusted sender");
  };
  ipcMain.handle("encoder:probe", (event) => {
    guard(event);
    return { available: false, reason: "The built-in encoder is not installed in this version yet." };
  });
  ipcMain.handle("encoder:start", (event) => {
    guard(event);
    throw new Error("The built-in encoder is not available in this version yet.");
  });
  ipcMain.on("encoder:chunk", () => {});
  ipcMain.handle("encoder:stop", (event) => {
    guard(event);
    return { stopped: true };
  });
  ipcMain.handle("encoder:status", (event) => {
    guard(event);
    return { state: "unavailable" };
  });
}

module.exports = { registerEncoderIpc };
