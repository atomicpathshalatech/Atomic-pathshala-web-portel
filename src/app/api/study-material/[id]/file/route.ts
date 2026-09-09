import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api/response";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves one study-material PDF by redirecting to a short-lived presigned
 * R2 URL. `?download=1` sets `Content-Disposition: attachment` so the
 * browser saves the real file (no print dialog); otherwise `inline` so the
 * in-app reader can embed it. Download is refused when the teacher turned
 * `allowDownload` off for that resource.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please sign in to open this file.", 401);

    const material = await prisma.studyMaterial.findUnique({
      where: { id: params.id },
      select: { fileUrl: true, fileName: true, isPublished: true, allowDownload: true },
    });
    if (!material || !material.isPublished) return apiError("Study material not found.", 404);

    const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
    if (wantsDownload && !material.allowDownload) {
      return apiError("This resource is view-only — downloading has been disabled.", 403);
    }

    // Light gate: a student must have at least one active enrolment; team
    // members (who have no Student row) are allowed through.
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (student) {
      const enrolled = await prisma.batchEnrollment.count({
        where: { studentId: student.id, status: "ACTIVE" },
      });
      if (enrolled === 0) return apiError("Enrol in a batch to access study material.", 403);
    }

    // `fileUrl` holds the FileAsset id from the upload step.
    const asset = await prisma.fileAsset.findUnique({
      where: { id: material.fileUrl },
      select: { storageKey: true, originalFilename: true, status: true },
    });
    if (!asset || asset.status !== "ACTIVE") return apiError("File is unavailable.", 410);

    const filename = (material.fileName || asset.originalFilename || "study-material.pdf").replace(/"/g, "");
    const disposition = `${wantsDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(filename)}"`;

    const url = await createPresignedDownloadUrl({
      key: asset.storageKey,
      expiresInSeconds: 600,
      contentDisposition: disposition,
    });

    return NextResponse.redirect(url, 302);
  } catch (error) {
    return handleApiError(error);
  }
}
