/**
 * Single source for the NextAuth JWT signing secret, used by both
 * src/lib/auth.ts (node) and middleware.ts (edge). Edge-safe: no imports,
 * no Node APIs.
 *
 * If neither NEXTAUTH_SECRET nor AUTH_SECRET is set we fall back to a fixed
 * dev string so local development still works — but in production that is a
 * real weakness (anyone can mint a valid session JWT), so we log loudly on
 * boot. Set NEXTAUTH_SECRET in every deployed environment.
 */
const fromEnv = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

if (!fromEnv && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.error(
    "[auth] SECURITY: NEXTAUTH_SECRET / AUTH_SECRET is not set in production — " +
      "JWTs are being signed with a public fallback value. Set it now."
  );
}

export const AUTH_SECRET =
  fromEnv || "atomic-pathshala-dev-only-insecure-secret-change-me-in-prod";
