"use client";

/**
 * MSG91 OTP Widget loader (client-side). The widget renders its own OTP
 * send/enter/verify UI in a popup; on success it hands back a signed
 * access token which our server verifies via
 * POST https://control.msg91.com/api/v5/widget/verifyAccessToken.
 *
 *   NEXT_PUBLIC_MSG91_WIDGET_ID     — the widget id (not secret)
 *   NEXT_PUBLIC_MSG91_WIDGET_TOKEN  — the "tokenAuth" widget token (client-exposed by design)
 *   MSG91_WIDGET_AUTHKEY            — server-only, used by /api/auth/otp/verify-widget
 */

const SCRIPT_URLS = [
  "https://verify.msg91.com/otp-provider.js",
  "https://control.msg91.com/app/assets/otp-provider/otp-provider.js",
  "https://verify.phone91.com/otp-provider.js",
];

export const MSG91_WIDGET_ID =
  process.env.NEXT_PUBLIC_MSG91_WIDGET_ID?.trim() || "36696a68696e333334323634";
export const MSG91_WIDGET_TOKEN =
  process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN?.trim() || "551795TUxFfoO3RRb6aa294dcP1";

export function msg91WidgetConfigured(): boolean {
  return Boolean(MSG91_WIDGET_ID && MSG91_WIDGET_TOKEN);
}

declare global {
  interface Window {
    initSendOTP?: (config: unknown) => void;
  }
}

let scriptPromise: Promise<void> | null = null;

// How long to wait for window.initSendOTP to appear after the script's own
// `onload` fires.
const INIT_POLL_INTERVAL_MS = 100;
const INIT_POLL_TIMEOUT_MS = 12000;

/** User-facing errors from this module are always a short, non-technical
 * sentence — every internal detail (which host failed, what was missing)
 * goes to console.error instead, so a student never sees raw plumbing like
 * an env var name or "initSendOTP is missing". */
export class Msg91WidgetError extends Error {}

function pollForInitSendOTP(): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (typeof window.initSendOTP === "function") {
        resolve();
        return;
      }
      if (Date.now() - start >= INIT_POLL_TIMEOUT_MS) {
        console.error("[msg91-widget] script loaded but window.initSendOTP never appeared");
        reject(new Msg91WidgetError("Could not start OTP verification. Please try again in a moment."));
        return;
      }
      setTimeout(check, INIT_POLL_INTERVAL_MS);
    };
    check();
  });
}

/** Injects the provider script once (with the fallback host). Resolves when
 *  window.initSendOTP is available. */
export function loadMsg91Widget(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Msg91WidgetError("OTP verification isn't available here."));
  if (typeof window.initSendOTP === "function") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    let i = 0;
    const attempt = () => {
      const s = document.createElement("script");
      s.src = SCRIPT_URLS[i]!;
      s.async = true;
      s.onload = () => {
        pollForInitSendOTP().then(resolve, reject);
      };
      s.onerror = () => {
        i += 1;
        if (i < SCRIPT_URLS.length) {
          attempt();
        } else {
          console.error("[msg91-widget] failed to load script from any host", SCRIPT_URLS);
          reject(new Msg91WidgetError("Could not load OTP verification. Check your connection and try again."));
        }
      };
      document.head.appendChild(s);
    };
    attempt();
  });
  // A failed attempt (bad network blip, ad-blocker hiccup, etc.) used to
  // leave the rejected promise cached here forever — every later call
  // (e.g. the student tapping "Verify with OTP" again) got the same stale
  // failure back immediately with no real retry. Clearing it on rejection
  // lets the next call genuinely try loading the script again.
  scriptPromise.catch(() => {
    scriptPromise = null;
  });
  return scriptPromise;
}

/**
 * Opens the widget for one verification and resolves with the access
 * token. `identifier` should be the full number with country code, e.g.
 * "919812345670".
 */
export function verifyWithMsg91Widget(identifier: string): Promise<string> {
  return loadMsg91Widget().then(
    () =>
      new Promise<string>((resolve, reject) => {
        if (!msg91WidgetConfigured()) {
          console.error("[msg91-widget] NEXT_PUBLIC_MSG91_WIDGET_TOKEN is not set");
          reject(new Msg91WidgetError("OTP verification isn't available right now. Please try again shortly."));
          return;
        }
        window.initSendOTP!({
          widgetId: MSG91_WIDGET_ID,
          tokenAuth: MSG91_WIDGET_TOKEN,
          identifier,
          exposeMethods: false,
          success: (data: unknown) => {
            const token =
              (typeof data === "string" && data) ||
              (data as { message?: string; accessToken?: string })?.message ||
              (data as { accessToken?: string })?.accessToken ||
              "";
            if (token) {
              resolve(token);
            } else {
              console.error("[msg91-widget] success callback fired without a usable token", data);
              reject(new Msg91WidgetError("Could not complete OTP verification. Please try again."));
            }
          },
          failure: (err: unknown) => {
            // This one IS shown to the user as-is (unlike the load/config
            // errors above) — it's the widget's own OTP-flow message
            // ("Incorrect OTP", "cancelled", etc.), not an internal detail.
            const msg =
              (err as { message?: string })?.message ||
              (typeof err === "string" ? err : "OTP verification was cancelled or failed.");
            reject(new Error(msg));
          },
        });
      })
  );
}
