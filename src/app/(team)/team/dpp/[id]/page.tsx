import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DppStatusActions } from "@/components/team-portal/DppStatusActions";
import { DppQuestionPicker } from "@/components/team-portal/DppQuestionPicker";
import { DPP_LEVELS } from "@/lib/dpp/levels";

export const metadata: Metadata = {
  title: "DPP Detail",
};

export default async function DppDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.DPP_READ);
  if (!canRead) redirect("/team");

  const canPublish = await hasPermission(session.user.id, PERMISSIONS.DPP_PUBLISH);

  const dpp = await prisma.dpp.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        include: { question: { include: { translations: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!dpp) notFound();

  const levelInfo = DPP_LEVELS.find((l) => l.level === dpp.level);
  const linkedQuestionIds = dpp.questions.map((q) => q.questionId);

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <p className="text-label-sm text-outline-variant">{dpp.code}</p>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{dpp.name}</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {dpp.subject} · {dpp.chapter}
            {levelInfo ? ` · Level ${levelInfo.level} — ${levelInfo.title}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              dpp.status === "PUBLISHED"
                ? "bg-tertiary-container text-on-tertiary-container"
                : "bg-primary-container text-on-primary-container"
            }`}
          >
            {dpp.status === "PUBLISHED" ? "Published" : "Draft"}
          </span>
          {canPublish && <DppStatusActions dppId={dpp.id} status={dpp.status} />}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Questions</p>
          <p className="text-headline-sm font-headline-sm text-primary">
            {dpp.questions.length} / {dpp.questionTargetCount}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Est. Time</p>
          <p className="text-headline-sm font-headline-sm text-primary">{dpp.estimatedTimeMin} min</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Correct / Incorrect</p>
          <p className="text-headline-sm font-headline-sm text-primary">
            {dpp.correctMarks} / {dpp.incorrectMarks}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Difficulty</p>
          <p className="text-headline-sm font-headline-sm text-primary">{dpp.difficulty}</p>
        </div>
      </div>

      {dpp.topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dpp.topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center bg-primary-container/30 text-primary px-3 py-1 rounded-full text-label-sm"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {dpp.questions.length > 0 && (
        <div className="glass-card rounded-xl p-stack-lg space-y-stack-md">
          <h3 className="font-headline-md text-headline-md text-primary">Questions in this DPP</h3>
          <ol className="space-y-3 list-decimal list-inside">
            {dpp.questions.map((link) => {
              const en =
                link.question.translations.find((t) => t.language === "ENGLISH") ??
                link.question.translations[0];
              return (
                <li key={link.id} className="text-body-md">
                  {en?.statement ?? "(no statement)"}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <DppQuestionPicker dppId={dpp.id} linkedQuestionIds={linkedQuestionIds} />
    </div>
  );
}
