import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getR2Client, createPresignedDownloadUrl } from "@/lib/storage/r2-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";

/**
 * The chapter PDF for the NCERT reader.
 *
 *   ?as=url  → { url } — a short-lived direct storage link. The reader loads
 *              from it with byte-range requests, so page 1 shows after a few
 *              hundred KB instead of after the whole chapter.
 *   default  → the file streamed through this route, honouring Range — the
 *              fallback when the direct link can't be fetched from the
 *              browser. It used to read the whole file into memory first,
 *              which was slow and could exceed the platform's response limit.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;
    const document = await prisma.ncertDocument.findUnique({
      where: { id: documentId },
      select: { fileUrl: true, fileName: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const wantsUrl = request.nextUrl.searchParams.get("as") === "url";
    const isHttp = document.fileUrl.startsWith("http://") || document.fileUrl.startsWith("https://");
    // Changes when the chapter's file is replaced, so the browser can keep
    // the streamed copy for a long time (a revisit re-downloads nothing) and
    // still never shows an outdated file.
    const version = createHash("sha1").update(document.fileUrl).digest("hex").slice(0, 12);
    const streamUrl = `/api/ncert/document/${documentId}/pdf?v=${version}`;

    // 1. If fileUrl is already a direct public HTTP(S) URL, use it as is
    if (isHttp) {
      return wantsUrl
        ? NextResponse.json({ url: document.fileUrl, streamUrl })
        : NextResponse.redirect(document.fileUrl, 302);
    }

    // 2. Otherwise it is a key in R2 storage
    const r2Key = document.fileUrl.replace(/^\/uploads\//, "").replace(/^\//, "");

    if (wantsUrl) {
      const url = await createPresignedDownloadUrl({
        key: r2Key,
        expiresInSeconds: 3600,
        contentType: "application/pdf",
      });
      return NextResponse.json({ url, streamUrl }, { headers: { "Cache-Control": "private, max-age=1800" } });
    }

    try {
      const client = getR2Client();
      const bucketName =
        process.env.R2_BUCKET_NAME ||
        process.env.STORAGE_BUCKET_NAME ||
        "atomic-pathshala";

      const range = request.headers.get("range") || undefined;
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucketName, Key: r2Key, Range: range })
      );
      if (!response.Body) {
        return NextResponse.json({ error: "File body is empty" }, { status: 404 });
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName || "ncert-chapter.pdf")}"`,
        "Accept-Ranges": "bytes",
        // Versioned URL (?v=): safe to keep a year. Validators let the
        // browser reuse the byte ranges it already has.
        "Cache-Control": request.nextUrl.searchParams.get("v") === version
          ? "public, max-age=31536000, immutable"
          : "public, max-age=86400, stale-while-revalidate=604800",
      };
      if (response.ETag) headers["ETag"] = response.ETag;
      if (response.LastModified) headers["Last-Modified"] = response.LastModified.toUTCString();
      if (response.ContentLength != null) headers["Content-Length"] = String(response.ContentLength);
      if (response.ContentRange) headers["Content-Range"] = response.ContentRange;

      const body = (response.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream();
      return new NextResponse(body, { status: range && response.ContentRange ? 206 : 200, headers });
    } catch (r2Err) {
      console.error("[NCERT PDF Stream] R2 fetch error:", r2Err);
      return NextResponse.json(
        { error: "Could not retrieve PDF from storage" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[NCERT PDF Route] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load PDF" },
      { status: 500 }
    );
  }
}
