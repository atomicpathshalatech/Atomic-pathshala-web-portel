import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getDppBrand, saveDppBrand } from "@/lib/dpp/brand";
import { normalizeLink } from "@/lib/dpp/cover-html";

export const dynamic = "force-dynamic";

/** Links printed on the DPP PDF front page. GET: anyone who reads DPPs. PATCH: DPP publishers (admins). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_READ);
    return apiSuccess({ brand: await getDppBrand() });
  } catch (error) {
    return handleApiError(error);
  }
}

const link = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || normalizeLink(v) !== "", "Enter a valid link (https://…)")
  .transform((v) => (v ? normalizeLink(v) : ""));

const schema = z.object({
  tagline: z.string().trim().max(80).default(""),
  youtubeUrl: link.default(""),
  telegramUrl: link.default(""),
  websiteUrl: link.default(""),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_PUBLISH);
    const input = schema.parse(await request.json());
    const brand = await saveDppBrand(input, session.user.id);
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "DPP_BRAND_UPDATED", entityType: "DppBrandSettings", entityId: "singleton" },
    });
    return apiSuccess({ brand });
  } catch (error) {
    return handleApiError(error);
  }
}
