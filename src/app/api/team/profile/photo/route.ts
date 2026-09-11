import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

const schema = z.object({ url: z.string().url() });

/**
 * PATCH — the educator's NORMAL profile photo (spec section 1A). Plain
 * User.photoUrl — the same field every avatar in the app already reads —
 * kept completely separate from the Creative PNG (creative-png/route.ts).
 * No transparency check, no regeneration side effects: this one just
 * updates the avatar.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const { url } = schema.parse(await req.json());
    const user = await prisma.user.update({ where: { id: session.user.id }, data: { photoUrl: url } });

    return apiSuccess({ photoUrl: user.photoUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
