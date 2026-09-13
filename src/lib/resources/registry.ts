import { prisma } from "@/lib/db";
import { customAlphabet } from "nanoid";

// Generate numeric IDs like TST-83921, DPP-48192, LEC-19284, QST-58192, PDF-38192
const numericId = customAlphabet("1234567890", 6);

export type ResourceType = "LECTURE" | "VIDEO" | "TEST" | "DPP" | "QUESTION" | "PDF" | "MODULE";

export const RESOURCE_PREFIX_MAP: Record<ResourceType, string> = {
  LECTURE: "LEC",
  VIDEO: "VID",
  TEST: "TST",
  DPP: "DPP",
  QUESTION: "QST",
  PDF: "PDF",
  MODULE: "MOD",
};

/**
 * Generates a unique, non-reusable permanent Resource ID.
 * Even if a resource is deleted, its Resource ID remains recorded and will NEVER be recycled.
 */
export async function generateUniqueResourceId(type: ResourceType): Promise<string> {
  const prefix = RESOURCE_PREFIX_MAP[type] || "RES";

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${prefix}-${numericId()}`;
    const exists = await prisma.platformResource.findUnique({
      where: { resourceId: candidate },
    });
    if (!exists) {
      return candidate;
    }
  }

  // Fallback with timestamp suffix if collisions happen
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

/**
 * Registers a resource in the centralized PlatformResource registry.
 */
export async function registerPlatformResource(params: {
  resourceId?: string;
  type: ResourceType;
  title: string;
  subject?: string | null;
  targetId: string;
  downloadUrl?: string | null;
  format?: string | null;
  sizeBytes?: number | null;
  createdById?: string | null;
}) {
  const resourceId = params.resourceId || (await generateUniqueResourceId(params.type));

  return prisma.platformResource.upsert({
    where: { resourceId },
    create: {
      resourceId,
      type: params.type,
      title: params.title,
      subject: params.subject || null,
      targetId: params.targetId,
      downloadUrl: params.downloadUrl || null,
      format: params.format || null,
      sizeBytes: params.sizeBytes || null,
      createdById: params.createdById || null,
    },
    update: {
      title: params.title,
      subject: params.subject || null,
      downloadUrl: params.downloadUrl || null,
      format: params.format || null,
    },
  });
}

/**
 * Resolves any Resource ID across the entire ecosystem.
 * Dynamically resolves target model details if not yet explicitly seeded in registry.
 */
export async function lookupPlatformResource(resourceId: string) {
  const cleanId = resourceId.trim().toUpperCase();

  // 1. Check PlatformResource registry
  const resource = await prisma.platformResource.findUnique({
    where: { resourceId: cleanId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      deletedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (resource) {
    return resource;
  }

  // 2. Direct code match, tried before any prefix-based guess. Test/Dpp/
  // Question codes are assigned by several different generators over this
  // platform's history (generateQuestionId()'s plain 8-digit strings,
  // "TEST_0001", "AP0001", plus one-off imported/seeded codes like "10001"
  // or "PHY-001") and not all of them start with the prefix the branches
  // below assume — a real code that doesn't match any of those prefixes
  // used to fall straight through to `return null`, so deleting that
  // resource always 404'd as "not found" no matter how correctly the user
  // typed its ID. Each `code`/`questionCode` column is unique, so this is
  // an unambiguous direct hit whenever one exists.
  const [testByCode, dppByCode, questionByCode] = await Promise.all([
    prisma.test.findUnique({
      where: { code: cleanId },
      include: { createdBy: { select: { id: true, name: true, email: true } }, chapter: true },
    }),
    prisma.dpp.findUnique({
      where: { code: cleanId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    }),
    prisma.question.findUnique({
      where: { questionCode: cleanId },
      include: { createdBy: { select: { id: true, name: true, email: true } }, translations: true },
    }),
  ]);

  if (testByCode) {
    return prisma.platformResource.create({
      data: {
        resourceId: `TST-${testByCode.id.slice(0, 6).toUpperCase()}`,
        type: "TEST",
        title: testByCode.name,
        subject: testByCode.chapter?.title || "Assessment",
        targetId: testByCode.id,
        downloadUrl: `/api/pdf/test/${testByCode.id}`,
        format: "PDF",
        createdById: testByCode.createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        deletedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  if (dppByCode) {
    return prisma.platformResource.create({
      data: {
        resourceId: `DPP-${dppByCode.id.slice(0, 6).toUpperCase()}`,
        type: "DPP",
        title: dppByCode.name,
        subject: dppByCode.chapter || dppByCode.subject || "Daily Practice Problem",
        targetId: dppByCode.id,
        downloadUrl: `/api/pdf/dpp/${dppByCode.id}`,
        format: "PDF",
        createdById: dppByCode.createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        deletedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  if (questionByCode) {
    return prisma.platformResource.create({
      data: {
        resourceId: `QST-${questionByCode.id.slice(0, 6).toUpperCase()}`,
        type: "QUESTION",
        title: questionByCode.translations[0]?.statement.slice(0, 60) || "Question Entry",
        subject: questionByCode.subject,
        targetId: questionByCode.id,
        format: "JSON",
        createdById: questionByCode.createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        deletedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // 3. Dynamic resolution for existing legacy/pre-existing resources
  if (cleanId.startsWith("TST-") || cleanId.startsWith("TEST_") || cleanId.length === 25) {
    const test = await prisma.test.findFirst({
      where: {
        OR: [
          { code: cleanId },
          { id: cleanId },
          { id: { startsWith: cleanId.replace("TST-", "").toLowerCase() } },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        chapter: true,
      },
    });

    if (test) {
      return prisma.platformResource.create({
        data: {
          resourceId: cleanId.startsWith("TST-") ? cleanId : `TST-${test.id.slice(0, 6).toUpperCase()}`,
          type: "TEST",
          title: test.name,
          subject: test.chapter?.title || "Assessment",
          targetId: test.id,
          downloadUrl: `/api/pdf/test/${test.id}`,
          format: "PDF",
          createdById: test.createdById,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      });
    }
  }

  if (cleanId.startsWith("DPP-") || cleanId.startsWith("DPP_") || cleanId.startsWith("AP")) {
    const dpp = await prisma.dpp.findFirst({
      where: {
        OR: [
          { code: cleanId },
          { id: cleanId },
          { id: { startsWith: cleanId.replace("DPP-", "").toLowerCase() } },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (dpp) {
      return prisma.platformResource.create({
        data: {
          resourceId: cleanId.startsWith("DPP-") ? cleanId : `DPP-${dpp.id.slice(0, 6).toUpperCase()}`,
          type: "DPP",
          title: dpp.name,
          subject: dpp.chapter || dpp.subject || "Daily Practice Problem",
          targetId: dpp.id,
          downloadUrl: `/api/pdf/dpp/${dpp.id}`,
          format: "PDF",
          createdById: dpp.createdById,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      });
    }
  }

  // Real questions never get a "QST-"/"Q-" prefixed code — generateQuestionId()
  // (src/lib/questions/id-generator.ts) always produces a plain 8-digit string
  // like "82000001", which is exactly what QuestionManagementTable passes as
  // resourceId whenever a questionCode exists. Without this branch, every
  // question with a real code skipped this block entirely and fell through to
  // `return null`, so deleting any real question always 404'd as "not found".
  if (cleanId.startsWith("QST-") || cleanId.startsWith("Q-") || /^\d+$/.test(cleanId)) {
    const question = await prisma.question.findFirst({
      where: {
        OR: [
          { questionCode: cleanId },
          { id: cleanId },
          { id: { startsWith: cleanId.replace("QST-", "").replace("Q-", "").toLowerCase() } },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        translations: true,
      },
    });

    if (question) {
      return prisma.platformResource.create({
        data: {
          resourceId: cleanId.startsWith("QST-") ? cleanId : `QST-${question.id.slice(0, 6).toUpperCase()}`,
          type: "QUESTION",
          title: question.translations[0]?.statement.slice(0, 60) || "Question Entry",
          subject: question.subject,
          targetId: question.id,
          format: "JSON",
          createdById: question.createdById,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      });
    }
  }

  if (cleanId.startsWith("LEC-") || cleanId.startsWith("VID-")) {
    const lecture = await prisma.lecture.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { id: { startsWith: cleanId.replace("LEC-", "").replace("VID-", "").toLowerCase() } },
        ],
      },
      include: {
        chapter: true,
      },
    });

    if (lecture) {
      return prisma.platformResource.create({
        data: {
          resourceId: cleanId.startsWith("LEC-") ? cleanId : `LEC-${lecture.id.slice(0, 6).toUpperCase()}`,
          type: "LECTURE",
          title: lecture.title,
          subject: lecture.chapter?.title || "Lecture Resource",
          targetId: lecture.id,
          format: lecture.videoUrl ? "MP4" : "VIDEO",
          downloadUrl: lecture.videoUrl || null,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      });
    }
  }

  return null;
}
