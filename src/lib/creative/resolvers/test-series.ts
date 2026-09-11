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

/** Test-series creative content — assigned educators via TestSeriesTeacher (spec section 7). */
export async function resolveTestSeriesContent(testSeriesId: string): Promise<CreativeContentData | null> {
  const series = await prisma.testSeries.findUnique({
    where: { id: testSeriesId },
    select: {
      name: true,
      examType: true,
      className: true,
      teachers: { select: { teacher: { select: TEACHER_SELECT } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!series) return null;

  return {
    title: series.name,
    educators: series.teachers.map((st) => toCreativeEducator(st.teacher)),
    examOrCourse: series.examType || series.className || undefined,
  };
}
