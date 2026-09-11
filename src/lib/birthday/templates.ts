import "server-only";
import { prisma } from "@/lib/db";
import type { BirthdayCategory } from "@prisma/client";

/**
 * Section 22 fallback chain: board-specific template for this exact
 * category -> plain category template -> GENERAL. Never returns nothing —
 * DEFAULT_BIRTHDAY_TEMPLATES (seeded, see prisma/seed.ts) guarantees a
 * GENERAL template always exists.
 */
export async function pickBirthdayTemplate(
  category: BirthdayCategory,
  board: string | null,
  isStaff: boolean
): Promise<{ id: string; messageText: string; usedFallback: boolean }> {
  // Staff get their own message pool — a GENERAL-category template whose
  // name marks it for staff, kept separate from the student GENERAL
  // template without needing a distinct enum value.
  if (isStaff) {
    const staffTemplate = await prisma.birthdayTemplate.findFirst({
      where: { category: "GENERAL", isActive: true, name: { contains: "Staff", mode: "insensitive" } },
      orderBy: { priority: "desc" },
    });
    if (staffTemplate) return { id: staffTemplate.id, messageText: staffTemplate.messageText, usedFallback: false };
    // No staff-specific template configured yet — fall through to the
    // general pool rather than sending nothing.
  }

  if (board) {
    const boardMatch = await prisma.birthdayTemplate.findFirst({
      where: { category, board, isActive: true },
      orderBy: { priority: "desc" },
    });
    if (boardMatch) return { id: boardMatch.id, messageText: boardMatch.messageText, usedFallback: false };
  }

  const categoryMatch = await prisma.birthdayTemplate.findFirst({
    where: { category, board: null, isActive: true },
    orderBy: { priority: "desc" },
  });
  if (categoryMatch) {
    return { id: categoryMatch.id, messageText: categoryMatch.messageText, usedFallback: category !== "GENERAL" ? false : false };
  }

  const generalCandidates = await prisma.birthdayTemplate.findMany({
    where: { category: "GENERAL", isActive: true },
    orderBy: { priority: "desc" },
  });
  const generalMatch = generalCandidates.find((t) => !t.name.toLowerCase().includes("staff"));
  if (generalMatch) return { id: generalMatch.id, messageText: generalMatch.messageText, usedFallback: true };

  throw new Error(
    `No active birthday template available (category=${category}, board=${board ?? "none"}) — not even a GENERAL fallback. Seed one in /team/communication/birthday/templates.`
  );
}

/**
 * Section 9-10: a random active creative for the category, avoiding the
 * last N creatives already used for THIS subject when enough alternatives
 * exist (so the same student doesn't get the identical image every year).
 */
export async function pickBirthdayCreative(
  category: BirthdayCategory,
  subjectType: string,
  subjectId: string,
  avoidLastN = 3
): Promise<{ id: string; imageUrl: string } | null> {
  const pool = await prisma.birthdayCreative.findMany({
    where: { category, isActive: true },
    select: { id: true, imageUrl: true },
  });
  if (pool.length === 0) return null;

  const recent = await prisma.birthdaySendLog.findMany({
    where: { subjectType, subjectId, creativeId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: avoidLastN,
    select: { creativeId: true },
  });
  const recentIds = new Set(recent.map((r) => r.creativeId).filter(Boolean));

  const eligible = pool.filter((c) => !recentIds.has(c.id));
  const chooseFrom = eligible.length > 0 ? eligible : pool; // not enough alternatives — repeats allowed rather than skipping the creative entirely

  const pick = chooseFrom[Math.floor(Math.random() * chooseFrom.length)]!;

  await prisma.birthdayCreative
    .update({ where: { id: pick.id }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } })
    .catch(() => {});

  return pick;
}
