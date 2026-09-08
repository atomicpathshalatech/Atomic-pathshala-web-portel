import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Authoritative Server Time Endpoint
 * Allows clients to synchronize their clock skew without trusting local device time.
 */
export async function GET() {
  const now = new Date();
  return NextResponse.json(
    {
      serverTime: now.toISOString(),
      serverTimeMs: now.getTime(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
