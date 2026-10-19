import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { DISPLAY_FORMATS } from "@/lib/pyq/module-service";

/** GET — question modules, newest first. */
export async function GET() {
  try {
    await requireTeam(PERMISSIONS.MODULE_READ);
    const modules = await prisma.questionModule.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { sections: { select: { id: true, title: true, _count: { select: { items: true } } }, orderBy: { order: "asc" } } },
    });
    return apiSuccess({ modules });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  subtitle: z.string().trim().max(200).nullable().optional(),
  subject: z.string().trim().max(40).nullable().optional(),
  chapter: z.string().trim().max(160).nullable().optional(),
  displayFormat: z.enum(DISPLAY_FORMATS as [string, ...string[]]).optional(),
  firstSectionTitle: z.string().trim().max(160).optional(),
});

/** POST — create a module with its first exercise. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireTeam(PERMISSIONS.MODULE_CREATE);
    const body = schema.parse(await request.json());
    const qm = await prisma.questionModule.create({
      data: {
        title: body.title,
        subtitle: body.subtitle ?? null,
        subject: body.subject ?? null,
        chapter: body.chapter ?? null,
        displayFormat: body.displayFormat ?? "ANSWER_KEY_END",
        createdById: userId,
        sections: { create: { title: body.firstSectionTitle || "Exercise 1: PYQs", order: 0 } },
      },
      include: { sections: true },
    });
    return apiSuccess({ module: qm }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
