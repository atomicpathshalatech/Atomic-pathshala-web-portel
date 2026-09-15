import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getR2Client } from "@/lib/storage/r2-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;
    const document = await prisma.ncertDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // 1. If fileUrl is already a direct public HTTP(S) URL, redirect to it
    if (document.fileUrl.startsWith("http://") || document.fileUrl.startsWith("https://")) {
      return NextResponse.redirect(document.fileUrl, 302);
    }

    // 2. Otherwise retrieve from R2 storage using the key
    const r2Key = document.fileUrl.replace(/^\/uploads\//, "").replace(/^\//, "");
    try {
      const client = getR2Client();
      const bucketName =
        process.env.R2_BUCKET_NAME ||
        process.env.STORAGE_BUCKET_NAME ||
        "atomic-pathshala";

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: r2Key,
      });

      const response = await client.send(command);
      if (!response.Body) {
        return NextResponse.json({ error: "File body is empty" }, { status: 404 });
      }

      const stream = response.Body as any;
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${document.fileName || "ncert-chapter.pdf"}"`,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
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
