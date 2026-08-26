import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { LeaderboardBoard } from "@/components/student/LeaderboardBoard";

export const metadata: Metadata = {
  title: "Leaderboard",
};

// Data is fetched client-side by LeaderboardBoard (from the existing
// GET /api/student/leaderboard?window=7d|all) so the window toggle can
// re-fetch without a full page reload. requireStudentSession here is only
// route protection, matching every other (student) page — the API route
// re-checks the session itself too.
export default async function LeaderboardPage() {
  await requireStudentSession();

  return (
    <div className="max-w-3xl mx-auto space-y-stack-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Leaderboard</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Ranked by real XP — earned from live classes, tests, and DPPs as those get wired in.
        </p>
      </div>
      <LeaderboardBoard />
    </div>
  );
}
