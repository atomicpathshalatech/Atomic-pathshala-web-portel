"use client";

import { registerPlugin } from "@capacitor/core";
import { isAndroid, isNativeApp } from "./index";

export type FloatingPollOption = {
  key: string;
  label: string;
};

export type StartFloatingPollSessionOptions = {
  sessionId: string;
  apiUrl: string;
};

export type ShowFloatingPollOptions = {
  id: string;
  questionText: string;
  options: FloatingPollOption[];
  timeLimitSec: number;
  startedAt: string;
  sessionId: string;
  apiUrl: string;
  studentId?: string;
  cookies?: string;
  mySelection?: string | null;
};

export type UpdateFloatingPollResultsOptions = {
  id: string;
  correctOption?: string;
  counts?: Record<string, number>;
  totalResponses?: number;
};

export interface FloatingPollPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ requested: boolean }>;
  startSession(options: StartFloatingPollSessionOptions): Promise<{ success: boolean }>;
  showPoll(options: ShowFloatingPollOptions): Promise<{ success: boolean }>;
  updateResults(options: UpdateFloatingPollResultsOptions): Promise<{ success: boolean }>;
  dismissPoll(options?: { id?: string }): Promise<{ success: boolean }>;
  stopService(): Promise<{ success: boolean }>;
}

const FloatingPoll = registerPlugin<FloatingPollPlugin>("FloatingPoll");

export async function checkOverlayPermission(): Promise<boolean> {
  if (!isNativeApp() || !isAndroid()) return false;
  try {
    const res = await FloatingPoll.checkPermission();
    return Boolean(res?.granted);
  } catch (err) {
    console.warn("[FloatingPoll] checkPermission failed:", err);
    return false;
  }
}

export async function requestOverlayPermission(): Promise<void> {
  if (!isNativeApp() || !isAndroid()) return;
  try {
    await FloatingPoll.requestPermission();
  } catch (err) {
    console.warn("[FloatingPoll] requestPermission failed:", err);
  }
}

export async function startFloatingPollSession(options: StartFloatingPollSessionOptions): Promise<void> {
  if (!isNativeApp() || !isAndroid()) return;
  try {
    await FloatingPoll.startSession(options);
  } catch (err) {
    console.warn("[FloatingPoll] startSession failed:", err);
  }
}

export async function showNativeFloatingPoll(options: ShowFloatingPollOptions): Promise<void> {
  if (!isNativeApp() || !isAndroid()) return;
  try {
    await FloatingPoll.showPoll(options);
  } catch (err) {
    console.warn("[FloatingPoll] showPoll failed:", err);
  }
}

export async function updateNativeFloatingPollResults(
  options: UpdateFloatingPollResultsOptions
): Promise<void> {
  if (!isNativeApp() || !isAndroid()) return;
  try {
    await FloatingPoll.updateResults(options);
  } catch (err) {
    console.warn("[FloatingPoll] updateResults failed:", err);
  }
}

export async function dismissNativeFloatingPoll(pollId?: string): Promise<void> {
  if (!isNativeApp() || !isAndroid()) return;
  try {
    await FloatingPoll.dismissPoll({ id: pollId });
  } catch (err) {
    console.warn("[FloatingPoll] dismissPoll failed:", err);
  }
}

export async function stopNativeFloatingPollService(): Promise<void> {
  if (!isNativeApp() || !isAndroid()) return;
  try {
    await FloatingPoll.stopService();
  } catch (err) {
    console.warn("[FloatingPoll] stopService failed:", err);
  }
}
