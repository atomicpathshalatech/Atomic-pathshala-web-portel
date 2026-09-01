import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { moduleCreateSchema, MODULE_STATUS_VALUES } from "@/lib/validation/module";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, StorageNotConfiguredError } from "@/lib/storage";

const MAX_BYTES = 40 * 1024 * 1024; // 40MB — a multi-chapter coaching module PDF can be large

function generateModuleCode(): string {
  // "MOD-" + base36 timestamp + a short random suffix — unique enough
  // without a check-then-use retry loop (unlike Chapter/DPP/TestSeries
  // codes, this one isn't a human-facing display code students see, just
  // an internal identifier, so collision-avoidance-by-entropy is enough).
  return `MOD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const statusParam = request.nextUrl.searchParams.get("status");
    const status = statusParam && (MODULE_STATUS_VALUES as readonly string[]).includes(statusParam) ? statusParam : null;
    const modules = await prisma.module.findMany({
      where: status ? { status: status as (typeof MODULE_STATUS_VALUES)[number] } : undefined,
      include: {
        brandProfile: { select: { id: true, name: true } },
        _count: { select: { pages: true, exportHistory: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({ modules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_CREATE);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("No PDF was uploaded.", 400);
    if (file.type !== "application/pdf") return apiError("Please upload a PDF file.", 400);
    if (file.size > MAX_BYTES) return apiError("PDF is too large — please keep it under 40MB.", 400);

    const metaRaw = form.get("metadata");
    const input = moduleCreateSchema.parse(metaRaw ? JSON.parse(String(metaRaw)) : {});

    const buffer = Buffer.from(await file.arrayBuffer());
    const code = generateModuleCode();
    const key = `modules/${code}/${file.name}`;
    const url = await uploadFile({ key, body: buffer, contentType: file.type });

    if (input.brandProfileId) {
      const brand = await prisma.brandProfile.findUnique({ where: { id: input.brandProfileId } });
      if (!brand) return apiError("Brand profile not found", 404);
    }

    const created = await prisma.module.create({
      data: {
        code,
        title: input.title,
        subject: input.subject || null,
        class: input.class || null,
        batch: input.batch || null,
        chapter: input.chapter || null,
        facultyName: input.facultyName || null,
        academicYear: input.academicYear || null,
        brandProfileId: input.brandProfileId || null,
        originalFileUrl: url,
        originalFileName: file.name,
        originalFileSize: file.size,
        createdById: session.user.id,
        status: "DRAFT",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MODULE_CREATED",
        entityType: "Module",
        entityId: created.id,
        metadata: { code, title: input.title, fileSize: file.size },
      },
    });

    return apiSuccess({ module: created }, 201);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
