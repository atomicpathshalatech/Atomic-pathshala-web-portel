import "server-only";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { computeDashboardStats, type DashboardStats } from "@/lib/ai-chat/dashboardStats";

export interface StudyPlanTaskInput {
  date: string; // ISO date (yyyy-mm-dd)
  subject: string;
  description: string;
  taskType: "REVISE" | "PRACTICE" | "TEST" | "CLASS";
}

export interface StudyPlanGeneration {
  summary: string;
  tasks: StudyPlanTaskInput[];
}

export interface ProgressSnapshot {
  stats: DashboardStats;
  planCompletion: { total: number; completed: number } | null;
  planSummary: string | null;
}

/**
 * Everything the coach persona / study-plan generator needs to ground a
 * response in the student's real data — reuses computeDashboardStats()
 * (already built for the student dashboard) rather than re-querying
 * TestAttempt/UsageEvent from scratch, plus the current plan's own
 * completion rate so the coach can talk about "you've done 4 of 7 tasks
 * this week" instead of guessing.
 */
export async function getProgressSnapshot(userId: string): Promise<ProgressSnapshot> {
  const prisma = getPrisma();
  const stats = await computeDashboardStats(userId);

  const plan = await prisma.studyPlan.findUnique({
    where: { userId },
    include: { tasks: true },
  });

  if (!plan) {
    return { stats, planCompletion: null, planSummary: null };
  }

  const completed = plan.tasks.filter((t) => t.completed).length;
  return {
    stats,
    planCompletion: { total: plan.tasks.length, completed },
    planSummary: plan.summary,
  };
}

/** Renders a snapshot into a compact text block both prompts share. */
function formatSnapshotBlock(snapshot: ProgressSnapshot): string {
  const { stats, planCompletion, planSummary } = snapshot;
  const lines = [
    `XP: ${stats.xp} (level ${stats.level})`,
    `Current streak: ${stats.currentStreak} days (longest: ${stats.longestStreak})`,
    `Recent accuracy: ${stats.accuracy !== null ? `${stats.accuracy}%` : "no scored attempts yet"}`,
    `Consistency (active days, last 30): ${stats.consistency}%`,
    stats.favoriteSubject ? `Most-practiced subject: ${stats.favoriteSubject}` : null,
    stats.subjectConfidence.length
      ? `Subject confidence: ${stats.subjectConfidence
          .map((s) => `${s.subject} ${s.confidence}% (${s.attempts} attempts)`)
          .join(", ")}`
      : null,
    stats.weakChapters.length ? `Weak chapters: ${stats.weakChapters.join(", ")}` : null,
    stats.strongChapters.length ? `Strong chapters: ${stats.strongChapters.join(", ")}` : null,
    planCompletion
      ? `Current study plan: ${planCompletion.completed}/${planCompletion.total} tasks completed${
          planSummary ? ` — focus: ${planSummary}` : ""
        }`
      : "No study plan generated yet.",
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

export function buildStudyPlanPrompt(snapshot: ProgressSnapshot, days: number, todayIso: string): string {
  return `Progress snapshot for this student:
${formatSnapshotBlock(snapshot)}

Generate a ${days}-day NEET/JEE study plan starting from ${todayIso} (inclusive). Return ONLY this JSON shape, nothing else:

{
  "summary": "one short sentence on this week's focus, grounded in the snapshot above",
  "tasks": [
    { "date": "YYYY-MM-DD", "subject": "Physics|Chemistry|Biology|Mathematics", "description": "short actionable task", "taskType": "REVISE|PRACTICE|TEST|CLASS" }
  ]
}

Give 1-2 tasks per day (not more), covering a mix of subjects across the ${days} days — weighted toward weak chapters/subjects from the snapshot, lighter on strong ones. Every "date" must be one of the ${days} calendar days starting at ${todayIso}.`;
}

export function buildCoachPrompt(
  snapshot: ProgressSnapshot,
  history: { role: "USER" | "ASSISTANT"; content: string }[],
  newMessage: string
): string {
  const historyBlock = history
    .slice(-10)
    .map((m) => `${m.role === "USER" ? "Student" : "Coach"}: ${m.content}`)
    .join("\n");

  return `Progress snapshot for this student:
${formatSnapshotBlock(snapshot)}
${historyBlock ? `\nRecent conversation:\n${historyBlock}\n` : ""}
Student's new message: ${newMessage}

Reply as the coach, grounded in the snapshot above.`;
}
