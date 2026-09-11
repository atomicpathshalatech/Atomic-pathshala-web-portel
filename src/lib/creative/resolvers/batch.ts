import "server-only";
import { prisma } from "@/lib/db";
import type { CreativeContentData } from "../content-types";
import { toCreativeEducator } from "./educators";

const TEACHER_SELECT = {
  id: true,
  creativePngUrl: true,
  creativeAssetVersion: true,
  user: { select: { name: true, photoUrl: true } },
} as const;

/** Batch creative content — every currently-assigned educator (spec section 6). */
export async function resolveBatchContent(batchId: string): Promise<CreativeContentData | null> {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      name: true,
      targetExam: true,
      teachers: { select: { teacher: { select: TEACHER_SELECT } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!batch) return null;

  return {
    title: batch.name,
    educators: batch.teachers.map((bt) => toCreativeEducator(bt.teacher)),
    batchName: batch.name,
    examOrCourse: batch.targetExam ?? undefined,
  };
}
