import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  getHierarchySubjects,
  getHierarchyChapters,
  getHierarchyTopics,
} from "@/lib/academic/academic-hierarchy-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const searchParams = req.nextUrl.searchParams;
    const subject = searchParams.get("subject");
    const chapter = searchParams.get("chapter");

    if (subject && chapter) {
      const topics = await getHierarchyTopics(subject, chapter);
      return apiSuccess({ topics });
    }

    if (subject) {
      const chapters = await getHierarchyChapters(subject);
      return apiSuccess({ chapters });
    }

    const subjects = await getHierarchySubjects();
    return apiSuccess({ subjects });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await req.json();
    const { type, subject, chapter, topicId, subtopicId, name, nameHindi, topicNumber, order } = body;

    if (!type || !name?.trim()) {
      return apiError("Type and name are required", 400);
    }

    if (type === "TOPIC") {
      if (!subject || !chapter) {
        return apiError("Subject and Chapter are required for creating a Topic", 400);
      }

      // Check if Chapter exists in academic chapters or create reference
      const cleanChap = chapter
        .replace(/^\[class\s*\d+\]\s*/i, "")
        .replace(/^ch\s*\d+:\s*/i, "")
        .replace(/^\d+[\.:\s-]+/i, "")
        .trim();

      let academicChapter = await prisma.academicChapter.findFirst({
        where: {
          title: { contains: cleanChap, mode: "insensitive" },
        },
      });

      if (!academicChapter) {
        // Find or create academic subject
        let academicSubject = await prisma.academicSubject.findFirst({
          where: { name: { equals: subject, mode: "insensitive" } },
        });

        if (!academicSubject) {
          const class11 = await prisma.academicClass.findFirst({ where: { numericValue: 11 } });
          academicSubject = await prisma.academicSubject.create({
            data: {
              classId: class11?.id || "class-11",
              name: subject,
            },
          });
        }

        academicChapter = await prisma.academicChapter.create({
          data: {
            subjectId: academicSubject.id,
            chapterNumber: 99,
            title: cleanChap,
          },
        });
      }

      const newTopic = await prisma.academicTopic.create({
        data: {
          chapterId: academicChapter.id,
          topicNumber: topicNumber || "T.1",
          title: name.trim(),
          titleHindi: nameHindi?.trim() || null,
          displayOrder: order || 0,
        },
      });

      return apiSuccess({ topic: newTopic }, 201);
    }

    if (type === "SUBTOPIC") {
      if (!topicId) {
        return apiError("topicId is required for creating a Subtopic", 400);
      }

      const newSubtopic = await prisma.academicSubtopic.create({
        data: {
          topicId,
          title: name.trim(),
          titleHindi: nameHindi?.trim() || null,
          displayOrder: order || 0,
        },
      });

      return apiSuccess({ subtopic: newSubtopic }, 201);
    }

    if (type === "MICRO_CONCEPT") {
      if (!subtopicId) {
        return apiError("subtopicId is required for creating a Micro Concept", 400);
      }

      const newMicroConcept = await prisma.academicMicroConcept.create({
        data: {
          subtopicId,
          title: name.trim(),
          titleHindi: nameHindi?.trim() || null,
          displayOrder: order || 0,
        },
      });

      return apiSuccess({ microConcept: newMicroConcept }, 201);
    }

    return apiError("Invalid hierarchy level type", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
