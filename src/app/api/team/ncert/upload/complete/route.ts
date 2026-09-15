import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractNcertPagesFromPdf } from "@/lib/ncert/pdf-processor";
import { NCERTLanguage, NCERTDocumentStatus } from "@prisma/client";
import { getR2Client } from "@/lib/storage/r2-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      academicClassId,
      academicSubjectId,
      academicChapterId,
      academicBookId,
      language: rawLang,
      r2Key,
      fileName,
      fileSize,
      totalPages: rawTotalPages,
      pages,
    } = body;

    if (!academicClassId || !academicSubjectId || !academicChapterId || !rawLang || !r2Key) {
      return NextResponse.json(
        { error: "Missing required fields: academicClassId, academicSubjectId, academicChapterId, language, r2Key" },
        { status: 400 }
      );
    }

    const language = String(rawLang).toUpperCase() as NCERTLanguage;
    if (!Object.values(NCERTLanguage).includes(language)) {
      return NextResponse.json({ error: "Language must be ENGLISH or HINDI" }, { status: 400 });
    }

    // Determine next version for chapter and language
    const existingDoc = await prisma.ncertDocument.findFirst({
      where: {
        academicChapterId,
        language,
      },
      orderBy: { version: "desc" },
    });
    const nextVersion = existingDoc ? existingDoc.version + 1 : 1;

    // Create document in READY or PROCESSING
    const calculatedPages = Array.isArray(pages) && pages.length > 0 ? pages.length : (Number(rawTotalPages) || 0);

    const document = await prisma.ncertDocument.create({
      data: {
        academicClassId,
        academicSubjectId,
        academicBookId: academicBookId || null,
        academicChapterId,
        language,
        fileUrl: r2Key,
        fileName: fileName || "ncert-chapter.pdf",
        fileSize: Number(fileSize) || 0,
        version: nextVersion,
        status: calculatedPages > 0 ? NCERTDocumentStatus.READY : NCERTDocumentStatus.PROCESSING,
        totalPages: calculatedPages,
        uploadedById: session.user.id,
      },
    });

    // If client already extracted the pages in browser worker, bulk-insert directly!
    if (Array.isArray(pages) && pages.length > 0) {
      const pageRows = pages.map((p: any) => ({
        documentId: document.id,
        pageNumber: Number(p.pageNumber),
        extractedText: String(p.extractedText || ""),
        extractedElements: Array.isArray(p.extractedElements) ? p.extractedElements : [],
        processingStatus: "READY",
      }));

      await prisma.ncertPage.createMany({
        data: pageRows,
      });

      return NextResponse.json({
        success: true,
        document,
        extractedPages: pageRows.length,
      });
    }

    // Fallback: If pages weren't extracted client-side, retrieve from R2 and process server-side
    try {
      const client = getR2Client();
      const bucket = process.env.R2_BUCKET_NAME || process.env.STORAGE_BUCKET_NAME || "atomic-pathshala";
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key: r2Key,
      });
      const obj = await client.send(cmd);
      if (obj.Body) {
        const streamToBuffer = async (readable: any) => {
          const chunks: any[] = [];
          for await (const chunk of readable) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          }
          return Buffer.concat(chunks);
        };
        const buffer = await streamToBuffer(obj.Body);
        const extraction = await extractNcertPagesFromPdf(buffer);

        const pageRows = extraction.pages.map((p) => ({
          documentId: document.id,
          pageNumber: p.pageNumber,
          extractedText: p.extractedText,
          extractedElements: p.extractedElements as any,
          processingStatus: "READY",
        }));

        await prisma.ncertPage.createMany({
          data: pageRows,
        });

        const updatedDoc = await prisma.ncertDocument.update({
          where: { id: document.id },
          data: {
            totalPages: extraction.totalPages,
            status: NCERTDocumentStatus.READY,
          },
        });

        return NextResponse.json({
          success: true,
          document: updatedDoc,
          extractedPages: extraction.totalPages,
        });
      }
    } catch (extractErr) {
      console.warn("[NCERT Upload Complete] Fallback extraction failed:", extractErr);
    }

    return NextResponse.json({
      success: true,
      document,
      extractedPages: calculatedPages,
    });
  } catch (error: any) {
    console.error("[NCERT Upload Complete API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to finalize NCERT upload" }, { status: 500 });
  }
}
