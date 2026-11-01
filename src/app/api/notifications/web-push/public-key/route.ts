import { apiSuccess } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * The VAPID public key browsers subscribe with (public by design — only the
 * private key, which never leaves the server, can send). Read at runtime so
 * adding the key in Vercel needs no rebuild. null: browser push not set up.
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;
  const ready = Boolean(publicKey && process.env.VAPID_PRIVATE_KEY);
  return apiSuccess({ publicKey: ready ? publicKey : null });
}
