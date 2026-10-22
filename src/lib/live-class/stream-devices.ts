/**
 * The camera and microphone the teacher picked for the class stream.
 *
 * The Windows app streams from a hidden offscreen "stage" window, separate
 * from the teacher's window — it used to open whatever Windows' default
 * camera/mic was, so a teacher on a USB mic or a second webcam was streamed
 * with the laptop's built-in ones. Both windows are the same site in the same
 * app session and share localStorage, so the choice made in the teacher's
 * window (the class setup wizard) is saved here and read by the stage.
 *
 * Browser-only. Storage can be unavailable; then the defaults are used.
 */
const KEY = "atomic:stream-devices";

export type StreamDevices = { cameraDeviceId?: string; microphoneDeviceId?: string };

export function saveStreamDevices(devices: StreamDevices) {
  try {
    const clean: StreamDevices = {};
    if (devices.cameraDeviceId) clean.cameraDeviceId = devices.cameraDeviceId;
    if (devices.microphoneDeviceId) clean.microphoneDeviceId = devices.microphoneDeviceId;
    window.localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    // storage blocked: the stage uses the default devices
  }
}

export function loadStreamDevices(): StreamDevices {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StreamDevices;
    return {
      cameraDeviceId: typeof parsed.cameraDeviceId === "string" ? parsed.cameraDeviceId : undefined,
      microphoneDeviceId: typeof parsed.microphoneDeviceId === "string" ? parsed.microphoneDeviceId : undefined,
    };
  } catch {
    return {};
  }
}
