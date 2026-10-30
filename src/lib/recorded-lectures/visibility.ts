import type { Prisma } from "@prisma/client";

/**
 * Recorded lectures are private: outside their own pages (team Recorded
 * Lectures — Super Admin only — and the chosen students' views) they are
 * left out of every list: team chapter lectures, batch timetables, team
 * dashboards. Add these to such queries.
 */

/** A lecture that is not a recorded lecture. */
export const NOT_RECORDED_LECTURE: Prisma.LectureWhereInput = { recordedMedia: { is: null } };

/** A class slot that is not a scheduled recorded lecture (classMode is nullable: NULL must stay in). */
export const NOT_RECORDED_SLOT: Prisma.BatchScheduleWhereInput = { OR: [{ classMode: null }, { classMode: { not: "RECORDED" } }] };
