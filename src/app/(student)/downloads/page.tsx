import type { Metadata } from "next";
import Link from "next/link";
import type { StudyMaterialClassExam } from "@prisma/client";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatBytes } from "@/lib/study-material";

export const metadata: Metadata = {
  title: "Downloads — Atomic Pathshala",
};

function deriveClassExams(targetExams: (string | null | undefined)[]): StudyMaterialClassExam[] {
  const set = new Set<StudyMaterialClassExam>();
  for (const raw of targetExams) {
    const t = (raw || "").toLowerCase();
    if (t.includes("neet")) set.add("NEET");
    if (t.includes("jee")) set.add("JEE");
    if (t.includes("12")) set.add("CLASS_12");
    if (t.includes("11")) set.add("CLASS_11");
  }
  return set.size ? [...set] : ["NEET", "JEE", "CLASS_11", "CLASS_12"];
}

type Row = {
  id: string;
  title: string;
  subject: string;
  chapterTitle: string;
  type: string;
  sizeBytes: number;
};

/**
 * The student's downloadable files — every published study-material PDF in
 * their scope that the uploader left `allowDownload` on. Saving them here
 * gives an offline-first "my downloads" list distinct from the in-app
 * Study Material reader.
 */
export default async function StudentDownloadsPage() {
  const { student } = await requireStudentSession();

  let rows: Row[] = [];
  try {
    const enrolments = await prisma.batchEnrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      select: { batch: { select: { targetExam: true } } },
    });
    const allowed = deriveClassExams(enrolments.map((e) => e.batch?.targetExam));
    rows = await prisma.studyMaterial.findMany({
      where: { isPublished: true, allowDownload: true, classExam: { in: allowed } },
      orderBy: [{ subject: "asc" }, { chapterTitle: "asc" }, { title: "asc" }],
      select: { id: true, title: true, subject: true, chapterTitle: true, type: true, sizeBytes: true },
      take: 300,
    });
  } catch (e) {
    console.error("[downloads] load failed:", e instanceof Error ? e.message : e);
    rows = [];
  }

  const bySubject = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.subject] ||= []).push(r);
    return acc;
  }, {});
  const subjects = Object.keys(bySubject).sort();

  return (
    <div className="mx-auto max-w-2xl space-y-5 lg:max-w-4xl">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Downloads</h1>
          <p className="text-xs text-slate-500">Save your study PDFs for offline use.</p>
        </div>
        <Link href="/study-material" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
          Browse all
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-slate-300">cloud_download</span>
          <p className="mt-2 text-sm font-medium text-slate-500">No downloadable files yet</p>
          <p className="text-xs text-slate-400">
            Your teachers&apos; notes, formula sheets and NCERT PDFs will show up here.
          </p>
        </div>
      ) : (
        subjects.map((subject) => (
          <section key={subject} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-900">
              {subject}
              <span className="ml-2 text-xs font-mono text-slate-400">{bySubject[subject]!.length}</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {bySubject[subject]!.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="material-symbols-outlined shrink-0 text-xl text-red-500">picture_as_pdf</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{m.title}</p>
                    <p className="truncate text-[11px] text-slate-400">
                      {m.chapterTitle} · {formatBytes(m.sizeBytes)}
                    </p>
                  </div>
                  <a
                    href={`/api/study-material/${m.id}/file?download=1`}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Save
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
