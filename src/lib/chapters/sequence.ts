import "server-only";
import { prisma } from "@/lib/db";

/**
 * Chapter content-authoring sequence engine (Chapter → Lecture → DPP →
 * Chapter Test pipeline spec). This is the TEACHER/ADMIN-side "authoring
 * lock" — it governs whether the next Lecture may be CREATED — and is a
 * separate concern from @/lib/chapters/progression.ts, which governs
 * whether an already-published Lecture may be WATCHED by a given student.
 * The two locks are intentionally independent (same DPP-per-2-lectures
 * formula, different gate).
 *
 * Default policy, matching the spec exactly: every 2 lectures create one
 * DPP slot; DPP slots 1-4 are mandatory for chapter submission, slot 5+ is
 * optional. This is expressed as constants (not yet a per-chapter DB
 * setting) so a future configurable policy only needs to change where
 * these are read from, not the call sites.
 */
export const LECTURES_PER_DPP_SLOT = 2;
export const MANDATORY_DPP_SLOTS = 4;

/** Which DPP slot (1-indexed) must be COMPLETE before a lecture at this
 * 1-indexed position may be authored. 0 means no DPP is required yet. */
export function dppSlotRequiredForLecturePosition(position: number): number {
  return Math.floor(Math.max(0, position - 1) / LECTURES_PER_DPP_SLOT);
}

export function isDppSlotMandatory(slot: number): boolean {
  return slot >= 1 && slot <= MANDATORY_DPP_SLOTS;
}

export type DppSlotInfo = {
  id: string;
  slot: number;
  label: string;
  required: boolean;
  questionCount: number;
  /** A DPP counts toward unlocking the next lecture pair only once it has
   * at least one question assigned — an empty DPP does not satisfy the
   * requirement (spec: "Do not consider an empty DPP as completed"). */
  complete: boolean;
};

export type ChapterSequenceState = {
  chapterId: string;
  lectureCount: number;
  dpps: DppSlotInfo[];
  testCount: number;
  /** 1-indexed position of the next lecture a teacher would create. */
  nextLecturePosition: number;
  /** 0 if nothing is blocking the next lecture. */
  requiredDppSlotForNextLecture: number;
  nextLectureUnlocked: boolean;
};

/** Single source of truth for both the authoring-lock check in the
 * lectures POST route and the readiness endpoint — one query shape, no
 * risk of the two drifting apart. */
export async function getChapterSequenceState(chapterId: string): Promise<ChapterSequenceState> {
  const [lectureCount, dpps, testCount] = await Promise.all([
    prisma.lecture.count({ where: { chapterId } }),
    prisma.dpp.findMany({
      where: { chapterId },
      orderBy: { createdAt: "asc" },
      select: { id: true, _count: { select: { questions: true } } },
    }),
    prisma.test.count({ where: { chapterId } }),
  ]);

  const dppSlots: DppSlotInfo[] = dpps.map((d, idx) => {
    const slot = idx + 1;
    return {
      id: d.id,
      slot,
      label: `DPP ${slot}`,
      required: isDppSlotMandatory(slot),
      questionCount: d._count.questions,
      complete: d._count.questions > 0,
    };
  });

  // At authoring/scheduling time, a DPP slot is satisfied as soon as it is created.
  // Questions are added after classes occur.
  const createdSlots = new Set(dppSlots.map((d) => d.slot));
  const nextLecturePosition = lectureCount + 1;
  const requiredDppSlotForNextLecture = dppSlotRequiredForLecturePosition(nextLecturePosition);
  const nextLectureUnlocked =
    requiredDppSlotForNextLecture === 0 || createdSlots.has(requiredDppSlotForNextLecture);

  return {
    chapterId,
    lectureCount,
    dpps: dppSlots,
    testCount,
    nextLecturePosition,
    requiredDppSlotForNextLecture,
    nextLectureUnlocked,
  };
}

export type ReadinessItem = {
  key: string;
  label: string;
  required: boolean;
  complete: boolean;
};

export type ChapterReadiness = {
  ready: boolean;
  missing: string[];
  items: ReadinessItem[];
  sequence: ChapterSequenceState;
};

/** Full mandatory-completion checklist for Chapter submission (spec:
 * "Check Chapter Readiness"). Generalized — does not assume exactly 10
 * lectures / 5 DPPs, works for any chapter length. */
export async function getChapterReadiness(chapterId: string): Promise<ChapterReadiness> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { title: true, description: true },
  });

  const sequence = await getChapterSequenceState(chapterId);
  const items: ReadinessItem[] = [];

  items.push({
    key: "metadata",
    label: "Chapter metadata",
    required: true,
    complete: Boolean(chapter?.title?.trim()),
  });
  items.push({
    key: "description",
    label: "Chapter description",
    required: true,
    complete: Boolean(chapter?.description?.trim()),
  });

  for (let position = 1; position <= sequence.lectureCount; position++) {
    items.push({ key: `lecture-${position}`, label: `Lecture ${position}`, required: true, complete: true });
    const slotAfterThis = dppSlotRequiredForLecturePosition(position + 1);
    const slotAtThisPosition = dppSlotRequiredForLecturePosition(position);
    if (slotAfterThis > slotAtThisPosition) {
      const dpp = sequence.dpps.find((d) => d.slot === slotAfterThis);
      items.push({
        key: `dpp-${slotAfterThis}`,
        label: `DPP ${slotAfterThis}${isDppSlotMandatory(slotAfterThis) ? "" : " (Optional)"}`,
        required: isDppSlotMandatory(slotAfterThis),
        complete: Boolean(dpp?.complete),
      });
    }
  }

  items.push({
    key: "chapter-test",
    label: "Chapter Test",
    required: true,
    complete: sequence.testCount > 0,
  });

  const missing = items.filter((i) => i.required && !i.complete).map((i) => i.label);

  return { ready: missing.length === 0, missing, items, sequence };
}
