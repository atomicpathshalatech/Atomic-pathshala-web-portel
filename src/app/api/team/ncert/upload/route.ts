import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadBufferToR2 } from "@/lib/storage/r2-client";
import { extractNcertPagesFromPdf } from "@/lib/ncert/pdf-processor";
import { NCERTLanguage, NCERTDocumentStatus } from "@prisma/client";

export const maxDuration = 60; // Allow up to 60s for PDF extraction

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const academicClassId = formData.get("academicClassId") as string | null;
    const academicSubjectId = formData.get("academicSubjectId") as string | null;
    const academicChapterId = formData.get("academicChapterId") as string | null;
    const academicBookId = formData.get("academicBookId") as string | null;
    const languageRaw = formData.get("language") as string | null;

    if (!file || !academicClassId || !academicSubjectId || !academicChapterId || !languageRaw) {
      return NextResponse.json(
        { error: "Missing required fields: file, academicClassId, academicSubjectId, academicChapterId, language" },
        { status: 400 }
      );
    }

    const language = languageRaw.toUpperCase() as NCERTLanguage;
    if (!Object.values(NCERTLanguage).includes(language)) {
      return NextResponse.json({ error: "Language must be ENGLISH or HINDI" }, { status: 400 });
    }

    // 1. Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 2. Upload to Cloudflare R2
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const r2Key = `ncert/${academicClassId}/${academicSubjectId}/${academicChapterId}/${language.toLowerCase()}_${Date.now()}_${cleanFileName}`;

    let fileUrl = "";
    try {
      const { uploadFile } = await import("@/lib/storage");
      fileUrl = await uploadFile({
        key: r2Key,
        body: fileBuffer,
        contentType: "application/pdf",
      });
    } catch {
      try {
        await uploadBufferToR2({ key: r2Key, buffer: fileBuffer, contentType: "application/pdf" });
        fileUrl = r2Key;
      } catch (uploadErr) {
        console.warn("[NCERT Upload] R2 upload skipped or failed, using key:", uploadErr);
        fileUrl = r2Key;
      }
    }

    // 3. Determine next version for this chapter and language
    const existingDoc = await prisma.ncertDocument.findFirst({
      where: {
        academicChapterId,
        language,
      },
      orderBy: { version: "desc" },
    });

    const nextVersion = existingDoc ? existingDoc.version + 1 : 1;

    // 4. Create document record in PROCESSING state
    const document = await prisma.ncertDocument.create({
      data: {
        academicClassId,
        academicSubjectId,
        academicBookId: academicBookId || null,
        academicChapterId,
        language,
        fileUrl,
        fileName: file.name,
        fileSize: fileBuffer.length,
        version: nextVersion,
        status: NCERTDocumentStatus.PROCESSING,
        totalPages: 0,
        uploadedById: session.user.id,
      },
    });

    // 5. Extract pages asynchronously
    try {
      const extraction = await extractNcertPagesFromPdf(fileBuffer);

      // Create NCERTPage rows
      const pageData = extraction.pages.map((p) => ({
        documentId: document.id,
        pageNumber: p.pageNumber,
        extractedText: p.extractedText,
        extractedElements: p.extractedElements as any,
        processingStatus: "READY",
      }));

      await prisma.ncertPage.createMany({
        data: pageData,
      });

      // Update document to READY & PUBLISHED
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
    } catch (extractErr: any) {
      console.error("[NCERT Upload] Extraction failed:", extractErr);
      await prisma.ncertDocument.update({
        where: { id: document.id },
        data: { status: NCERTDocumentStatus.FAILED },
      });
      return NextResponse.json(
        { error: `PDF extraction failed: ${extractErr.message || extractErr}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[NCERT Upload API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload NCERT document" }, { status: 500 });
  }
}
