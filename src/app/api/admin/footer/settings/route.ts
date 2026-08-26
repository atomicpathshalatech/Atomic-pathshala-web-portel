import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { footerSettingsUpdateSchema } from "@/lib/validation/footer";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Singleton row — always exactly one FooterSettings. GET creates it with
 * all-null defaults on first read rather than needing a separate seed
 * step, so the admin UI always has a row to edit. */
async function getOrCreateSettings() {
  const existing = await prisma.footerSettings.findFirst();
  if (existing) return existing;
  return prisma.footerSettings.create({ data: {} });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOOTER_MANAGE);

    const settings = await getOrCreateSettings();
    return apiSuccess({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOOTER_MANAGE);

    const input = footerSettingsUpdateSchema.parse(await request.json());
    const current = await getOrCreateSettings();

    // Prisma's Json fields need the Prisma.JsonNull sentinel to actually
    // clear a value to null — a plain `null` literal isn't assignable to
    // its update-input type, unlike every other nullable field here.
    const data = {
      ...input,
      socialLinks: input.socialLinks === null ? Prisma.JsonNull : input.socialLinks,
      appDownloadLinks: input.appDownloadLinks === null ? Prisma.JsonNull : input.appDownloadLinks,
    };

    const settings = await prisma.footerSettings.update({ where: { id: current.id }, data });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "FOOTER_SETTINGS_UPDATED",
        entityType: "FooterSettings",
        entityId: settings.id,
        metadata: { fields: Object.keys(input) },
      },
    });

    return apiSuccess({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
