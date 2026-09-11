import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { extractTemplateVariables, renderTemplate } from "@/lib/email/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  subject: z.string().trim().min(2).max(200).optional(),
  bodyHtml: z.string().trim().min(10).optional(),
  isActive: z.boolean().optional(),
});

/** PATCH — edit wording / activate-deactivate. `key`/`category` are immutable (system triggers look templates up by key). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const existing = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Template not found.", 404);

    const input = patchSchema.parse(await req.json());
    const nextSubject = input.subject ?? existing.subject;
    const nextBody = input.bodyHtml ?? existing.bodyHtml;
    const variables = [...new Set([...extractTemplateVariables(nextSubject), ...extractTemplateVariables(nextBody)])];

    const template = await prisma.emailTemplate.update({
      where: { id: params.id },
      data: { ...input, variables },
    });
    return apiSuccess({ template });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — only non-system (custom) templates can be deleted outright; a seeded default is deactivated instead (spec: "delete/archive where safe" — deleting a system template would break the trigger that looks it up by key, lib/email/templates.ts falls back to the code default either way, but archiving keeps the DB and the code default in sync). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const existing = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Template not found.", 404);

    if (existing.isSystem) {
      await prisma.emailTemplate.update({ where: { id: params.id }, data: { isActive: false } });
      return apiSuccess({ archived: true, deleted: false });
    }

    await prisma.emailTemplate.delete({ where: { id: params.id } });
    return apiSuccess({ archived: false, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — preview with sample values, or duplicate (?action=duplicate). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const existing = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Template not found.", 404);

    const action = new URL(req.url).searchParams.get("action");

    if (action === "duplicate") {
      let key = `${existing.key}_copy`;
      let n = 1;
      while (await prisma.emailTemplate.findUnique({ where: { key } })) {
        n++;
        key = `${existing.key}_copy${n}`;
      }
      const copy = await prisma.emailTemplate.create({
        data: {
          key,
          name: `${existing.name} (Copy)`,
          category: existing.category,
          subject: existing.subject,
          bodyHtml: existing.bodyHtml,
          variables: existing.variables,
          isSystem: false,
          isActive: false, // a duplicate starts inactive so it can't silently start sending until reviewed
          createdById: session.user.id,
        },
      });
      return apiSuccess({ template: copy }, 201);
    }

    // Preview: fill every declared variable with a readable sample value.
    const sample = Object.fromEntries(existing.variables.map((v) => [v, `[${v}]`]));
    return apiSuccess({
      subject: renderTemplate(existing.subject, sample),
      html: renderTemplate(existing.bodyHtml, sample),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
