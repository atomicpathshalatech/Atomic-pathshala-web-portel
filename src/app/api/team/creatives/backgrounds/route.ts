import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const backgrounds = await prisma.creativeBackground.findMany({ orderBy: { createdAt: "asc" } });
    return apiSuccess({ backgrounds });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["SOLID", "GRADIENT", "IMAGE"]),
  color: z.string().trim().optional(),
  angleDeg: z.number().optional(),
  stops: z.array(z.string()).optional(),
  imageUrl: z.string().trim().optional(),
});

/** POST — a custom background: solid color, gradient, or an uploaded image (spec section 5). Images go through the existing POST /api/upload first, same as birthday creatives. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = schema.parse(await req.json());
    const value =
      input.kind === "SOLID"
        ? { kind: "SOLID", color: input.color || "#0f172a" }
        : input.kind === "GRADIENT"
          ? { kind: "GRADIENT", angleDeg: input.angleDeg ?? 135, stops: input.stops?.length ? input.stops : ["#0f172a", "#1e293b"] }
          : { kind: "IMAGE", url: input.imageUrl || "" };

    const background = await prisma.creativeBackground.create({
      data: { name: input.name, kind: input.kind, value, isActive: true },
    });
    return apiSuccess({ background }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
