import "server-only";

/** Same resolution order as lib/invitations.ts / lib/auth/reset-tokens.ts — kept in one place now that a third caller needs it. */
export function getAppBaseUrl(): string {
  let base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://ap.atomicpathshala.in"
  ).replace(/\/$/, "");

  if (base.includes("vercel.app") || (process.env.NODE_ENV === "production" && base.includes("localhost"))) {
    base = "https://ap.atomicpathshala.in";
  }

  try {
    new URL(base);
  } catch {
    base = "https://ap.atomicpathshala.in";
  }

  return base;
}

export function getLoginUrl(): string {
  return `${getAppBaseUrl()}/login`;
}
