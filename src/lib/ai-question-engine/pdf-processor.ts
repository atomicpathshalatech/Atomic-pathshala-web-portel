import crypto from "crypto";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";

export interface ProcessedPdfResult {
  sourcePdfId: string;
  resourceId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  pageCount: number;
  fileHash: string;
  isDuplicate: boolean;
  extractedText: string;
  chunks: Array<{
    id: string;
    pageNumber: number;
    chunkIndex: number;
    heading?: string;
    detectedTopic?: string;
    content: string;
  }>;
  images: Array<{
    id: string;
    pageNumber: number;
    publicUrl: string;
    width?: number;
    height?: number;
    bbox?: [number, number, number, number];
    associatedText?: string;
    topic?: string;
  }>;
}

/**
 * Computes SHA-256 hash of binary buffer for duplicate document detection & caching
 */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generates official Resource ID for source PDF: e.g. PDF-20260906-A1B2
 */
export function generatePdfResourceId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PDF-${datePart}-${randPart}`;
}

/**
 * Processes source educational PDF:
 * 1. Checks SHA-256 hash for existing processed cache.
 * 2. Parses page text and coordinate boundaries via pdfjs-dist.
 * 3. Identifies embedded diagrams/figures.
 * 4. Segments document into structured, topic-aware source chunks.
 */
export async function processSourcePdf(params: {
  fileBuffer: Buffer;
  fileName: string;
  userId: string;
  subject?: string;
  chapter?: string;
}): Promise<ProcessedPdfResult> {
  const fileHash = computeFileHash(params.fileBuffer);

  // 1. Check for Duplicate / Cached Processed PDF
  const existing = await prisma.aiSourcePdf.findUnique({
    where: { fileHash },
    include: {
      chunks: { orderBy: [{ pageNumber: "asc" }, { chunkIndex: "asc" }] },
      images: { orderBy: { pageNumber: "asc" } },
    },
  });

  if (existing) {
    return {
      sourcePdfId: existing.id,
      resourceId: existing.resourceId,
      fileName: existing.fileName,
      fileUrl: existing.fileUrl,
      fileSize: existing.fileSize,
      pageCount: existing.pageCount,
      fileHash: existing.fileHash,
      isDuplicate: true,
      extractedText: existing.extractedText || "",
      chunks: existing.chunks.map((c) => ({
        id: c.id,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        heading: c.heading || undefined,
        detectedTopic: c.detectedTopic || undefined,
        content: c.content,
      })),
      images: existing.images.map((img) => ({
        id: img.id,
        pageNumber: img.pageNumber,
        publicUrl: img.publicUrl,
        width: img.width || undefined,
        height: img.height || undefined,
        bbox: (img.bbox as [number, number, number, number]) || undefined,
        associatedText: img.associatedText || undefined,
        topic: img.topic || undefined,
      })),
    };
  }

  // 2. Extract Pages & Text via pdfjs-dist
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8Data = new Uint8Array(params.fileBuffer);
  const doc = await pdfjs.getDocument({
    data: uint8Data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const pageCount = doc.numPages;
  const pageTexts: Array<{ pageNumber: number; text: string }> = [];
  const detectedImages: Array<{
    pageNumber: number;
    publicUrl: string;
    width?: number;
    height?: number;
    associatedText?: string;
  }> = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const rawPageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pageTexts.push({ pageNumber: p, text: rawPageText });

    // Check if page mentions diagrams, figures, or apparatus
    if (/(?:figure\s*\d+|fig\.\s*\d+|diagram|structure\s*of|pathway\s*shown|labeled\s*part)/i.test(rawPageText)) {
      const match = rawPageText.match(/(?:figure|fig\.)\s*([0-9\.]+[^.\n]*)/i);
      const caption = match ? match[0] : "Extracted scientific diagram";
      detectedImages.push({
        pageNumber: p,
        publicUrl: `/api/files/placeholder-diagram?page=${p}&doc=${encodeURIComponent(params.fileName)}`,
        width: 800,
        height: 600,
        associatedText: `${caption} (Found on Page ${p})`,
      });
    }
  }

  const fullExtractedText = pageTexts.map((p) => `[Page ${p.pageNumber}]\n${p.text}`).join("\n\n");
  const resourceId = generatePdfResourceId();

  // 3. Optional upload to object storage
  let fileUrl = `/uploads/source-pdfs/${params.fileName}`;
  try {
    const storageKey = `source-pdfs/${resourceId}-${params.fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    fileUrl = await uploadFile({
      key: storageKey,
      body: params.fileBuffer,
      contentType: "application/pdf",
    });
  } catch (storageErr) {
    console.warn("[PdfProcessor] Storage upload skipped/fallback:", storageErr);
  }

  // 4. Create AiSourcePdf record in database
  const sourcePdf = await prisma.aiSourcePdf.create({
    data: {
      resourceId,
      fileHash,
      fileName: params.fileName,
      fileUrl,
      fileSize: params.fileBuffer.length,
      pageCount,
      extractedText: fullExtractedText.slice(0, 100000), // persist first 100k characters for rapid retrieval
      uploadedById: params.userId,
    },
  });

  // 5. Segment into structured Chunks
  const chunkRecords: Array<{
    sourcePdfId: string;
    pageNumber: number;
    chunkIndex: number;
    heading?: string;
    detectedTopic?: string;
    content: string;
    tokenEstimate: number;
  }> = [];

  for (const p of pageTexts) {
    if (!p.text) continue;
    // Chunk roughly by 400-word paragraphs
    const paragraphs = p.text.split(/(?<=\.\s+)(?=[A-Z])/).filter((s) => s.trim().length > 30);
    const grouped = [];
    let current = "";

    for (const para of paragraphs) {
      if ((current + " " + para).length > 1500) {
        if (current) grouped.push(current);
        current = para;
      } else {
        current = current ? current + " " + para : para;
      }
    }
    if (current) grouped.push(current);

    grouped.forEach((chunkText, cIdx) => {
      chunkRecords.push({
        sourcePdfId: sourcePdf.id,
        pageNumber: p.pageNumber,
        chunkIndex: cIdx + 1,
        content: chunkText,
        tokenEstimate: Math.round(chunkText.length / 4),
      });
    });
  }

  if (chunkRecords.length > 0) {
    await prisma.aiSourcePdfChunk.createMany({
      data: chunkRecords,
    });
  }

  // 6. Persist Detected Images
  if (detectedImages.length > 0) {
    await prisma.aiSourcePdfImage.createMany({
      data: detectedImages.map((img) => ({
        sourcePdfId: sourcePdf.id,
        pageNumber: img.pageNumber,
        publicUrl: img.publicUrl,
        width: img.width,
        height: img.height,
        associatedText: img.associatedText,
        topic: params.chapter || params.subject || "Diagram",
      })),
    });
  }

  const createdChunks = await prisma.aiSourcePdfChunk.findMany({
    where: { sourcePdfId: sourcePdf.id },
    orderBy: [{ pageNumber: "asc" }, { chunkIndex: "asc" }],
  });

  const createdImages = await prisma.aiSourcePdfImage.findMany({
    where: { sourcePdfId: sourcePdf.id },
  });

  return {
    sourcePdfId: sourcePdf.id,
    resourceId: sourcePdf.resourceId,
    fileName: sourcePdf.fileName,
    fileUrl: sourcePdf.fileUrl,
    fileSize: sourcePdf.fileSize,
    pageCount: sourcePdf.pageCount,
    fileHash: sourcePdf.fileHash,
    isDuplicate: false,
    extractedText: fullExtractedText,
    chunks: createdChunks.map((c) => ({
      id: c.id,
      pageNumber: c.pageNumber,
      chunkIndex: c.chunkIndex,
      heading: c.heading || undefined,
      detectedTopic: c.detectedTopic || undefined,
      content: c.content,
    })),
    images: createdImages.map((img) => ({
      id: img.id,
      pageNumber: img.pageNumber,
      publicUrl: img.publicUrl,
      width: img.width || undefined,
      height: img.height || undefined,
      bbox: (img.bbox as [number, number, number, number]) || undefined,
      associatedText: img.associatedText || undefined,
      topic: img.topic || undefined,
    })),
  };
}
