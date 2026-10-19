"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadFileToR2 } from "@/lib/storage/upload-client";
import { getMasterNcertChapters } from "@/lib/academic/master-ncert-catalog";
import { api, ApiError, SUBJECTS } from "./api-client";
import { PyqStyles } from "./PyqStyles";

type Exam = { id: string; name: string; canonicalType: string };
type ImportRow = {
  id: string;
  sourceName: string;
  fileName: string;
  status: string;
  progress: number;
  currentStep: string | null;
  extractedCount: number;
  yearMode: string;
  pyqYear: number | null;
  createdAt: string;
  pyqExamRef: { name: string } | null;
  decisions: Record<string, number>;
};

const STATUS_STYLE: Record<string, string> = {
  PROCESSING: "bg-blue-50 text-blue-700",
  NEEDS_OCR: "bg-amber-50 text-amber-700",
  REVIEW_REQUIRED: "bg-violet-50 text-violet-700",
  FAILED: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function PyqImportForm() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [examId, setExamId] = useState("");
  const [customExam, setCustomExam] = useState("");
  const [ambiguous, setAmbiguous] = useState<{ id: string; name: string }[] | null>(null);
  const [yearMode, setYearMode] = useState<"SINGLE" | "MULTI">("SINGLE");
  const [year, setYear] = useState("");
  const [session, setSession] = useState("");
  const [shift, setShift] = useState("");
  const [paper, setPaper] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [language, setLanguage] = useState("ENGLISH");
  const [hasAnswerKey, setHasAnswerKey] = useState<"" | "yes" | "no">("");
  const [hasSolutions, setHasSolutions] = useState<"" | "yes" | "no">("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ exams: Exam[] }>("/api/team/pyq/exams?verification=ALL").then((d) => setExams(d.exams)).catch((e) => toast.error(e.message));
    api<{ imports: ImportRow[] }>("/api/team/pyq/imports").then((d) => setImports(d.imports)).catch(() => undefined);
  }, []);

  async function resolveCustomExam(name: string): Promise<string | null> {
    try {
      const { exam } = await api<{ exam: Exam }>("/api/team/pyq/exams", { method: "POST", json: { name } });
      setExams((list) => (list.some((e) => e.id === exam.id) ? list : [...list, exam]));
      setExamId(exam.id);
      setCustomExam("");
      return exam.id;
    } catch (e) {
      if (e instanceof ApiError && e.code === "AMBIGUOUS_EXAM") {
        setAmbiguous((e.details?.candidates as { id: string; name: string }[]) ?? []);
        toast.warning(e.message);
        return null;
      }
      throw e;
    }
  }

  async function start() {
    try {
      if (!file) throw new Error("Choose the PDF.");
      if (file.type && file.type !== "application/pdf") throw new Error("Only PDF files can be imported.");
      let exam = examId;
      if (!exam && customExam.trim()) {
        setBusy("Checking the exam name…");
        const id = await resolveCustomExam(customExam.trim());
        if (!id) return;
        exam = id;
      }
      if (!exam) throw new Error("Choose the exam (or type a new exam name).");
      if (yearMode === "SINGLE" && !/^\d{4}$/.test(year)) throw new Error("Enter the paper's year, or choose 'Several years in one PDF'.");
      if (sourceTitle.trim().length < 2) throw new Error("Give the source a title (e.g. NEET 2024 official paper).");

      setBusy("Uploading PDF… 0%");
      const uploaded = await uploadFileToR2(file, { prefix: "pdf", fileType: "PDF", visibility: "PUBLIC", onProgress: (p) => setBusy(`Uploading PDF… ${p}%`) });
      setBusy("Reading pages and planning the import…");
      const { job } = await api<{ job: { id: string } }>("/api/team/pyq/imports", {
        method: "POST",
        json: {
          fileAssetId: uploaded.fileAssetId,
          examId: exam,
          yearMode,
          year: yearMode === "SINGLE" ? Number(year) : year ? Number(year) : null,
          session: session || null,
          shift: shift || null,
          paper: paper || null,
          subject: subject || null,
          chapter: chapter || null,
          language,
          hasAnswerKey: hasAnswerKey ? hasAnswerKey === "yes" : null,
          hasSolutions: hasSolutions ? hasSolutions === "yes" : null,
          sourceTitle: sourceTitle.trim(),
          sourceReference: sourceReference.trim() || null,
        },
      });
      toast.success("Import started.");
      router.push(`/team/pyq-library/import/${job.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  const chapters = subject ? getMasterNcertChapters(subject) : [];

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <PyqStyles />
      <section className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-sm">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">Import PYQ PDF</h1>
          <p className="text-xs text-slate-500">
            Upload a full paper, a multi-year collection, a subject- or chapter-wise set, or a scanned paper. Every extracted question waits for review before it reaches the PYQ Library.
          </p>
        </div>

        <label className="block">
          <span className="font-bold text-xs text-slate-500">PDF file</span>
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block mt-1 text-xs" />
          {file && <span className="text-[11px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Exam</span>
            <select value={examId} onChange={(e) => (setExamId(e.target.value), setAmbiguous(null))} className="pyq-input">
              <option value="">— choose or type a new exam below —</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">…or a new exam name</span>
            <input value={customExam} onChange={(e) => (setCustomExam(e.target.value), setExamId(""), setAmbiguous(null))} placeholder="e.g. IUPSC, AIIMS, KVPY" className="pyq-input" />
          </label>
        </div>
        {ambiguous && (
          <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs space-y-2">
            <p className="font-bold">“{customExam}” could mean more than one exam. Which one?</p>
            <div className="flex gap-2 flex-wrap">
              {ambiguous.map((c) => (
                <button key={c.id} type="button" className="pyq-btn bg-white" onClick={() => (setExamId(c.id), setCustomExam(""), setAmbiguous(null))}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="font-bold text-xs text-slate-500">Years in this PDF</legend>
          <label className="flex items-center gap-2 text-xs">
            <input type="radio" checked={yearMode === "SINGLE"} onChange={() => setYearMode("SINGLE")} /> One exam sitting (e.g. the NEET 2024 paper) — every question gets this year
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="radio" checked={yearMode === "MULTI"} onChange={() => setYearMode("MULTI")} /> Several years in one PDF — the year is read from each section heading / question tag; anything unclear goes to review
          </label>
        </fieldset>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Year {yearMode === "MULTI" ? "(not used)" : ""}</span>
            <input value={year} disabled={yearMode === "MULTI"} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2024" className="pyq-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Session</span>
            <input value={session} onChange={(e) => setSession(e.target.value)} placeholder="January" className="pyq-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Shift</span>
            <input value={shift} onChange={(e) => setShift(e.target.value)} placeholder="Shift 1" className="pyq-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Paper / set</span>
            <input value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="Paper 1" className="pyq-input" />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Subject (blank = detect per question)</span>
            <select value={subject} onChange={(e) => (setSubject(e.target.value), setChapter(""))} className="pyq-input">
              <option value="">Mixed / detect</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Chapter (only for a chapter-wise PDF)</span>
            <select value={chapter} disabled={!subject} onChange={(e) => setChapter(e.target.value)} className="pyq-input">
              <option value="">Classify each question</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.title}>
                  {c.displayTitle}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Language</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="pyq-input">
              <option value="ENGLISH">English</option>
              <option value="HINDI">Hindi</option>
              <option value="BILINGUAL">Hindi + English</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Answer key inside?</span>
            <select value={hasAnswerKey} onChange={(e) => setHasAnswerKey(e.target.value as any)} className="pyq-input">
              <option value="">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Solutions inside?</span>
            <select value={hasSolutions} onChange={(e) => setHasSolutions(e.target.value as any)} className="pyq-input">
              <option value="">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Source title</span>
            <input value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} placeholder="NEET 2024 official paper (Code Q2)" className="pyq-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs text-slate-500">Source reference (optional)</span>
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="NTA website / book name & edition" className="pyq-input" />
          </label>
        </div>

        <button type="button" disabled={Boolean(busy)} onClick={start} className="pyq-btn-primary w-full py-2">
          {busy ?? "Upload & start import"}
        </button>
      </section>

      <section className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-slate-900 dark:text-white text-sm">Imports</h2>
          <Link href="/team/pyq-library" className="font-bold text-blue-600">
            Open PYQ Library
          </Link>
        </div>
        {imports.length === 0 && <p className="text-slate-500">No PYQ imports yet.</p>}
        {imports.map((j) => (
          <Link key={j.id} href={`/team/pyq-library/import/${j.id}`} className="block p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-300">
            <div className="flex items-center gap-2">
              <span className="font-bold truncate">{j.sourceName}</span>
              <span className={`ml-auto px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[j.status] ?? "bg-slate-100 text-slate-600"}`}>{j.status.replace(/_/g, " ").toLowerCase()}</span>
            </div>
            <p className="text-slate-500 mt-1">
              {j.pyqExamRef?.name ?? "—"} · {j.yearMode === "MULTI" ? "multi-year" : j.pyqYear} · {j.extractedCount} extracted · {j.decisions.APPROVED ?? 0} approved · {j.decisions.PENDING ?? 0} pending
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
