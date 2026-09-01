import "server-only";
import { prisma } from "@/lib/db";

/**
 * Lecture-driven DPP progression, per the Chapter Management System spec:
 * "Level-1 DPP count = FLOOR(completed lectures / 2)" and a lecture stays
 * locked until the DPP it unlocked has been submitted.
 *
 * Modeled as a function of a lecture's ORDINAL POSITION within its chapter
 * (1-indexed among PUBLISHED lectures, same ordering the student-facing
 * chapter page already uses), not of which specific lectures the student
 * has personally watched — position N requires FLOOR((N-1)/2) Level-1 DPPs
 * submitted for this chapter. This keeps the rule deterministic and
 * unaffected by re-watching or watch order, while still matching the
 * formula literally: after completing lectures 1-2, one DPP unlocks and
 * gates lecture 3; after 3-4, a second DPP gates lecture 5; and so on.
 */
export function requiredDppCountForPosition(position: number): number {
  return Math.floor(Math.max(0, position - 1) / 2);
}

/** How many DISTINCT Level-1 DPPs under this chapter has the student
 * submitted (SUBMITTED or AUTO_SUBMITTED, not just started)? */
export async function getSubmittedLevel1DppCount(studentId: string, chapterId: string): Promise<number> {
  const submitted = await prisma.attempt.findMany({
    where: {
      studentId,
      status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      dpp: { chapterId, level: 1 },
    },
    select: { dppId: true },
    distinct: ["dppId"],
  });
  return submitted.length;
}

export type LectureAccess = {
  unlocked: boolean;
  requiredDppCount: number;
  submittedDppCount: number;
};

/** The single check every lecture-serving route/page should go through —
 * both the student-facing lecture player and any future API that streams
 * lecture content. */
export async function checkLectureAccess(
  studentId: string,
  chapterId: string,
  lecturePosition: number
): Promise<LectureAccess> {
  const requiredDppCount = requiredDppCountForPosition(lecturePosition);
  if (requiredDppCount === 0) {
    return { unlocked: true, requiredDppCount: 0, submittedDppCount: 0 };
  }
  const submittedDppCount = await getSubmittedLevel1DppCount(studentId, chapterId);
  return { unlocked: submittedDppCount >= requiredDppCount, requiredDppCount, submittedDppCount };
}
