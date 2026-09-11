import type { BirthdayCategory } from "@prisma/client";

/**
 * Spec sections 3-5: the highest-priority applicable category, resolved
 * from the subject's actual enrollment data — never guessed from the class
 * number alone. Priority: NEET > JEE > class (9/10/11/12) > board > general.
 * A Class 12 student in a NEET batch gets NEET, not "Class 12 generic".
 */
export type BirthdaySubjectProfile = {
  subjectType: "STUDENT" | "TEACHER";
  /** From the student's active/primary batch first, falling back to their profile's targetExam. */
  targetExam?: string | null;
  class?: string | null;
  board?: string | null;
};

export function resolveBirthdayCategory(profile: BirthdaySubjectProfile): {
  category: BirthdayCategory;
  board: string | null;
} {
  const board = profile.board?.trim() || null;

  if (profile.subjectType === "TEACHER") {
    // The spec's category list (Class 9-12, NEET, JEE) is student-specific;
    // staff get a dedicated template selected by subjectType downstream,
    // not by this category (see lib/birthday/templates.ts).
    return { category: "GENERAL", board: null };
  }

  const exam = (profile.targetExam || "").toUpperCase();
  if (exam.includes("NEET")) return { category: "NEET", board };
  if (exam.includes("JEE")) return { category: "JEE", board };

  const clsDigits = (profile.class || "").replace(/\D/g, "");
  if (clsDigits === "9") return { category: "FOUNDATION9", board };
  if (clsDigits === "10") return { category: "CLASS10", board };
  if (clsDigits === "11") return { category: "CLASS11", board };
  if (clsDigits === "12") return { category: "CLASS12", board };

  if (board) return { category: "BOARD", board };

  return { category: "GENERAL", board: null };
}
