import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrCreateIdCard } from "@/lib/id-card/data";

const schema = z.object({ kind: z.enum(["STUDENT", "TEAM"]), showPhotoPublicly: z.boolean() });

/** PATCH — the owner chooses whether their photo appears on the public QR verification page. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);
    const input = schema.parse(await request.json());

    const card = await getOrCreateIdCard(session.user.id, input.kind);
    if (!card) return apiError("ID cards are not set up yet — please try again later.", 503);
    const updated = await prisma.idCard.update({ where: { id: card.id }, data: { showPhotoPublicly: input.showPhotoPublicly } });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ID_CARD_PHOTO_VISIBILITY",
        entityType: "IdCard",
        entityId: card.id,
        metadata: { showPhotoPublicly: input.showPhotoPublicly },
      },
    });
    return apiSuccess({ showPhotoPublicly: updated.showPhotoPublicly });
  } catch (error) {
    return handleApiError(error);
  }
}
