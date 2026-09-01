import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { moduleExportSchema, moduleElementSchema } from "@/lib/validation/module";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, StorageNotConfiguredError } from "@/lib/storage";
import { generateModulePdf } from "@/lib/module-studio/pdf-export";
import { z } from "zod";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const exports = await prisma.moduleExport.findMany({
      where: { moduleId: params.id },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({ exports });
  } catch (error) {
    return handleApiError(error);
  }
}

const versionSnapshotSchema = z.array(z.object({ pageNumber: z.number(), elements: z.array(moduleElementSchema) }));

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const moduleRow = await prisma.module.findUnique({
      where: { id: params.id },
      include: { brandProfile: true, pages: { orderBy: { pageNumber: "asc" } } },
    });
    if (!moduleRow) return apiError("Module not found", 404);
    if (moduleRow.pages.length === 0) return apiError("This module has no processed pages to export yet.", 409);

    const input = moduleExportSchema.parse(await request.json().catch(() => ({})));

    let exportPages: { pageNumber: number; elements: z.infer<typeof moduleElementSchema>[] }[];
    if (input.versionId) {
      const version = await prisma.moduleVersion.findFirst({ where: { id: input.versionId, moduleId: params.id } });
      if (!version) return apiError("Version not found", 404);
      exportPages = versionSnapshotSchema.parse(version.snapshot);
    } else {
      exportPages = moduleRow.pages.map((p) => ({
        pageNumber: p.pageNumber,
        elements: z.array(moduleElementSchema).parse(p.elements),
      }));
    }

    const pdfBuffer = await generateModulePdf({
      moduleTitle: moduleRow.title,
      pages: exportPages,
      brand: moduleRow.brandProfile
        ? {
            name: moduleRow.brandProfile.name,
            logoUrl: moduleRow.brandProfile.logoUrl,
            primaryColor: moduleRow.brandProfile.primaryColor,
            tagline: moduleRow.brandProfile.tagline,
            websiteUrl: moduleRow.brandProfile.websiteUrl,
          }
        : null,
      includeWatermark: input.includedWatermark ?? false,
    });

    const fileName = `${moduleRow.code}-${Date.now()}.pdf`;
    const key = `module-exports/${moduleRow.code}/${fileName}`;
    const fileUrl = await uploadFile({ key, body: pdfBuffer, contentType: "application/pdf" });

    const exportRecord = await prisma.moduleExport.create({
      data: {
        moduleId: params.id,
        versionId: input.versionId || null,
        fileUrl,
        fileName,
        fileSize: pdfBuffer.length,
        includedFrontPage: input.includedFrontPage ?? true,
        includedWatermark: input.includedWatermark ?? false,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MODULE_EXPORTED",
        entityType: "Module",
        entityId: params.id,
        metadata: { exportId: exportRecord.id, fileSize: pdfBuffer.length },
      },
    });

    return apiSuccess({ export: exportRecord }, 201);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
