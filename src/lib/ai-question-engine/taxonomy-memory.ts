import { prisma } from "@/lib/db";

/**
 * Normalizes topic names to prevent duplicate topics from spelling/formatting variations:
 * e.g. "Pedigree Analysis", "pedigree analysis", "Pedigree-Analysis", "  Pedigree   Analysis  "
 * all normalize to: "pedigree analysis"
 */
export function normalizeTopicName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^\w\s\u0900-\u097F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ResolvedTaxonomyTopic {
  id: string;
  title: string;
  titleHindi?: string | null;
  subtopics: string[];
  isCustom: boolean;
  isApproved: boolean;
  frequency: number;
}

/**
 * Retrieves master NCERT syllabus topics plus persistent learned custom topics for a chapter
 */
export async function getTopicsForSubjectAndChapter(
  subjectName: string,
  chapterName: string
): Promise<ResolvedTaxonomyTopic[]> {
  const normSubject = subjectName.trim();
  const normChapter = chapterName.trim();

  const results: Map<string, ResolvedTaxonomyTopic> = new Map();

  // 1. Fetch from Academic Hierarchy if available
  try {
    const academicChapter = await prisma.academicChapter.findFirst({
      where: {
        title: { contains: normChapter, mode: "insensitive" },
        subject: { name: { contains: normSubject, mode: "insensitive" } },
      },
      include: {
        topics: {
          where: { isActive: true },
          include: {
            subtopics: { where: { isActive: true }, select: { title: true } },
          },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (academicChapter && academicChapter.topics.length > 0) {
      for (const t of academicChapter.topics) {
        const key = normalizeTopicName(t.title);
        results.set(key, {
          id: t.id,
          title: t.title,
          titleHindi: t.titleHindi,
          subtopics: t.subtopics.map((st) => st.title),
          isCustom: false,
          isApproved: true,
          frequency: 10,
        });
      }
    }
  } catch (err) {
    console.warn("[TaxonomyMemory] AcademicChapter query warning:", err);
  }

  // 2. Supplement from Question Bank existing historical questions in this subject/chapter
  try {
    const existingQuestions = await prisma.question.findMany({
      where: {
        subject: { equals: normSubject, mode: "insensitive" },
        chapter: { contains: normChapter, mode: "insensitive" },
        topic: { not: null },
      },
      select: { topic: true, subTopic: true },
      take: 200,
    });

    for (const q of existingQuestions) {
      if (!q.topic) continue;
      const key = normalizeTopicName(q.topic);
      if (!results.has(key)) {
        results.set(key, {
          id: `qb-${key}`,
          title: q.topic.trim(),
          subtopics: q.subTopic ? [q.subTopic.trim()] : [],
          isCustom: false,
          isApproved: true,
          frequency: 5,
        });
      } else {
        const existing = results.get(key)!;
        if (q.subTopic && !existing.subtopics.includes(q.subTopic.trim())) {
          existing.subtopics.push(q.subTopic.trim());
        }
      }
    }
  } catch (err) {
    console.warn("[TaxonomyMemory] Question Bank topics query warning:", err);
  }

  // 3. Fetch from Persistent Learned Taxonomy Memory (Custom teacher additions)
  try {
    const learnedTopics = await prisma.taxonomyTopicMemory.findMany({
      where: {
        subject: { equals: normSubject, mode: "insensitive" },
        chapter: { equals: normChapter, mode: "insensitive" },
        isApproved: true,
      },
      orderBy: { frequency: "desc" },
    });

    for (const lt of learnedTopics) {
      const key = lt.normalizedTopic;
      const subtopicsList = Array.isArray(lt.subtopics) ? (lt.subtopics as string[]) : [];
      if (!results.has(key)) {
        results.set(key, {
          id: lt.id,
          title: lt.displayTopic,
          subtopics: subtopicsList,
          isCustom: true,
          isApproved: lt.isApproved,
          frequency: lt.frequency,
        });
      } else {
        // Merge any additional subtopics
        const existing = results.get(key)!;
        for (const st of subtopicsList) {
          if (!existing.subtopics.includes(st)) {
            existing.subtopics.push(st);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[TaxonomyMemory] TaxonomyTopicMemory query warning:", err);
  }

  return Array.from(results.values());
}

/**
 * Registers a new Custom Topic into persistent memory with normalization and de-duplication
 */
export async function registerCustomTopic(params: {
  subject: string;
  chapter: string;
  topicTitle: string;
  subtopics?: string[];
  userId?: string;
}): Promise<{ topic: ResolvedTaxonomyTopic; isNew: boolean }> {
  const normKey = normalizeTopicName(params.topicTitle);
  if (!normKey) {
    throw new Error("Topic title cannot be empty.");
  }

  const normSubject = params.subject.trim();
  const normChapter = params.chapter.trim();
  const displayTitle = params.topicTitle.trim();
  const subtopicsList = params.subtopics ? params.subtopics.map((s) => s.trim()).filter(Boolean) : [];

  // Check if topic exists in memory
  const existing = await prisma.taxonomyTopicMemory.findUnique({
    where: {
      subject_chapter_normalizedTopic: {
        subject: normSubject,
        chapter: normChapter,
        normalizedTopic: normKey,
      },
    },
  });

  if (existing) {
    // Increment frequency and merge subtopics
    const currentSubtopics = Array.isArray(existing.subtopics) ? (existing.subtopics as string[]) : [];
    const merged = Array.from(new Set([...currentSubtopics, ...subtopicsList]));

    const updated = await prisma.taxonomyTopicMemory.update({
      where: { id: existing.id },
      data: {
        frequency: { increment: 1 },
        subtopics: merged,
      },
    });

    return {
      topic: {
        id: updated.id,
        title: updated.displayTopic,
        subtopics: merged,
        isCustom: true,
        isApproved: updated.isApproved,
        frequency: updated.frequency,
      },
      isNew: false,
    };
  }

  // Create new candidate in taxonomy memory
  const created = await prisma.taxonomyTopicMemory.create({
    data: {
      subject: normSubject,
      chapter: normChapter,
      normalizedTopic: normKey,
      displayTopic: displayTitle,
      subtopics: subtopicsList,
      isApproved: true, // Default active for seamless educator productivity
      frequency: 1,
      createdById: params.userId || null,
    },
  });

  return {
    topic: {
      id: created.id,
      title: created.displayTopic,
      subtopics: subtopicsList,
      isCustom: true,
      isApproved: created.isApproved,
      frequency: created.frequency,
    },
    isNew: true,
  };
}
