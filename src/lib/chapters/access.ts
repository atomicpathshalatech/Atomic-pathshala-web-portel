import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Whose chapters can a team member see and edit?
 *
 * - CHAPTER_MANAGE_ALL (Super Admin, or anyone the Super Admin grants it to):
 *   every chapter, read and write.
 * - Everyone else: only their own chapters — ones they created, or ones with
 *   a lecture they teach. Another teacher's chapter is neither listed nor
 *   openable nor editable.
 * - A reviewer (CHAPTER_REVIEW) may additionally READ chapters waiting for
 *   review, so the review queue still works — but not edit them.
 */

const REVIEW_STATUSES = ["SUBMITTED", "UNDER_REVIEW"] as const;

export type ChapterScope = { userId: string; all: boolean; review: boolean };

export async function getChapterScope(userId: string): Promise<ChapterScope> {
  const [all, review] = await Promise.all([
    hasPermission(userId, PERMISSIONS.CHAPTER_MANAGE_ALL),
    hasPermission(userId, PERMISSIONS.CHAPTER_REVIEW),
  ]);
  return { userId, all, review };
}

export function ownChapterWhere(userId: string): Prisma.ChapterWhereInput {
  return { OR: [{ createdById: userId }, { lectures: { some: { teacher: { userId } } } }] };
}

/** The chapters this person may see in lists. */
export function chapterListWhere(scope: ChapterScope): Prisma.ChapterWhereInput {
  if (scope.all) return {};
  if (scope.review) return { OR: [ownChapterWhere(scope.userId), { status: { in: [...REVIEW_STATUSES] } }] };
  return ownChapterWhere(scope.userId);
}

export async function canAccessChapter(scope: ChapterScope, chapterId: string, mode: "read" | "write"): Promise<boolean> {
  if (scope.all) return true;
  const where: Prisma.ChapterWhereInput =
    mode === "read" && scope.review
      ? { id: chapterId, OR: [ownChapterWhere(scope.userId), { status: { in: [...REVIEW_STATUSES] } }] }
      : { id: chapterId, ...ownChapterWhere(scope.userId) };
  return (await prisma.chapter.count({ where })) > 0;
}

/** Throws 403 unless this person may read / edit this chapter. */
export async function assertChapterAccess(userId: string, chapterId: string, mode: "read" | "write") {
  const scope = await getChapterScope(userId);
  if (!(await canAccessChapter(scope, chapterId, mode))) {
    throw new ForbiddenError(
      mode === "write"
        ? "This chapter belongs to another teacher — only its own teacher or a Super Admin can edit it."
        : "This chapter belongs to another teacher."
    );
  }
}
