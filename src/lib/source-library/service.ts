/**
 * ATOMIC PATHSHALA — SOURCE MATERIAL LIBRARY SERVICE
 * Persistent repository for NCERT, Allen Modules, PYQs, and faculty notes.
 * Hierarchy: Subject -> Class -> Book/Module -> Chapter -> Topic -> Page/Region
 */

import { prisma } from "@/lib/prisma";

export interface CreateSourceMaterialInput {
  title: string;
  category:
    | "NCERT_TEXTBOOK"
    | "NCERT_EXEMPLAR"
    | "ALLEN_MODULE"
    | "PREVIOUS_YEAR_QUESTIONS"
    | "REFERENCE_BOOK"
    | "FACULTY_NOTES"
    | "QUESTION_BANK"
    | "OFFICIAL_ANSWER_KEY"
    | "OTHER";
  subject: "PHYSICS" | "CHEMISTRY" | "BOTANY" | "ZOOLOGY";
  classLevel: "CLASS_11" | "CLASS_12" | "DROPPER";
  bookName?: string;
  chapterNumber?: number;
  chapterName?: string;
  topicName?: string;
  fileUrl: string;
  storageKey?: string;
  fileType?: "PDF" | "IMAGE" | "SCANNED_PDF";
  fileSize?: number;
  pageCount?: number;
  editionYear?: string;
  extractedText?: string;
  metadata?: Record<string, any>;
  uploadedById?: string;
}

export interface CreateSourceChunkInput {
  sourceMaterialId: string;
  pageNumber: number;
  chunkIndex: number;
  topic?: string;
  subtopic?: string;
  content: string;
  bbox?: { x1: number; y1: number; x2: number; y2: number };
  figureUrl?: string;
  tokenEstimate?: number;
}

export async function createSourceMaterial(input: CreateSourceMaterialInput) {
  return prisma.sourceMaterial.create({
    data: {
      title: input.title,
      category: input.category,
      subject: input.subject,
      classLevel: input.classLevel,
      bookName: input.bookName,
      chapterNumber: input.chapterNumber,
      chapterName: input.chapterName,
      topicName: input.topicName,
      fileUrl: input.fileUrl,
      storageKey: input.storageKey,
      fileType: input.fileType || "PDF",
      fileSize: input.fileSize || 0,
      pageCount: input.pageCount || 0,
      editionYear: input.editionYear,
      extractedText: input.extractedText,
      metadata: input.metadata || {},
      uploadedById: input.uploadedById,
    },
    include: {
      chunks: true,
    },
  });
}

export async function addChunksToSourceMaterial(chunks: CreateSourceChunkInput[]) {
  if (chunks.length === 0) return { count: 0 };
  return prisma.sourceMaterialChunk.createMany({
    data: chunks.map((c) => ({
      sourceMaterialId: c.sourceMaterialId,
      pageNumber: c.pageNumber,
      chunkIndex: c.chunkIndex,
      topic: c.topic,
      subtopic: c.subtopic,
      content: c.content,
      bbox: c.bbox as any,
      figureUrl: c.figureUrl,
      tokenEstimate: c.tokenEstimate || Math.ceil(c.content.length / 4),
    })),
  });
}

export async function querySourceMaterials(filter: {
  subject?: string;
  classLevel?: string;
  category?: string;
  chapterName?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (filter.subject) where.subject = filter.subject;
  if (filter.classLevel) where.classLevel = filter.classLevel;
  if (filter.category) where.category = filter.category;
  if (filter.chapterName) where.chapterName = { contains: filter.chapterName, mode: "insensitive" };
  if (filter.search) {
    where.OR = [
      { title: { contains: filter.search, mode: "insensitive" } },
      { chapterName: { contains: filter.search, mode: "insensitive" } },
      { topicName: { contains: filter.search, mode: "insensitive" } },
      { extractedText: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.sourceMaterial.count({ where }),
    prisma.sourceMaterial.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { chunks: true } },
      },
    }),
  ]);

  return { total, page, limit, items };
}

export async function retrieveSourceContext(params: {
  subject: string;
  chapter: string;
  topic?: string;
  sourceMaterialId?: string;
  maxTokens?: number;
}): Promise<string> {
  const where: any = {};
  if (params.sourceMaterialId) {
    where.sourceMaterialId = params.sourceMaterialId;
  } else {
    where.sourceMaterial = {
      subject: params.subject,
      chapterName: { contains: params.chapter, mode: "insensitive" },
    };
  }

  if (params.topic) {
    where.OR = [
      { topic: { contains: params.topic, mode: "insensitive" } },
      { content: { contains: params.topic, mode: "insensitive" } },
    ];
  }

  const chunks = await prisma.sourceMaterialChunk.findMany({
    where,
    take: 5,
    orderBy: { pageNumber: "asc" },
    include: {
      sourceMaterial: {
        select: { title: true, category: true, bookName: true },
      },
    },
  });

  if (chunks.length === 0) {
    return "";
  }

  return chunks
    .map(
      (c) =>
        `[Source: ${c.sourceMaterial.title} (${c.sourceMaterial.category}) | Page ${c.pageNumber} | Topic: ${c.topic || "N/A"}]\n${c.content}`
    )
    .join("\n\n---\n\n");
}
