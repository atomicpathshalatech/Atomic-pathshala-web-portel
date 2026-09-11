import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { inspectPng } from "@/lib/creative/png-inspect";
import { regenerateCreativeAwaited } from "@/lib/creative/engine";

export const runtime = "nodejs";

const schema = z.object({ url: z.string().url() });

/**
 * PATCH — saves the educator's Creative PNG / cutout photo (spec section
 * 1B). The file itself is uploaded through the existing, unmodified
 * POST /api/upload first; this endpoint takes the resulting URL, re-reads
 * the bytes server-side to get AUTHORITATIVE width/height/alpha (never
 * trusts client-reported metadata), bumps creativeAssetVersion, and
 * regenerates every creative this teacher is already featured on — so an
 * educator replacing their cutout sees existing batch/chapter/lecture
 * creatives pick up the new image immediately (spec section 14), not on
 * some later, unrelated regeneration.
 *
 * Deliberately a separate endpoint from PATCH /api/team/profile — that one
 * is subjects/bio (teacherSelfUpdateSchema); this asset upload has its own
 * re-fetch + regenerate side effects that don't belong in a generic PATCH.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return apiError("No teacher profile for this account", 404);

    const { url } = schema.parse(await req.json());

    const fetched = await fetch(url).catch(() => null);
    if (!fetched || !fetched.ok) {
      return apiError("Could not read the uploaded file back from storage.", 502);
    }
    const buf = Buffer.from(await fetched.arrayBuffer());
    const info = inspectPng(buf);
    if (!info.isPng) {
      return apiError("That file isn't a valid PNG. Upload a PNG cutout image.", 422);
    }

    const updated = await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        creativePngUrl: url,
        creativePngWidth: info.width,
        creativePngHeight: info.height,
        creativePngHasAlpha: info.hasAlpha,
        creativePngSizeBytes: buf.length,
        creativePngUpdatedAt: new Date(),
        creativeAssetVersion: { increment: 1 },
      },
    });

    // Regenerate everything this teacher already appears on. Bounded and
    // awaited — see regenerateCreativeAwaited's own doc on why fire-and-
    // forget isn't safe here.
    const [batches, testSeriesRows, lectures] = await Promise.all([
      prisma.batchTeacher.findMany({ where: { teacherId: teacher.id }, select: { batchId: true } }),
      prisma.testSeriesTeacher.findMany({ where: { teacherId: teacher.id }, select: { testSeriesId: true } }),
      prisma.lecture.findMany({ where: { teacherId: teacher.id }, select: { id: true, chapterId: true } }),
    ]);
    const chapterIds = new Set(lectures.map((l) => l.chapterId));

    await Promise.all([
      ...batches.map((b) => regenerateCreativeAwaited("BATCH", b.batchId)),
      ...testSeriesRows.map((t) => regenerateCreativeAwaited("TEST_SERIES", t.testSeriesId)),
      ...lectures.map((l) => regenerateCreativeAwaited("LECTURE", l.id)),
      ...[...chapterIds].map((id) => regenerateCreativeAwaited("CHAPTER", id)),
    ]);

    return apiSuccess({
      creativePngUrl: updated.creativePngUrl,
      creativePngHasAlpha: updated.creativePngHasAlpha,
      creativePngWidth: updated.creativePngWidth,
      creativePngHeight: updated.creativePngHeight,
      regenerated: {
        batches: batches.length,
        testSeries: testSeriesRows.length,
        lectures: lectures.length,
        chapters: chapterIds.size,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
