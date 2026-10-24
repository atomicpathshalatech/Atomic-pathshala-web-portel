import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * A crash in the browser (the error screen caught it) — written to the
 * server log, so a page that fails only on the user's device can be traced.
 * Nothing is stored.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await getServerSession(authOptions).catch(() => null);
    const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
    console.error(
      "[client error]",
      JSON.stringify({
        where: clip(body.where, 40),
        path: clip(body.path, 300),
        message: clip(body.message, 500),
        digest: clip(body.digest, 40),
        stack: clip(body.stack, 2500),
        userId: (session?.user as { id?: string } | undefined)?.id ?? null,
        agent: clip(request.headers.get("user-agent"), 200),
      })
    );
  } catch {
    // never fails the page
  }
  return NextResponse.json({ ok: true });
}
