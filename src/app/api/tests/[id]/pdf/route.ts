import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api/response";
import { fetchCanonicalTestData, generateTestPaperHtml } from "@/lib/pdf/test-export-engine";
import { renderBookletPdf } from "@/lib/pdf/html-to-pdf";
import { inlineBookletImages } from "@/lib/pdf/inline-images";
import { studentPaperBlockReason } from "@/lib/tests/paper-access";
import { createPresignedDownloadUrl, getR2ObjectMetadata, uploadBufferToR2 } from "@/lib/storage/r2-client";
import { brandLogoDataUrl } from "@/lib/pdf/brand-logo";
import { buildDppCoverForTestCode } from "@/lib/dpp/cover";

export const runtime = "nodejs";

export const maxDuration = 60;

/**
 * Direct PDF download of a test's question paper or solutions — no print
 * dialog. The PDF is rendered once per version of the booklet (hash of its
 * HTML) and kept in storage, so later downloads are instant and the file is
 * small (vector text, not page images).
 *
 * GET /api/tests/:id/pdf?type=questions|solutions
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in to download this test.", 401);

    const type = request.nextUrl.searchParams.get("type") === "solutions" ? "solutions" : "questions";
    const withSolution = type === "solutions";
    const blocked = await studentPaperBlockReason(session.user.id, (session.user as any)?.role, params.id, withSolution);
    if (blocked) return apiError(blocked, 403);

    const testData = await fetchCanonicalTestData(params.id);
    if (!testData) return apiError("Test not found", 404);

    const logoUrl = brandLogoDataUrl();
    const html = generateTestPaperHtml(testData, {
      withSolution,
      brandName: "ATOMIC PATHSHALA",
      watermarkText: "ATOMIC PATHSHALA",
      testPattern: testData.examType,
      autoPrint: false,
      logoUrl,
      // A DPP opens with its front page (details, YouTube / Telegram QR, website link).
      dppCoverHtml: await buildDppCoverForTestCode(testData.code, { logoUrl, solutions: withSolution }),
    });

    // "img2": PDFs made before figures were embedded printed them broken — make those again.
    const version = createHash("sha1").update("img2").update(html).digest("hex").slice(0, 16);
    const key = `test-pdfs/${params.id}/${type}-${version}.pdf`;
    const date = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
      .format(testData.createdAt || new Date())
      .replace(/[/\\?%*:|"<>]/g, "-");
    const name = (testData.name || "Test").replace(/[/\\?%*:|"<>]/g, "_").trim();
    // With solutions it is the complete paper (questions, answer key, solutions) — one file.
    const filename = `${name} - ${date} - ATOMIC PATHSHALA.pdf`;

    const cached = await getR2ObjectMetadata(key).catch(() => ({ exists: false }));
    if (!cached.exists) {
      const pdf = await renderBookletPdf(
        await inlineBookletImages(html, { origin: request.nextUrl.origin, cookie: request.headers.get("cookie") })
      );
      await uploadBufferToR2({ key, buffer: pdf, contentType: "application/pdf" });
    }

    const url = await createPresignedDownloadUrl({
      key,
      expiresInSeconds: 600,
      contentType: "application/pdf",
      contentDisposition: `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("[test_pdf_error]", error);
    return apiError("Could not prepare the PDF right now. Please try again in a minute.", 500);
  }
}
