import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { RewardStore } from "@/components/student/RewardStore";
import { STORE_ITEMS } from "@/lib/gamification/store-items";

export const metadata: Metadata = {
  title: "XP Rewards Store & Badges",
};

export default async function RewardsPage() {
  const { student } = await requireStudentSession();

  const freshStudent = await prisma.student.findUnique({
    where: { id: student.id },
    select: { xp: true, level: true, currentStreakDays: true },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <span>Student Portal</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">XP Rewards Store</span>
        </p>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg font-bold text-on-surface">
          Gamification & Rewards Store
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-1">
          Redeem your earned study XP for study boosters, mock test passes, formula sheets, and achievement badges.
        </p>
      </div>

      <RewardStore
        initialXp={freshStudent?.xp ?? student.xp}
        level={freshStudent?.level ?? student.level}
        streak={freshStudent?.currentStreakDays ?? student.currentStreakDays}
        items={STORE_ITEMS}
      />
    </div>
  );
}
