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
  "https://verify.phone91.com/otp-provider.js",
];

export const MSG91_WIDGET_ID =
  process.env.NEXT_PUBLIC_MSG91_WIDGET_ID?.trim() || "36696a68696e333334323634";
export const MSG91_WIDGET_TOKEN = process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN?.trim() || "";

export function msg91WidgetConfigured(): boolean {
  return Boolean(MSG91_WIDGET_ID && MSG91_WIDGET_TOKEN);
}

declare global {
  interface Window {
    initSendOTP?: (config: unknown) => void;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Injects the provider script once (with the fallback host). Resolves when
 *  window.initSendOTP is available. */
export function loadMsg91Widget(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (typeof window.initSendOTP === "function") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    let i = 0;
    const attempt = () => {
      const s = document.createElement("script");
      s.src = SCRIPT_URLS[i]!;
      s.async = true;
      s.onload = () => {
        if (typeof window.initSendOTP === "function") resolve();
        else reject(new Error("MSG91 widget loaded but initSendOTP is missing"));
      };
      s.onerror = () => {
        i += 1;
        if (i < SCRIPT_URLS.length) attempt();
        else reject(new Error("Could not load the OTP widget. Check your connection."));
      };
      document.head.appendChild(s);
    };
    attempt();
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
          reject(new Error("OTP widget is not configured (NEXT_PUBLIC_MSG91_WIDGET_TOKEN)."));
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
            if (token) resolve(token);
            else reject(new Error("The widget did not return a verification token."));
          },
          failure: (err: unknown) => {
            const msg =
              (err as { message?: string })?.message ||
              (typeof err === "string" ? err : "OTP verification was cancelled or failed.");
            reject(new Error(msg));
          },
        });
      })
  );
}
