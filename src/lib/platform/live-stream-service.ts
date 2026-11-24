import { registerPlugin } from "@capacitor/core";
import { isNativeApp, isAndroid } from "./index";

export interface LiveStreamingPluginInterface {
  startLiveService(options: { title: string; status: string }): Promise<{ success: boolean; foreground: boolean }>;
  updateLiveService(options: { status: string }): Promise<{ success: boolean }>;
  stopLiveService(): Promise<{ success: boolean }>;
  checkDeviceStatus(): Promise<{
    batteryLevel: number;
    isPowerSave: boolean;
    isIgnoringBatteryOptimizations: boolean;
    deviceModel: string;
    androidVersion: string;
  }>;
}

const LiveStreaming = registerPlugin<LiveStreamingPluginInterface>("LiveStreaming");

/**
 * Starts the native Android Foreground Streaming Service to hold CPU wake locks,
 * Wi-Fi performance lock, and keep the audio/video broadcast session active when
 * the teacher minimizes the application or navigates to other apps.
 */
export async function startNativeLiveService(title: string, status = "Live streaming active"): Promise<boolean> {
  if (!isNativeApp() || !isAndroid()) return false;
  try {
    const res = await LiveStreaming.startLiveService({ title, status });
    return res.success;
  } catch (err) {
    console.warn("[LiveStreamingService] Failed to start native foreground service:", err);
    return false;
  }
}

export async function updateNativeLiveServiceStatus(status: string): Promise<boolean> {
  if (!isNativeApp() || !isAndroid()) return false;
  try {
    const res = await LiveStreaming.updateLiveService({ status });
    return res.success;
  } catch {
    return false;
  }
}

export async function stopNativeLiveService(): Promise<boolean> {
  if (!isNativeApp() || !isAndroid()) return false;
  try {
    const res = await LiveStreaming.stopLiveService();
    return res.success;
  } catch {
    return false;
  }
}

/**
 * Triggers the server-side Cloud Streaming Pipeline (Option A):
 * Ingests the classroom stage (/obs-stage) via headless cloud chromium and pushes
 * directly into the leased YouTube RTMP stream.
 */
export async function triggerCloudStageStreaming(scheduleId: string): Promise<{
  success: boolean;
  message?: string;
  egressId?: string | null;
}> {
  try {
    const res = await fetch(`/api/team/live-class/${scheduleId}/cloud-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      return { success: true, message: json.data?.message, egressId: json.data?.egressId };
    }
    return { success: false, message: json.error || "Cloud stream failed to start." };
  } catch (err: any) {
    return { success: false, message: err?.message || "Network error starting cloud stream." };
  }
}

export async function stopCloudStageStreaming(scheduleId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/team/live-class/${scheduleId}/cloud-stream`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}
