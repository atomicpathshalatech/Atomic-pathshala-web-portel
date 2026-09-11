import "server-only";

/** Same resolution order as lib/invitations.ts / lib/auth/reset-tokens.ts — kept in one place now that a third caller needs it. */
export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://ap.atomicpathshala.in"
  ).replace(/\/$/, "");
}

export function getLoginUrl(): string {
  return `${getAppBaseUrl()}/login`;
}
