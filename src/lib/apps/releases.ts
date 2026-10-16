import "server-only";
import { TEACHER_APP_INSTALLER_KEY, TEACHER_APP_VERSION } from "@/lib/desktop/release";

/**
 * The Atomic Pathshala apps people download from the portal: the Windows app
 * (the same one teachers already use — it opens the portal of whoever signs
 * in) and the Android app (the Capacitor app in /android).
 *
 * The installers are too big for the deployment, so they live in file
 * storage. Each platform has a small manifest next to them,
 * apps/<platform>/latest.json, written when a build is published (the
 * App Releases page, the Android build workflow, or the desktop publish
 * script). The Windows app falls back to the desktop auto-update manifest
 * (desktop/latest.yml) and then to the last hard-coded build.
 */
export const APP_PLATFORMS = ["windows", "android"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

export type AppRelease = {
  platform: AppPlatform;
  version: string;
  /** Storage key of the installer (.exe / .apk). */
  key: string;
  fileName: string;
  sizeBytes: number | null;
  publishedAt: string | null;
  notes: string | null;
};

export const APP_FILE_EXTENSION: Record<AppPlatform, string> = { windows: ".exe", android: ".apk" };

export const manifestKey = (platform: AppPlatform) => `apps/${platform}/latest.json`;

export function storagePublicBase(): string {
  return (process.env.R2_PUBLIC_BASE_URL || process.env.STORAGE_PUBLIC_URL || "").replace(/\/+$/, "");
}

export function isAppPlatform(v: string): v is AppPlatform {
  return (APP_PLATFORMS as readonly string[]).includes(v);
}

async function fetchText(url: string): Promise<string | null> {
  try {
    // The manifest changes on every publish; never serve a cached copy.
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function fromManifest(platform: AppPlatform, raw: string | null): AppRelease | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Partial<AppRelease>;
    if (!m.key || !m.version || !m.key.toLowerCase().endsWith(APP_FILE_EXTENSION[platform])) return null;
    return {
      platform,
      version: String(m.version),
      key: String(m.key),
      fileName: String(m.fileName || m.key.split("/").pop()),
      sizeBytes: typeof m.sizeBytes === "number" ? m.sizeBytes : null,
      publishedAt: m.publishedAt ? String(m.publishedAt) : null,
      notes: m.notes ? String(m.notes) : null,
    };
  } catch {
    return null;
  }
}

/** desktop/latest.yml — written by electron-builder for the app's own auto-updates. */
function fromDesktopYml(raw: string | null): AppRelease | null {
  if (!raw) return null;
  const file = raw.match(/^path:\s*(.+)$/m)?.[1]?.trim();
  const version = raw.match(/^version:\s*(.+)$/m)?.[1]?.trim();
  if (!file || !version || !file.toLowerCase().endsWith(".exe")) return null;
  const size = Number(raw.match(/^\s+size:\s*(\d+)$/m)?.[1]);
  return {
    platform: "windows",
    version,
    key: `desktop/${file}`,
    fileName: file,
    sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
    publishedAt: raw.match(/^releaseDate:\s*'?([^'\n]+)'?$/m)?.[1] ?? null,
    notes: null,
  };
}

/** The current build of an app, or null when none has been published yet. */
export async function getLatestRelease(platform: AppPlatform): Promise<AppRelease | null> {
  const base = storagePublicBase();
  if (!base) return null;
  const published = fromManifest(platform, await fetchText(`${base}/${manifestKey(platform)}`));
  if (published || platform === "android") return published;
  return (
    fromDesktopYml(await fetchText(`${base}/desktop/latest.yml`)) ?? {
      platform: "windows",
      version: TEACHER_APP_VERSION,
      key: TEACHER_APP_INSTALLER_KEY,
      fileName: TEACHER_APP_INSTALLER_KEY.split("/").pop()!,
      sizeBytes: null,
      publishedAt: null,
      notes: null,
    }
  );
}

export function releaseDownloadUrl(release: AppRelease): string {
  return `${storagePublicBase()}/${release.key}`;
}
