import "server-only";
import { prisma } from "@/lib/db";

function todayKey(now = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

export async function getTodaySpecial(now = new Date()) {
  return prisma.todaySpecial.findFirst({ where: { specialDate: todayKey(now), isActive: true } });
}

/** Section 13: does this Today Special target this subject? No targeting set = all eligible subjects. */
export function todaySpecialTargets(
  special: { targetClass: string | null; targetExam: string | null; targetBoard: string | null; targetBatchId: string | null },
  subject: { class?: string | null; targetExam?: string | null; board?: string | null; activeBatchId?: string | null }
): boolean {
  if (special.targetClass && special.targetClass !== subject.class) return false;
  if (special.targetExam && special.targetExam.toUpperCase() !== (subject.targetExam || "").toUpperCase()) return false;
  if (special.targetBoard && special.targetBoard !== subject.board) return false;
  if (special.targetBatchId && special.targetBatchId !== subject.activeBatchId) return false;
  return true;
}
