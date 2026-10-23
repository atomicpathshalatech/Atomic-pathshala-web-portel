import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getMasterNcertChapters } from "@/lib/academic/master-ncert-catalog";
import { canonicalChapter, canonicalSubject } from "@/lib/academic/canonical-chapter";
import { chapterQuestionWhere } from "@/lib/questions/chapter-match";

export const metadata: Metadata = { title: "Atomic Question Bank | Atomic Pathshala" };
export const dynamic = "force-dynamic";

const SUBJECTS = ["Physics", "Chemistry", "Biology"] as const;
const PAGE_SIZE = 30;

/** Where a question came from, in two or three words. */
function sourceLabel(category: string | null, tags: string | null) {
  const c = (category ?? "").toUpperCase();
  const t = (tags ?? "").toUpperCase();
  if (c.includes("NEET_PYQ")) return "NEET PYQ";
  if (c.includes("JEE")) return "JEE PYQ";
  if (c.includes("PYQ") || t.includes("PYQ")) return "PYQ";
  if (c.includes("NCERT") || t.includes("NCERT")) return "NCERT";
  if (c.startsWith("AI") || t.includes("AI_GENERATED") || t.includes("ATOMIC_GURU")) return "AI";
  const m = (category ?? "").match(/source:\s*([^|,;]+)/i);
  return m?.[1]?.trim().slice(0, 18) || (category ?? "Manual").slice(0, 18);
}

/**
 * Atomic Question Bank — every approved (PUBLISHED) question, filed by
 * Subject → Chapter → Topic on the standard NCERT chapter list. A question
 * appears here the moment it is approved, whatever its source (NCERT, PYQ,
 * any coaching PDF, AI); approving is the only step.
 */
export default async function AtomicQuestionBankPage({
  searchParams,
}: {
  searchParams?: { subject?: string; chapter?: string; topic?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ))) redirect("/team");

  const subject = SUBJECTS.find((s) => s === canonicalSubject(searchParams?.subject)) ?? null;
  const chapter = subject && searchParams?.chapter ? searchParams.chapter : null;
  const topic = chapter && searchParams?.topic ? searchParams.topic : null;
  const page = Math.max(1, Number(searchParams?.page) || 1);

  const groups = await prisma.question.groupBy({
    by: ["subject", "chapter", "topic"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });

  // subject → chapter → topic → count, on standard names.
  const tree = new Map<string, Map<string, Map<string, number>>>();
  for (const g of groups) {
    const subj = canonicalSubject(g.subject);
    if (!SUBJECTS.includes(subj as (typeof SUBJECTS)[number])) continue;
    const ch = canonicalChapter(subj, g.chapter)?.chapter ?? (g.chapter?.trim() || "Unfiled");
    const tp = g.topic?.trim() || "General";
    const chapters = tree.get(subj) ?? new Map();
    const topics = chapters.get(ch) ?? new Map();
    topics.set(tp, (topics.get(tp) ?? 0) + g._count._all);
    chapters.set(ch, topics);
    tree.set(subj, chapters);
  }
  const sum = (m: Map<string, number> | undefined) => Array.from(m?.values() ?? []).reduce((a, b) => a + b, 0);
  const subjectTotal = (s: string) => Array.from(tree.get(s)?.values() ?? []).reduce((a, m) => a + sum(m), 0);
  const total = SUBJECTS.reduce((a, s) => a + subjectTotal(s), 0);

  const href = (q: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
    const s = p.toString();
    return `/team/questions/atomic${s ? `?${s}` : ""}`;
  };

  // Chapter boxes in NCERT order (Class 11 then 12), then anything outside the list.
  const chapterRows = subject
    ? (() => {
        const have = tree.get(subject) ?? new Map<string, Map<string, number>>();
        const master = getMasterNcertChapters(subject);
        const rows = master.map((m) => ({
          title: m.title,
          label: `${m.classNumber}.${m.chapterNumber}`,
          classNumber: m.classNumber,
          count: sum(have.get(m.title)),
        }));
        for (const [title, topics] of have) {
          if (!master.some((m) => m.title === title)) rows.push({ title, label: "—", classNumber: 0, count: sum(topics) });
        }
        return rows;
      })()
    : [];

  const topics = subject && chapter ? Array.from(tree.get(subject)?.get(chapter)?.entries() ?? []).sort((a, b) => b[1] - a[1]) : [];

  const questions =
    subject && chapter
      ? await prisma.question.findMany({
          where: {
            status: "PUBLISHED",
            AND: [chapterQuestionWhere(subject, chapter)],
            ...(topic ? (topic === "General" ? { OR: [{ topic: null }, { topic: "" }] } : { topic: { equals: topic, mode: "insensitive" as const } }) : {}),
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE + 1,
          select: {
            id: true,
            questionCode: true,
            topic: true,
            difficulty: true,
            category: true,
            tags: true,
            createdBy: { select: { name: true } },
            translations: { select: { language: true, statement: true } },
          },
        })
      : [];
  const hasMore = questions.length > PAGE_SIZE;

  const box = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 hover:shadow-sm transition";

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">Atomic Question Bank</h1>
          <p className="text-[11px] text-slate-500">
            Only approved questions · {total} in all · filed by NCERT chapter and topic, from every source
          </p>
        </div>
        <nav className="flex items-center gap-1 text-xs font-semibold text-slate-500 flex-wrap">
          <Link href={href({})} className="hover:text-blue-600">All subjects</Link>
          {subject && (<><span>/</span><Link href={href({ subject: subject ?? undefined })} className="hover:text-blue-600">{subject}</Link></>)}
          {chapter && (<><span>/</span><Link href={href({ subject, chapter })} className="hover:text-blue-600 truncate max-w-[220px]">{chapter}</Link></>)}
          {topic && (<><span>/</span><span className="text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{topic}</span></>)}
        </nav>
      </header>

      {/* Subjects */}
      <div className="grid grid-cols-3 gap-2">
        {SUBJECTS.map((s) => (
          <Link
            key={s}
            href={href({ subject: s })}
            className={`${box} px-3 py-2.5 flex items-center justify-between ${subject === s ? "border-blue-500 ring-2 ring-blue-500/20" : ""}`}
          >
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">{s}</span>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-md px-1.5">{subjectTotal(s)}</span>
          </Link>
        ))}
      </div>

      {/* Chapters (small boxes) */}
      {subject && !chapter && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {chapterRows.map((c) => (
            <Link
              key={c.title}
              href={href({ subject, chapter: c.title })}
              className={`${box} px-2.5 py-2 flex items-center gap-2 ${c.count === 0 ? "opacity-50" : ""}`}
            >
              <span className="text-[10px] font-mono font-bold text-slate-400 w-8 shrink-0">{c.label}</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">{c.title}</span>
              <span className="text-[10px] font-bold text-slate-500">{c.count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Topics + questions */}
      {subject && chapter && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={href({ subject, chapter })}
              className={`px-2.5 h-7 inline-flex items-center gap-1 rounded-lg text-[11px] font-bold border ${!topic ? "bg-slate-900 text-white border-slate-900" : "bg-white dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700"}`}
            >
              All topics <span className="opacity-70">{topics.reduce((a, [, n]) => a + n, 0)}</span>
            </Link>
            {topics.map(([t, n]) => (
              <Link
                key={t}
                href={href({ subject, chapter, topic: t })}
                className={`px-2.5 h-7 inline-flex items-center gap-1 rounded-lg text-[11px] font-bold border max-w-[240px] ${topic === t ? "bg-slate-900 text-white border-slate-900" : "bg-white dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700 hover:border-blue-400"}`}
              >
                <span className="truncate">{t}</span> <span className="opacity-70">{n}</span>
              </Link>
            ))}
          </div>

          {questions.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">No approved questions here yet.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
              {questions.slice(0, PAGE_SIZE).map((q) => {
                const en = q.translations.find((t) => t.language === "ENGLISH")?.statement;
                const hi = q.translations.find((t) => t.language === "HINDI")?.statement;
                return (
                  <Link key={q.id} href={`/team/questions/${q.id}/review`} className="flex items-start gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300 w-24 shrink-0 pt-0.5 truncate">{q.questionCode || q.id.slice(0, 8)}</span>
                    <span className="flex-1 min-w-0 text-xs text-slate-800 dark:text-slate-200 line-clamp-2">{en || hi || "—"}</span>
                    <span className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-[10px]">
                      <span className="font-bold px-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{sourceLabel(q.category, q.tags)}</span>
                      <span className="text-slate-400">{q.difficulty}{q.createdBy?.name ? ` · ${q.createdBy.name}` : ""}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-between text-xs font-bold">
              {page > 1 ? <Link href={href({ subject, chapter, topic: topic ?? undefined, page: String(page - 1) })} className="text-blue-600">← Previous</Link> : <span />}
              <span className="text-slate-400">Page {page}</span>
              {hasMore ? <Link href={href({ subject, chapter, topic: topic ?? undefined, page: String(page + 1) })} className="text-blue-600">Next →</Link> : <span />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
