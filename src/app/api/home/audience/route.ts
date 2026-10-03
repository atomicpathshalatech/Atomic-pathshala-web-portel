import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasAnyBatchAccess } from "@/lib/batch/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which homepage audience the current visitor is in (Website Builder "Kaun
 * dekhe" setting). Only three booleans about the caller themself — nothing else.
 * paid = an active batch enrollment or an active subscription.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return Response.json({ signedIn: false, student: false, paid: false }, { headers });
    const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
    const paid = student ? await hasAnyBatchAccess(userId) : false;
    return Response.json({ signedIn: true, student: !!student, paid }, { headers });
  } catch {
    return Response.json({ signedIn: false, student: false, paid: false }, { headers });
  }
}
