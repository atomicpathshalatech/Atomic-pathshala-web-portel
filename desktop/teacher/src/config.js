"use strict";

/**
 * Which Atomic Pathshala site the app opens, and the ONLY origins it will
 * treat as trusted (navigation, camera/mic, the desktop bridge).
 *
 * ATOMIC_APP_URL overrides the production site — e.g. http://localhost:3217
 * for local testing. Only that one origin is trusted; everything else opens
 * in the teacher's normal browser.
 */
const DEFAULT_APP_URL = "https://ap.atomicpathshala.in";

function appUrl() {
  const raw = process.env.ATOMIC_APP_URL || DEFAULT_APP_URL;
  const url = new URL(raw);
  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error(`ATOMIC_APP_URL must be https (or http on localhost): ${raw}`);
  }
  return url;
}

function isTrustedUrl(candidate) {
  try {
    return new URL(candidate).origin === appUrl().origin;
  } catch {
    return false;
  }
}

module.exports = { appUrl, isTrustedUrl, DEFAULT_APP_URL };
