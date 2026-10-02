import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DppStatusActions } from "@/components/team-portal/DppStatusActions";
import { DppQuestionPicker } from "@/components/team-portal/DppQuestionPicker";
import { DPP_LEVELS } from "@/lib/dpp/levels";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { DppDetailsEditor } from "@/components/team-portal/DppDetailsEditor";
import { DppBrandSettingsButton } from "@/components/team-portal/DppBrandSettingsButton";
import { dppNumberLabel } from "@/lib/dpp/hierarchy";

export const metadata: Metadata = {
  title: "DPP Detail",
};

export default async function DppDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.DPP_READ);
  if (!canRead) redirect("/team");

  const [canPublish, canUpdate] = await Promise.all([
    hasPermission(session.user.id, PERMISSIONS.DPP_PUBLISH),
    hasPermission(session.user.id, PERMISSIONS.DPP_UPDATE),
  ]);

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
          <p className="text-label-sm text-outline-variant">
            {dpp.code}
            {dpp.dppNumber ? ` · ${dppNumberLabel(dpp)}` : ""}
          </p>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{dpp.name}</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {[dpp.subject, dpp.className, dpp.exam, dpp.chapter, dpp.topic, dpp.subTopic].filter(Boolean).join(" · ")}
            {levelInfo ? ` · Level ${levelInfo.level} — ${levelInfo.title}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href={`/team/dpp/${dpp.id}/author`}
            className="px-4 py-2 rounded-xl bg-[#002f6c] hover:bg-[#001f4c] text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">view_column</span>
            <span>Open Dual-Column Studio</span>
          </Link>
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
          <a
            href={`/api/team/dpp/${dpp.id}/preview?type=questions`}
            target="_blank"
            rel="noopener"
            className="h-8 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold inline-flex items-center gap-1"
            title="See the whole DPP (front page + questions) before downloading"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            Preview
          </a>
          <a
            href={`/api/team/dpp/${dpp.id}/pdf?type=questions`}
            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
            title="Download the DPP question sheet (PDF)"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            DPP PDF
          </a>
          <a
            href={`/api/team/dpp/${dpp.id}/pdf?type=solutions`}
            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
            title="Download the solutions (PDF)"
          >
            Solutions PDF
          </a>
          <a
            href={`/api/team/dpp/${dpp.id}/preview?type=solutions`}
            target="_blank"
            rel="noopener"
            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
            title="Preview the solutions"
          >
            Preview Solutions
          </a>
          {canPublish && <DppBrandSettingsButton />}
        </div>
      </div>

      {/* One plain line of facts */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          ["Questions", `${dpp.questions.length}${dpp.questionTargetCount ? ` / ${dpp.questionTargetCount}` : ""}`],
          ["Time", `${dpp.estimatedTimeMin} min`],
          ["Marking", `+${dpp.correctMarks} / ${dpp.incorrectMarks}`],
          ["Difficulty", dpp.difficulty.toLowerCase()],
          ...(dpp.facultyName ? [["Teacher", dpp.facultyName]] : []),
        ].map(([label, value]) => (
          <span key={label} className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            {label}: <b className="text-slate-900 dark:text-white">{value}</b>
          </span>
        ))}
        {canUpdate && (
          <DppDetailsEditor
            dppId={dpp.id}
            subject={dpp.subject}
            initial={{
              dppNumber: dpp.dppNumber,
              className: dpp.className,
              exam: dpp.exam,
              chapter: dpp.chapter,
              topic: dpp.topic ?? dpp.topics[0] ?? null,
              subTopic: dpp.subTopic,
              facultyName: dpp.facultyName,
            }}
          />
        )}
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
        <h3 className="text-base font-black text-slate-900 dark:text-white mb-3">Questions in this DPP ({dpp.questions.length})</h3>
        {dpp.questions.length === 0 ? (
          <p className="text-sm text-slate-500">No questions yet — add them below.</p>
        ) : (
          <ol className="space-y-3">
            {dpp.questions.map((link, i) => {
              const en =
                link.question.translations.find((t) => t.language === "ENGLISH") ?? link.question.translations[0];
              return (
                <li key={link.id} className="flex gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 text-sm text-slate-900 dark:text-slate-100 [&_img]:max-h-40">
                    <FormulaText text={en?.statement ?? "(no statement)"} />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {link.question.questionCode ? `#${link.question.questionCode} · ` : ""}
                      {String(link.question.difficulty).toLowerCase()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <DppQuestionPicker
        dppId={dpp.id}
        linkedQuestionIds={linkedQuestionIds}
        dppSubject={dpp.subject}
        dppChapter={dpp.chapter}
      />
    </div>
  );
}
