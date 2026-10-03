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

    const code = generateModuleCode();
    let input: ReturnType<typeof moduleCreateSchema.parse>;
    let url: string;
    let fileName: string;
    let fileSize: number;

    if (request.headers.get("content-type")?.includes("application/json")) {
      // The browser already uploaded the PDF straight to storage
      // (/api/files/upload-url → R2 → /api/files/complete) — large PDFs
      // can't pass through a Vercel function (≈4.5MB request limit).
      // Only a file this same user uploaded, as a public PDF, is accepted.
      const body = (await request.json()) as { fileAssetId?: unknown; fileSize?: unknown; metadata?: unknown };
      if (typeof body.fileAssetId !== "string") return apiError("No PDF was uploaded.", 400);
      const asset = await prisma.fileAsset.findUnique({ where: { id: body.fileAssetId } });
      if (!asset || asset.ownerId !== session.user.id || asset.status !== "ACTIVE" || asset.visibility !== "PUBLIC") {
        return apiError("Uploaded PDF not found. Please upload it again.", 404);
      }
      if (asset.mimeType !== "application/pdf") return apiError("Please upload a PDF file.", 400);
      fileSize = Number(asset.sizeBytes) || (typeof body.fileSize === "number" ? body.fileSize : 0);
      if (fileSize > MAX_BYTES) return apiError("PDF is too large — please keep it under 40MB.", 400);
      const publicBase = process.env.R2_PUBLIC_BASE_URL || process.env.STORAGE_PUBLIC_URL;
      if (!publicBase) return apiError("File storage isn't configured for public files.", 503);
      url = `${publicBase.replace(/\/$/, "")}/${asset.storageKey}`;
      fileName = asset.originalFilename;
      input = moduleCreateSchema.parse(body.metadata ?? {});
    } else {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return apiError("No PDF was uploaded.", 400);
      if (file.type !== "application/pdf") return apiError("Please upload a PDF file.", 400);
      if (file.size > MAX_BYTES) return apiError("PDF is too large — please keep it under 40MB.", 400);

      const metaRaw = form.get("metadata");
      input = moduleCreateSchema.parse(metaRaw ? JSON.parse(String(metaRaw)) : {});

      const buffer = Buffer.from(await file.arrayBuffer());
      const key = `modules/${code}/${file.name}`;
      url = await uploadFile({ key, body: buffer, contentType: file.type });
      fileName = file.name;
      fileSize = file.size;
    }

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
        originalFileName: fileName,
        originalFileSize: fileSize,
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
        metadata: { code, title: input.title, fileSize },
      },
    });

    return apiSuccess({ module: created }, 201);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
