import type { Prisma } from "@prisma/client";
import { isSuperAdminUser } from "@/lib/rbac/guard";

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

/**
 * Team views: the owner (Super Admin / Founder) sees recorded lectures and
 * their slots like any other lecture; every other team member never does.
 */
export async function teamRecordedLectureFilter(userId: string | null | undefined): Promise<Prisma.LectureWhereInput> {
  return (await isSuperAdminUser(userId)) ? {} : NOT_RECORDED_LECTURE;
}
export async function teamRecordedSlotFilter(userId: string | null | undefined): Promise<Prisma.BatchScheduleWhereInput> {
  return (await isSuperAdminUser(userId)) ? {} : NOT_RECORDED_SLOT;
}
