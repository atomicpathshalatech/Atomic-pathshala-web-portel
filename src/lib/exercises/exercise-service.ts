import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface ParseIdsResult {
  cleanedIds: string[];
  rawCount: number;
}

/**
 * Parses user input for question IDs. Accepts space, comma, semicolon, or newline delimited strings.
 */
export function parseQuestionIds(rawInput: string): string[] {
  if (!rawInput || typeof rawInput !== "string") return [];
  const tokens = rawInput
    .split(/[\s,;\n\r\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  
  // Deduplicate while preserving input order
  return Array.from(new Set(tokens));
}

export interface QuestionImportWarning {
  questionId: string;
  questionCode: string | null;
  codeOrId: string;
  type: "CHAPTER_MISMATCH" | "MISSING_ENGLISH" | "MISSING_HINDI" | "MISSING_TOPIC" | "UNPUBLISHED";
  message: string;
}

export interface ImportQuestionsResult {
  success: boolean;
  totalParsed: number;
  importedCount: number;
  alreadyIncludedCount: number;
  invalidCount: number;
  importedIds: string[];
  alreadyIncludedIds: string[];
  invalidIds: string[];
  warnings: QuestionImportWarning[];
}

/**
 * Validates and imports questions into an exercise using their Question ID or Question Code.
 * Non-destructive: Questions in Question Bank are strictly preserved.
 */
export async function importQuestionsToExercise(params: {
  exerciseId: string;
  rawInput: string;
  targetSectionId?: string;
  userId?: string;
}): Promise<ImportQuestionsResult> {
  const { exerciseId, rawInput, targetSectionId } = params;
  const parsedIds = parseQuestionIds(rawInput);

  if (parsedIds.length === 0) {
    return {
      success: true,
      totalParsed: 0,
      importedCount: 0,
      alreadyIncludedCount: 0,
      invalidCount: 0,
      importedIds: [],
      alreadyIncludedIds: [],
      invalidIds: [],
      warnings: [],
    };
  }

  // 1. Fetch exercise context
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      questions: { select: { questionId: true } },
      sections: { orderBy: { order: "asc" } },
    },
  });

  if (!exercise) {
    throw new Error(`Exercise not found with ID: ${exerciseId}`);
  }

  const existingQuestionIds = new Set(exercise.questions.map((q) => q.questionId));

  // 2. Query Question Bank for matching IDs or QuestionCodes
  // Search by exact ID or case-insensitive questionCode
  const candidateQuestions = await prisma.question.findMany({
    where: {
      OR: [
        { id: { in: parsedIds } },
        { questionCode: { in: parsedIds, mode: "insensitive" } },
      ],
    },
    include: {
      translations: { select: { language: true, statement: true } },
    },
  });

  // Map candidate questions by both id and questionCode
  const questionMap = new Map<string, typeof candidateQuestions[0]>();
  for (const q of candidateQuestions) {
    questionMap.set(q.id.toLowerCase(), q);
    if (q.questionCode) {
      questionMap.set(q.questionCode.toLowerCase(), q);
    }
  }

  const importedIds: string[] = [];
  const alreadyIncludedIds: string[] = [];
  const invalidIds: string[] = [];
  const warnings: QuestionImportWarning[] = [];
  const toInsertQuestions: typeof candidateQuestions = [];
  const seenQuestionDbIds = new Set<string>();

  for (const rawToken of parsedIds) {
    const matched = questionMap.get(rawToken.toLowerCase());
    if (!matched) {
      invalidIds.push(rawToken);
      continue;
    }

    if (existingQuestionIds.has(matched.id) || seenQuestionDbIds.has(matched.id)) {
      alreadyIncludedIds.push(rawToken);
      continue;
    }

    seenQuestionDbIds.add(matched.id);
    toInsertQuestions.push(matched);
    importedIds.push(matched.questionCode || matched.id);

    // Validation checks
    const hasEnglish = matched.translations.some((t) => t.language.toUpperCase() === "ENGLISH" && t.statement?.trim());
    const hasHindi = matched.translations.some((t) => t.language.toUpperCase() === "HINDI" && t.statement?.trim());

    if (!hasEnglish) {
      warnings.push({
        questionId: matched.id,
        questionCode: matched.questionCode,
        codeOrId: rawToken,
        type: "MISSING_ENGLISH",
        message: `Question ${matched.questionCode || matched.id} does not have an English translation.`,
      });
    }

    if (!hasHindi) {
      warnings.push({
        questionId: matched.id,
        questionCode: matched.questionCode,
        codeOrId: rawToken,
        type: "MISSING_HINDI",
        message: `Question ${matched.questionCode || matched.id} does not have a Hindi translation.`,
      });
    }

    if (
      exercise.chapter &&
      matched.chapter &&
      matched.chapter.trim().toLowerCase() !== exercise.chapter.trim().toLowerCase()
    ) {
      warnings.push({
        questionId: matched.id,
        questionCode: matched.questionCode,
        codeOrId: rawToken,
        type: "CHAPTER_MISMATCH",
        message: `Chapter mismatch: Question belongs to "${matched.chapter}", but exercise is for "${exercise.chapter}".`,
      });
    }

    if (!matched.topic) {
      warnings.push({
        questionId: matched.id,
        questionCode: matched.questionCode,
        codeOrId: rawToken,
        type: "MISSING_TOPIC",
        message: `Question ${matched.questionCode || matched.id} has no canonical topic assigned in Question Bank.`,
      });
    }

    if (!matched.isPublished) {
      warnings.push({
        questionId: matched.id,
        questionCode: matched.questionCode,
        codeOrId: rawToken,
        type: "UNPUBLISHED",
        message: `Question ${matched.questionCode || matched.id} is currently in draft/unpublished status.`,
      });
    }
  }

  if (toInsertQuestions.length === 0) {
    return {
      success: true,
      totalParsed: parsedIds.length,
      importedCount: 0,
      alreadyIncludedCount: alreadyIncludedIds.length,
      invalidCount: invalidIds.length,
      importedIds: [],
      alreadyIncludedIds,
      invalidIds,
      warnings,
    };
  }

  // 3. Resolve destination section(s)
  // If targetSectionId is specified, put all in that section.
  // Otherwise, if TOPIC_WISE mode, group by topic, or default to first/new section.
  let currentMaxDisplayOrder = exercise.questions.length;

  if (targetSectionId) {
    // Insert into specified section
    for (const q of toInsertQuestions) {
      currentMaxDisplayOrder++;
      await prisma.exerciseQuestion.create({
        data: {
          exerciseId,
          sectionId: targetSectionId,
          questionId: q.id,
          displayOrder: currentMaxDisplayOrder,
          marks: exercise.defaultMarks,
          negativeMarks: exercise.defaultNegativeMarks,
        },
      });
    }
  } else if (exercise.organizationMode === "TOPIC_WISE") {
    // Topic-wise distribution
    // Map existing sections by topic name
    const sectionTopicMap = new Map<string, string>();
    for (const sec of exercise.sections) {
      if (sec.topic) {
        sectionTopicMap.set(sec.topic.trim().toLowerCase(), sec.id);
      }
      sectionTopicMap.set(sec.title.trim().toLowerCase(), sec.id);
    }

    // If the exercise only has an unused placeholder "Section 1", reuse it for the first topic
    let placeholderSectionId: string | null = null;
    const firstSection = exercise.sections[0];
    if (
      exercise.sections.length === 1 &&
      firstSection &&
      firstSection.title === "Section 1" &&
      !firstSection.topic &&
      exercise.questions.length === 0
    ) {
      placeholderSectionId = firstSection.id;
    }

    let nextSectionOrder = exercise.sections.length;

    for (const q of toInsertQuestions) {
      const topicKey = (q.topic || "Unclassified Questions").trim();
      let secId = sectionTopicMap.get(topicKey.toLowerCase());

      if (!secId) {
        if (placeholderSectionId) {
          const updatedSection = await prisma.exerciseSection.update({
            where: { id: placeholderSectionId },
            data: {
              title: q.topic ? `Topic: ${q.topic}` : "Unclassified Questions",
              topic: q.topic || null,
              subTopic: q.subTopic || null,
            },
          });
          secId = updatedSection.id;
          sectionTopicMap.set(topicKey.toLowerCase(), secId);
          placeholderSectionId = null;
        } else {
          // Create new section for this topic
          const createdSection = await prisma.exerciseSection.create({
            data: {
              exerciseId,
              title: q.topic ? `Topic: ${q.topic}` : "Unclassified Questions",
              topic: q.topic || null,
              subTopic: q.subTopic || null,
              order: nextSectionOrder++,
            },
          });
          secId = createdSection.id;
          sectionTopicMap.set(topicKey.toLowerCase(), secId);
        }
      }

      currentMaxDisplayOrder++;
      await prisma.exerciseQuestion.create({
        data: {
          exerciseId,
          sectionId: secId,
          questionId: q.id,
          displayOrder: currentMaxDisplayOrder,
          marks: exercise.defaultMarks,
          negativeMarks: exercise.defaultNegativeMarks,
        },
      });
    }
  } else {
    // Custom mode: Put in first section or create default section
    let defaultSectionId = exercise.sections[0]?.id;
    if (!defaultSectionId) {
      const defaultSec = await prisma.exerciseSection.create({
        data: {
          exerciseId,
          title: "Section 1",
          order: 0,
        },
      });
      defaultSectionId = defaultSec.id;
    }

    for (const q of toInsertQuestions) {
      currentMaxDisplayOrder++;
      await prisma.exerciseQuestion.create({
        data: {
          exerciseId,
          sectionId: defaultSectionId,
          questionId: q.id,
          displayOrder: currentMaxDisplayOrder,
          marks: exercise.defaultMarks,
          negativeMarks: exercise.defaultNegativeMarks,
        },
      });
    }
  }

  return {
    success: true,
    totalParsed: parsedIds.length,
    importedCount: toInsertQuestions.length,
    alreadyIncludedCount: alreadyIncludedIds.length,
    invalidCount: invalidIds.length,
    importedIds,
    alreadyIncludedIds,
    invalidIds,
    warnings,
  };
}

/**
 * Regroups all questions in the exercise according to their canonical Question Bank topic and subtopic metadata.
 * Mode A: Automatic Topic-wise arrangement.
 */
export async function regroupExerciseByTopic(exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      questions: {
        include: {
          question: {
            select: {
              id: true,
              topic: true,
              subTopic: true,
            },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
      sections: true,
    },
  });

  if (!exercise) throw new Error("Exercise not found");

  // Collect distinct topics in order of first appearance
  const topicMap = new Map<string, string[]>(); // topicName -> questionIds[]
  for (const eq of exercise.questions) {
    const topic = eq.question.topic?.trim() || "Unclassified Questions";
    if (!topicMap.has(topic)) {
      topicMap.set(topic, []);
    }
    topicMap.get(topic)!.push(eq.id);
  }

  // Transaction: Recreate or update sections
  return await prisma.$transaction(async (tx) => {
    // Delete existing sections (foreign keys on questions will be set to null or reassigned)
    await tx.exerciseQuestion.updateMany({
      where: { exerciseId },
      data: { sectionId: null },
    });
    await tx.exerciseSection.deleteMany({
      where: { exerciseId },
    });

    let sectionOrder = 0;
    let globalDisplayOrder = 1;

    for (const [topicName, eqIds] of Array.from(topicMap.entries())) {
      const section = await tx.exerciseSection.create({
        data: {
          exerciseId,
          title: topicName === "Unclassified Questions" ? topicName : `Topic: ${topicName}`,
          topic: topicName === "Unclassified Questions" ? null : topicName,
          order: sectionOrder++,
        },
      });

      for (const eqId of eqIds) {
        await tx.exerciseQuestion.update({
          where: { id: eqId },
          data: {
            sectionId: section.id,
            displayOrder: globalDisplayOrder++,
          },
        });
      }
    }

    // Set exercise organization mode to TOPIC_WISE
    await tx.exercise.update({
      where: { id: exerciseId },
      data: { organizationMode: "TOPIC_WISE" },
    });

    return {
      success: true,
      sectionsCreated: topicMap.size,
      questionsRegrouped: exercise.questions.length,
    };
  });
}

/**
 * Fetches full exercise details including sections, questions, translations, attempts, and audit stats.
 */
export async function getExerciseDetails(exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { displayOrder: "asc" },
            include: {
              question: {
                include: {
                  translations: true,
                },
              },
            },
          },
        },
      },
      questions: {
        orderBy: { displayOrder: "asc" },
        include: {
          question: {
            include: {
              translations: true,
            },
          },
        },
      },
      exports: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: {
        select: {
          questions: true,
          attempts: true,
        },
      },
    },
  });

  if (!exercise) return null;

  // Compute preflight audit metrics
  let missingEnglishCount = 0;
  let missingHindiCount = 0;
  let chapterMismatchCount = 0;
  let missingTopicCount = 0;
  let unpublishedCount = 0;
  let pyqCount = 0;

  const difficultyCounts: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const typeCounts: Record<string, number> = {};

  for (const eq of exercise.questions) {
    const q = eq.question;
    const hasEn = q.translations.some((t) => t.language.toUpperCase() === "ENGLISH" && t.statement?.trim());
    const hasHi = q.translations.some((t) => t.language.toUpperCase() === "HINDI" && t.statement?.trim());

    if (!hasEn) missingEnglishCount++;
    if (!hasHi) missingHindiCount++;
    if (!q.topic) missingTopicCount++;
    if (!q.isPublished) unpublishedCount++;
    if (q.pyqExam || q.pyqYear) pyqCount++;

    if (
      exercise.chapter &&
      q.chapter &&
      q.chapter.trim().toLowerCase() !== exercise.chapter.trim().toLowerCase()
    ) {
      chapterMismatchCount++;
    }

    if (q.difficulty) {
      difficultyCounts[q.difficulty] = (difficultyCounts[q.difficulty] || 0) + 1;
    }
    if (q.type) {
      typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
    }
  }

  const audit = {
    totalQuestions: exercise.questions.length,
    totalSections: exercise.sections.length,
    missingEnglishCount,
    missingHindiCount,
    chapterMismatchCount,
    missingTopicCount,
    unpublishedCount,
    pyqCount,
    difficultyCounts,
    typeCounts,
    isExportReadyBilingual: missingEnglishCount === 0 && missingHindiCount === 0,
    isExportReadyHindi: missingHindiCount === 0,
    isExportReadyEnglish: missingEnglishCount === 0,
  };

  return {
    ...exercise,
    audit,
  };
}

/**
 * Generates an exercise code if not provided
 */
export function generateExerciseCode(subject: string): string {
  const cleanSub = subject.slice(0, 3).toUpperCase();
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EX-${cleanSub}-${dateStr}-${randomPart}`;
}

export interface CreateExerciseDto {
  title: string;
  subtitle?: string;
  subject: string;
  chapter: string;
  topic?: string;
  subTopic?: string;
  description?: string;
  instructions?: string;
  exerciseType?: string;
  organizationMode?: string;
  languageMode?: string;
  answerKeyMode?: string;
  solutionMode?: string;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  layoutSettings?: Prisma.InputJsonValue;
  createdById?: string;
}

export async function createExercise(data: CreateExerciseDto) {
  const code = generateExerciseCode(data.subject);

  return await prisma.exercise.create({
    data: {
      exerciseCode: code,
      title: data.title,
      subtitle: data.subtitle,
      subject: data.subject,
      chapter: data.chapter,
      topic: data.topic,
      subTopic: data.subTopic,
      description: data.description,
      instructions: data.instructions,
      exerciseType: data.exerciseType || "TOPIC_WISE",
      organizationMode: data.organizationMode || "TOPIC_WISE",
      languageMode: data.languageMode || "BILINGUAL",
      answerKeyMode: data.answerKeyMode || "END_OF_DOCUMENT",
      solutionMode: data.solutionMode || "END_OF_DOCUMENT",
      defaultMarks: data.defaultMarks ?? 4.0,
      defaultNegativeMarks: data.defaultNegativeMarks ?? 1.0,
      layoutSettings: data.layoutSettings ?? {
        pageSize: "A4",
        orientation: "PORTRAIT",
        twoColumn: true,
        instituteName: "ATOMIC PATHSHALA",
        showWatermark: true,
        fontSize: "10pt",
      },
      createdById: data.createdById,
      sections: {
        create: [
          {
            title: data.topic ? `Topic: ${data.topic}` : "Section 1",
            topic: data.topic || null,
            subTopic: data.subTopic || null,
            order: 0,
          },
        ],
      },
    },
    include: {
      sections: true,
    },
  });
}

/**
 * Removes a question from an exercise without touching the Question Bank.
 */
export async function removeQuestionFromExercise(exerciseQuestionId: string) {
  return await prisma.exerciseQuestion.delete({
    where: { id: exerciseQuestionId },
  });
}

/**
 * Converts an Exercise into a Test Portal test for online quiz/CBT test mode.
 */
export async function convertExerciseToTestPortal(exerciseId: string, userId?: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { displayOrder: "asc" },
          },
        },
      },
      questions: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!exercise) throw new Error("Exercise not found");
  if (exercise.questions.length === 0) throw new Error("Exercise has no questions to launch as a test");

  const durationMin = Math.max(15, Math.ceil(exercise.questions.length * 1.5));

  // Create Test in Test Portal schema
  const createdTest = await prisma.test.create({
    data: {
      name: `${exercise.title} (${exercise.chapter})`,
      code: `TEST-${exercise.exerciseCode}`,
      description: exercise.description || `Practice test generated from Exercise: ${exercise.title}`,
      instructions: exercise.instructions || "Attempt all questions within the allocated time.",
      durationMin,
      correctMarks: exercise.defaultMarks,
      incorrectMarks: -exercise.defaultNegativeMarks,
      negativeMarkingEnabled: exercise.defaultNegativeMarks > 0,
      languageMode: exercise.languageMode === "HINDI_ONLY" ? "HINDI" : exercise.languageMode === "ENGLISH_ONLY" ? "ENGLISH" : "BOTH",
      status: "DRAFT",
      createdById: userId,
      sections: {
        create: exercise.sections.map((sec, secIdx) => ({
          name: sec.title,
          order: secIdx,
          subject: exercise.subject,
          targetCount: sec.questions.length,
          marksPerQuestion: exercise.defaultMarks,
          negativeMarks: exercise.defaultNegativeMarks,
          questions: {
            create: sec.questions.map((sq, qIdx) => ({
              questionId: sq.questionId,
              order: qIdx,
              marksOverride: sq.marks || exercise.defaultMarks,
              negativeMarksOverride: sq.negativeMarks || exercise.defaultNegativeMarks,
            })),
          },
        })),
      },
    },
  });

  // Link Test to Exercise
  await prisma.exercise.update({
    where: { id: exerciseId },
    data: { testId: createdTest.id },
  });

  return createdTest;
}
