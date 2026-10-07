import { prisma } from "@/lib/db";
import {
  getMasterNcertSubjects,
  getMasterNcertChapters,
  getMasterNcertTopics,
  normalizeSubjectName,
} from "./master-ncert-catalog";

export interface AcademicHierarchySubject {
  id: string;
  name: string;
  nameHindi?: string | null;
}

export interface AcademicHierarchyChapter {
  id: string;
  title: string;
  titleHindi?: string | null;
  subject: string;
  classNumber?: number;
  questionCount?: number;
}

export interface AcademicHierarchyTopic {
  id: string;
  name: string;
  nameHindi?: string | null;
  topicNumber?: string | null;
  subtopics: AcademicHierarchySubtopic[];
}

export interface AcademicHierarchySubtopic {
  id: string;
  name: string;
  nameHindi?: string | null;
  microConcepts: AcademicHierarchyMicroConcept[];
}

export interface AcademicHierarchyMicroConcept {
  id: string;
  name: string;
  nameHindi?: string | null;
}

/**
 * Single source of truth for Academic Hierarchy (Subject -> Chapter -> Topic -> Subtopic -> MicroConcept)
 */
export async function getHierarchySubjects(): Promise<AcademicHierarchySubject[]> {
  const ncertSubs = getMasterNcertSubjects();
  
  // Also fetch any custom subjects in DB
  const dbSubjects = await prisma.subject.findMany({
    select: { title: true },
    distinct: ["title"],
  });

  const subjectMap = new Map<string, AcademicHierarchySubject>();

  for (const s of ncertSubs) {
    subjectMap.set(s.name.toUpperCase(), {
      id: s.name,
      name: s.name,
      nameHindi: s.nameHindi,
    });
  }

  for (const s of dbSubjects) {
    const norm = normalizeSubjectName(s.title);
    if (!subjectMap.has(norm.toUpperCase())) {
      subjectMap.set(norm.toUpperCase(), {
        id: norm,
        name: norm,
      });
    }
  }

  return Array.from(subjectMap.values());
}

/**
 * Returns distinct chapters for a subject from NCERT catalog + DB chapters + Questions
 */
export async function getHierarchyChapters(subjectName: string): Promise<AcademicHierarchyChapter[]> {
  const normalizedSubject = normalizeSubjectName(subjectName);
  const ncertChapters = getMasterNcertChapters(normalizedSubject);

  const chapterMap = new Map<string, AcademicHierarchyChapter>();

  // 1. Add from NCERT catalog
  for (const nc of ncertChapters) {
    const key = nc.title.trim().toLowerCase();
    chapterMap.set(key, {
      id: nc.id,
      title: nc.title,
      titleHindi: nc.titleHindi || null,
      subject: normalizedSubject,
      classNumber: nc.classNumber,
    });
  }

  // 2. Add from DB Chapters
  const dbChapters = await prisma.chapter.findMany({
    where: {
      subject: {
        title: { equals: normalizedSubject, mode: "insensitive" },
      },
    },
    select: { id: true, title: true },
  });

  for (const ch of dbChapters) {
    const key = ch.title.trim().toLowerCase();
    if (!chapterMap.has(key)) {
      chapterMap.set(key, {
        id: ch.id,
        title: ch.title,
        subject: normalizedSubject,
      });
    }
  }

  // 3. Add any chapters from existing questions
  const questionChapters = await prisma.question.findMany({
    where: {
      subject: { equals: normalizedSubject, mode: "insensitive" },
      chapter: { not: null },
    },
    select: { chapter: true },
    distinct: ["chapter"],
  });

  for (const q of questionChapters) {
    if (q.chapter) {
      const key = q.chapter.trim().toLowerCase();
      if (!chapterMap.has(key)) {
        chapterMap.set(key, {
          id: `db-q-${q.chapter}`,
          title: q.chapter,
          subject: normalizedSubject,
        });
      }
    }
  }

  return Array.from(chapterMap.values()).sort((a, b) => {
    if (a.classNumber && b.classNumber && a.classNumber !== b.classNumber) {
      return a.classNumber - b.classNumber;
    }
    return a.title.localeCompare(b.title);
  });
}

/**
 * Returns topics, subtopics and microconcepts for a given subject & chapter
 */
export async function getHierarchyTopics(
  subjectName: string,
  chapterName: string
): Promise<AcademicHierarchyTopic[]> {
  const normalizedSubject = normalizeSubjectName(subjectName);
  const cleanChap = chapterName
    .replace(/^\[class\s*\d+\]\s*/i, "")
    .replace(/^ch\s*\d+:\s*/i, "")
    .replace(/^\d+[\.:\s-]+/i, "")
    .trim();

  // 1. Check database master academic topics
  const dbAcademicTopics = await prisma.academicTopic.findMany({
    where: {
      chapter: {
        title: { contains: cleanChap, mode: "insensitive" },
      },
    },
    include: {
      subtopics: {
        include: {
          microConcepts: true,
        },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  if (dbAcademicTopics.length > 0) {
    return dbAcademicTopics.map((t) => ({
      id: t.id,
      name: t.title,
      nameHindi: t.titleHindi,
      topicNumber: t.topicNumber,
      subtopics: t.subtopics.map((st) => ({
        id: st.id,
        name: st.title,
        nameHindi: st.titleHindi,
        microConcepts: (st.microConcepts || []).map((mc) => ({
          id: mc.id,
          name: mc.title,
          nameHindi: mc.titleHindi,
        })),
      })),
    }));
  }

  // 2. Check NCERT master catalog topics
  const ncertTopics = getMasterNcertTopics(normalizedSubject, chapterName);
  if (ncertTopics.length > 0) {
    return ncertTopics.map((t) => ({
      id: t.id,
      name: t.title,
      nameHindi: t.titleHindi,
      topicNumber: t.topicNumber,
      subtopics: t.subtopics.map((st, idx) => ({
        id: `${t.id}-st-${idx}`,
        name: st,
        microConcepts: [],
      })),
    }));
  }

  // 3. Fallback: discover distinct topics from Question Bank in database
  const distinctQuestionTopics = await prisma.question.findMany({
    where: {
      subject: { equals: normalizedSubject, mode: "insensitive" },
      chapter: { contains: cleanChap, mode: "insensitive" },
      topic: { not: null },
    },
    select: { topic: true, subTopic: true, microConcept: true },
  });

  const topicMap = new Map<string, { id: string; name: string; subtopics: Map<string, Set<string>> }>();

  for (const q of distinctQuestionTopics) {
    if (!q.topic) continue;
    const tKey = q.topic.trim();
    if (!topicMap.has(tKey)) {
      topicMap.set(tKey, {
        id: `discovered-t-${tKey}`,
        name: tKey,
        subtopics: new Map(),
      });
    }

    const tObj = topicMap.get(tKey)!;
    if (q.subTopic) {
      const stKey = q.subTopic.trim();
      if (!tObj.subtopics.has(stKey)) {
        tObj.subtopics.set(stKey, new Set());
      }
      if (q.microConcept) {
        tObj.subtopics.get(stKey)!.add(q.microConcept.trim());
      }
    }
  }

  return Array.from(topicMap.values()).map((t) => ({
    id: t.id,
    name: t.name,
    subtopics: Array.from(t.subtopics.entries()).map(([stName, mcSet], stIdx) => ({
      id: `${t.id}-st-${stIdx}`,
      name: stName,
      microConcepts: Array.from(mcSet).map((mcName, mcIdx) => ({
        id: `${t.id}-st-${stIdx}-mc-${mcIdx}`,
        name: mcName,
      })),
    })),
  }));
}
