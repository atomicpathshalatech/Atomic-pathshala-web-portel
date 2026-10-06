import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getWhatsAppSettings, updateWhatsAppSettings } from "@/lib/whatsapp/settings";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_READ);

    const settings = await getWhatsAppSettings();
    return apiSuccess({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_MANAGE);

    const body = await req.json();
    const updated = await updateWhatsAppSettings(body, session.user.id);

    return apiSuccess({ settings: updated, message: "Settings updated successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
