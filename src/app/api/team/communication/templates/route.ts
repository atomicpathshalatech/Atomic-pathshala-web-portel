import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { extractTemplateVariables } from "@/lib/email/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = [
  "CREDENTIALS",
  "PASSWORD_RESET",
  "ENROLLMENT",
  "INVITATION",
  "BIRTHDAY",
  "PROMOTIONAL",
  "ANNOUNCEMENT",
  "OTHER",
] as const;

/** GET — every template (Admin Email Template Manager, spec section 7). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const templates = await prisma.emailTemplate.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
    return apiSuccess({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  key: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores only."),
  name: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORIES),
  subject: z.string().trim().min(2).max(200),
  bodyHtml: z.string().trim().min(10),
});

/** POST — create a new custom template (spec: Admin can create templates). */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = createSchema.parse(await req.json());
    const existing = await prisma.emailTemplate.findUnique({ where: { key: input.key } });
    if (existing) return apiError(`A template with key "${input.key}" already exists.`, 409);

    const variables = [...new Set([...extractTemplateVariables(input.subject), ...extractTemplateVariables(input.bodyHtml)])];

    const template = await prisma.emailTemplate.create({
      data: { ...input, variables, isSystem: false, createdById: session.user.id },
    });
    return apiSuccess({ template }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
