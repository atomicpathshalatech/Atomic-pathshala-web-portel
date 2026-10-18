import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import { StorageNotConfiguredError } from "@/lib/storage";
import { moduleFileLink } from "@/lib/module-studio/module-files";

export const dynamic = "force-dynamic";

/**
 * Opens one of a module's PDFs: ?src=original | export:<exportId> | version:<versionId>,
 * &download=1 to save it. Answers with a redirect to a 10-minute signed link, so
 * a copied link stops working and the file's storage address is never shown.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const src = request.nextUrl.searchParams.get("src") || "original";
    const download = request.nextUrl.searchParams.get("download") === "1";

    let stored: string | null = null;
    let name: string | null = null;
    if (src === "original") {
      const m = await prisma.module.findUnique({ where: { id: params.id }, select: { originalFileUrl: true, originalFileName: true } });
      stored = m?.originalFileUrl ?? null;
      name = m?.originalFileName ?? null;
    } else if (src.startsWith("export:")) {
      const e = await prisma.moduleExport.findFirst({
        where: { id: src.slice(7), moduleId: params.id },
        select: { fileUrl: true, fileName: true },
      });
      stored = e?.fileUrl ?? null;
      name = e?.fileName ?? null;
    } else if (src.startsWith("version:")) {
      const v = await prisma.moduleVersion.findFirst({ where: { id: src.slice(8), moduleId: params.id }, select: { snapshot: true } });
      const snap = v?.snapshot as { fileUrl?: unknown } | null;
      stored = typeof snap?.fileUrl === "string" ? snap.fileUrl : null;
      name = stored ? `revision-${src.slice(8)}.pdf` : null;
    } else {
      return apiError("Unknown file.", 400);
    }
    if (!stored) return apiError("File not found", 404);

    const link = await moduleFileLink(stored, { downloadName: download ? name || "module.pdf" : undefined });
    if (!link) return apiError("This file is no longer available in storage.", 410);
    const res = NextResponse.redirect(link, 302);
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
