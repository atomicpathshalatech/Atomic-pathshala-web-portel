"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, PlayCircle, FileText, ClipboardCheck, ArrowUpRight, BookOpen } from "lucide-react";

export type ChapterCard = {
  id: string;
  code: string | null;
  title: string;
  medium: string;
  status: string;
  updatedAt: string;
  subjectId: string;
  subjectTitle: string;
  courseId: string;
  courseTitle: string;
  lectures: number;
  dpps: number;
  tests: number;
  teachers: { id: string; name: string; photo: string | null }[];
};

const STATUS_LABEL: Record<string, { label: string; dot: string; text: string }> = {
  DRAFT: { label: "Draft", dot: "bg-slate-400", text: "text-slate-500 dark:text-slate-400" },
  LECTURES_IN_PROGRESS: { label: "In progress", dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  LECTURES_COMPLETE: { label: "Lectures done", dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  TESTS_PENDING: { label: "Tests pending", dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  READY_TO_PUBLISH: { label: "Ready", dot: "bg-cyan-500", text: "text-cyan-600 dark:text-cyan-400" },
  SUBMITTED: { label: "Submitted", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  UNDER_REVIEW: { label: "Under review", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  APPROVED: { label: "Approved", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  PUBLISHED: { label: "Published", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  REJECTED: { label: "Rejected", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  CHANGES_REQUESTED: { label: "Changes requested", dot: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  ARCHIVED: { label: "Archived", dot: "bg-slate-300", text: "text-slate-400" },
};

// A steady colour per subject so the same subject always looks the same.
const SUBJECT_TONES = [
  "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300",
];
function subjectTone(title: string) {
  const t = title.toLowerCase();
  if (t.includes("phys")) return SUBJECT_TONES[0]!;
  if (t.includes("chem")) return SUBJECT_TONES[3]!;
  if (t.includes("bio") || t.includes("bot") || t.includes("zoo")) return SUBJECT_TONES[1]!;
  if (t.includes("math")) return SUBJECT_TONES[2]!;
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SUBJECT_TONES[h % SUBJECT_TONES.length]!;
}

const TABS = [
  { key: "", label: "All" },
  { key: "UNDER_REVIEW", label: "Review queue", reviewOnly: true },
  { key: "APPROVED", label: "Approved" },
  { key: "DRAFT", label: "In authoring" },
] as const;

function inTab(status: string, tab: string) {
  if (!tab) return true;
  if (tab === "APPROVED") return status === "APPROVED" || status === "PUBLISHED";
  if (tab === "UNDER_REVIEW") return status === "UNDER_REVIEW" || status === "SUBMITTED";
  if (tab === "DRAFT") return !["APPROVED", "PUBLISHED", "UNDER_REVIEW", "SUBMITTED", "ARCHIVED"].includes(status);
  return status === tab;
}

export function ChaptersBoard({
  chapters,
  canReview,
  canCreate,
  initial,
}: {
  chapters: ChapterCard[];
  canReview: boolean;
  canCreate: boolean;
  initial: { status: string; subject: string; teacher: string; q: string };
}) {
  const [tab, setTab] = useState(initial.status === "PUBLISHED" ? "APPROVED" : initial.status);
  const [q, setQ] = useState(initial.q);
  const [subject, setSubject] = useState(initial.subject);
  const [teacher, setTeacher] = useState(initial.teacher);
  const [course, setCourse] = useState("");
  const [medium, setMedium] = useState("");

  const options = useMemo(() => {
    const subjects = new Map<string, string>();
    const teachers = new Map<string, string>();
    const courses = new Map<string, string>();
    for (const c of chapters) {
      if (c.subjectId) subjects.set(c.subjectId, c.subjectTitle);
      if (c.courseId) courses.set(c.courseId, c.courseTitle);
      for (const t of c.teachers) teachers.set(t.id, t.name);
    }
    const sorted = (m: Map<string, string>) => Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    return { subjects: sorted(subjects), teachers: sorted(teachers), courses: sorted(courses) };
  }, [chapters]);

  const needle = q.trim().toLowerCase();
  const filtered = chapters.filter(
    (c) =>
      inTab(c.status, tab) &&
      (!subject || c.subjectId === subject || c.subjectTitle.toLowerCase() === subject.toLowerCase()) &&
      (!teacher || c.teachers.some((t) => t.id === teacher)) &&
      (!course || c.courseId === course) &&
      (!medium || c.medium === medium) &&
      (!needle ||
        c.title.toLowerCase().includes(needle) ||
        (c.code ?? "").includes(needle) ||
        c.teachers.some((t) => t.name.toLowerCase().includes(needle)) ||
        c.subjectTitle.toLowerCase().includes(needle))
  );

  const counts = Object.fromEntries(TABS.map((t) => [t.key, chapters.filter((c) => inTab(c.status, t.key)).length]));
  const anyFilter = !!(q || subject || teacher || course || medium);

  const select =
    "h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 min-w-0";

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.filter((t) => !("reviewOnly" in t) || canReview).map((t) => {
          const active = tab === t.key;
          const n = counts[t.key] ?? 0;
          return (
            <button
              key={t.key || "all"}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative -mb-px inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
                active
                  ? "border-blue-600 text-blue-700 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
              <span
                className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold inline-flex items-center justify-center tabular-nums ${
                  t.key === "UNDER_REVIEW" && n > 0
                    ? "bg-amber-500 text-white"
                    : active
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chapter, code or teacher"
            className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </label>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className={select} aria-label="Subject">
          <option value="">All subjects</option>
          {options.subjects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className={select} aria-label="Teacher">
          <option value="">All teachers</option>
          {options.teachers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {options.courses.length > 1 && (
          <select value={course} onChange={(e) => setCourse(e.target.value)} className={select} aria-label="Course">
            <option value="">All courses</option>
            {options.courses.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <select value={medium} onChange={(e) => setMedium(e.target.value)} className={select} aria-label="Medium">
          <option value="">Any medium</option>
          <option value="ENGLISH">English</option>
          <option value="HINDI">Hindi</option>
          <option value="HINGLISH">Hinglish</option>
        </select>
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setSubject("");
              setTeacher("");
              setCourse("");
              setMedium("");
            }}
            className="inline-flex items-center gap-1 h-9 px-2.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
          {filtered.length} of {chapters.length}
        </span>
      </div>

      {/* Chapter boxes */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-14 text-center">
          <BookOpen className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {chapters.length === 0 ? "No chapters yet" : "No chapter matches these filters"}
          </p>
          {chapters.length === 0 && canCreate && (
            <Link href="/team/chapters/new" className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline">
              Create the first chapter
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status.replaceAll("_", " ").toLowerCase(), dot: "bg-slate-400", text: "text-slate-500" };
            const lead = c.teachers[0];
            const review = canReview && (c.status === "UNDER_REVIEW" || c.status === "SUBMITTED");
            return (
              <Link
                key={c.id}
                href={`/team/chapters/${c.id}`}
                className="group flex flex-col rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md hover:shadow-blue-500/5 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${subjectTone(c.subjectTitle)}`}>{c.subjectTitle}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>

                <h3 className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                  {c.title}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                  {[c.courseTitle, c.medium.charAt(0) + c.medium.slice(1).toLowerCase(), c.code ? `#${c.code}` : null].filter(Boolean).join(" · ")}
                </p>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <PlayCircle className="w-3.5 h-3.5 text-slate-400" />
                    {c.lectures} lec
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    {c.dpps} DPP
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ClipboardCheck className="w-3.5 h-3.5 text-slate-400" />
                    {c.tests} test
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-500">
                      {lead?.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={lead.photo} alt="" className="w-full h-full object-cover object-top" />
                      ) : (
                        (lead?.name ?? "?").charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {lead ? lead.name : "No teacher yet"}
                      {c.teachers.length > 1 && <span className="text-slate-400"> +{c.teachers.length - 1}</span>}
                    </span>
                  </div>
                  {review ? (
                    <span className="shrink-0 h-7 px-2.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold inline-flex items-center">Review</span>
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0 transition" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
