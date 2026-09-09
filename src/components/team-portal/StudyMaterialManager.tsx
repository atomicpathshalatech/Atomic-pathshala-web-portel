"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  StudyMaterialType,
  StudyMaterialClassExam,
  StudyMaterialLanguage,
} from "@prisma/client";
import {
  CLASS_EXAMS,
  LANGUAGES,
  SUBJECTS_FOR_CLASS_EXAM,
  chaptersForClassExam,
  moduleTypesForClassExam,
  validateModuleInput,
  formatBytes,
} from "@/lib/study-material";

type Material = {
  id: string;
  type: StudyMaterialType;
  title: string;
  fileName: string;
  sizeBytes: number;
  allowDownload: boolean;
  isPublished: boolean;
  language: StudyMaterialLanguage;
};

const CUSTOM = "__custom__";

export function StudyMaterialManager() {
  const [classExam, setClassExam] = useState<StudyMaterialClassExam | "">("");
  const [subject, setSubject] = useState("");
  const [chapterSel, setChapterSel] = useState(""); // ncertChapterId | CUSTOM | ""
  const [customName, setCustomName] = useState("");
  const [language, setLanguage] = useState<StudyMaterialLanguage>("ENGLISH");

  const subjects = classExam ? SUBJECTS_FOR_CLASS_EXAM[classExam] : [];
  const chapters = useMemo(
    () => (classExam && subject ? chaptersForClassExam(classExam, subject) : []),
    [classExam, subject]
  );
  const types = moduleTypesForClassExam(classExam || null);

  // Reset cascade
  useEffect(() => {
    if (classExam && subject && !SUBJECTS_FOR_CLASS_EXAM[classExam].includes(subject)) {
      setSubject("");
    }
    setChapterSel("");
    setCustomName("");
  }, [classExam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setChapterSel("");
    setCustomName("");
  }, [subject]);

  const isCustom = chapterSel === CUSTOM;
  const chapter = chapters.find((c) => c.ncertChapterId === chapterSel);
  const chapterTitle = isCustom ? customName.trim() : chapter?.label ?? "";
  const chapterClass = isCustom ? null : chapter?.chapterClass ?? null;

  const ready =
    !!classExam && !!subject && (isCustom ? !!customName.trim() : !!chapterSel) && !!language;

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ready) {
      setMaterials([]);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ classExam: classExam as string, subject, language });
      if (isCustom) {
        q.set("custom", "1");
        q.set("chapterTitle", customName.trim());
      } else {
        q.set("ncertChapterId", chapterSel);
      }
      const res = await fetch(`/api/team/study-material?${q}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load.");
      setMaterials(json.data.materials);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [ready, classExam, subject, language, isCustom, chapterSel, customName]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, data: Partial<Pick<Material, "allowDownload" | "isPublished">>) {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
    try {
      const res = await fetch(`/api/team/study-material/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Update failed.");
      load();
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this PDF? Students will no longer see it.")) return;
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/team/study-material/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removed");
    } catch {
      toast.error("Delete failed.");
      load();
    }
  }

  const selectCls =
    "mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-semibold disabled:opacity-50";

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Study Material</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Class/Exam → Subject → Chapter → Language → Module Type → PDF. Chapters come from the NCERT
          syllabus; NEET &amp; JEE combine Class 11 + 12.
        </p>
      </header>

      {/* Step 1–4 pickers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Class / Exam *</span>
          <select value={classExam} onChange={(e) => setClassExam(e.target.value as never)} className={selectCls}>
            <option value="">Select…</option>
            {CLASS_EXAMS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Subject *</span>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!classExam}
            className={selectCls}
          >
            <option value="">{classExam ? "Select…" : "Pick Class/Exam first"}</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chapter *</span>
          <select
            value={chapterSel}
            onChange={(e) => setChapterSel(e.target.value)}
            disabled={!subject}
            className={selectCls}
          >
            <option value="">{subject ? "Select…" : "Pick Subject first"}</option>
            {chapters.map((c) => (
              <option key={c.ncertChapterId} value={c.ncertChapterId}>
                {c.label}
              </option>
            ))}
            <option value={CUSTOM}>+ Add Custom Chapter</option>
          </select>
          {isCustom && (
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Custom chapter name"
              className="mt-2 w-full rounded-lg border border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-sm"
            />
          )}
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Language *</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as never)}
            className={selectCls}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!ready ? (
        <p className="text-sm text-slate-500">
          Complete Class/Exam, Subject, Chapter and Language to manage modules for that combination.
        </p>
      ) : (
        <div className="space-y-4">
          {types.map((t) => (
            <TypeSection
              key={t.value}
              type={t.value}
              label={t.label}
              icon={t.icon}
              items={materials.filter((m) => m.type === t.value)}
              loading={loading}
              onAdded={load}
              onPatch={patch}
              onRemove={remove}
              ctx={{
                classExam: classExam as StudyMaterialClassExam,
                subject,
                ncertChapterId: isCustom ? null : chapterSel,
                chapterTitle,
                chapterClass,
                isCustomChapter: isCustom,
                language,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Ctx = {
  classExam: StudyMaterialClassExam;
  subject: string;
  ncertChapterId: string | null;
  chapterTitle: string;
  chapterClass: number | null;
  isCustomChapter: boolean;
  language: StudyMaterialLanguage;
};

function TypeSection({
  type,
  label,
  icon,
  items,
  loading,
  onAdded,
  onPatch,
  onRemove,
  ctx,
}: {
  type: StudyMaterialType;
  label: string;
  icon: string;
  items: Material[];
  loading: boolean;
  onAdded: () => void;
  onPatch: (id: string, d: Partial<Pick<Material, "allowDownload" | "isPublished">>) => void;
  onRemove: (id: string) => void;
  ctx: Ctx;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a PDF file.");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return toast.error("Only PDF files are allowed.");
    }
    const payload = {
      ...ctx,
      type,
      title: title.trim() || file.name.replace(/\.pdf$/i, ""),
      fileUrl: "pending",
      fileName: file.name,
    };
    const clientErr = validateModuleInput(payload);
    if (clientErr) return toast.error(clientErr);

    setBusy(true);
    setProgress(5);
    try {
      const { uploadFileToR2 } = await import("@/lib/storage/upload-client");
      const up = await uploadFileToR2(file, {
        prefix: "documents",
        fileType: "PDF",
        subPath: `study-material/${ctx.classExam}/${ctx.subject}`,
        visibility: "PROTECTED",
        onProgress: setProgress,
      });
      const res = await fetch("/api/team/study-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ctx,
          type,
          title: payload.title,
          fileUrl: up.fileAssetId,
          fileName: file.name,
          sizeBytes: up.sizeBytes,
          mimeType: "application/pdf",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Save failed.");
      toast.success(`${label} added`);
      setTitle("");
      setAdding(false);
      if (fileRef.current) fileRef.current.value = "";
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
          <span className="material-symbols-outlined text-blue-600 text-xl">{icon}</span>
          {label}
          <span className="ml-1 text-xs font-mono text-slate-400">{items.length}</span>
        </h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 transition"
        >
          <span className="material-symbols-outlined text-sm">{adding ? "close" : "add"}</span>
          {adding ? "Cancel" : "Add PDF"}
        </button>
      </div>

      {adding && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional — file name used if blank)"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white file:text-xs file:font-bold"
          />
          {busy && (
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold px-4 py-2 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      )}

      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {loading && items.length === 0 ? (
          <li className="px-4 py-3 text-xs text-slate-400">Loading…</li>
        ) : items.length === 0 ? (
          <li className="px-4 py-3 text-xs text-slate-400">Nothing uploaded yet.</li>
        ) : (
          items.map((m) => (
            <li key={m.id} className="px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-red-500 text-xl shrink-0">picture_as_pdf</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.title}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {m.fileName} · {formatBytes(m.sizeBytes)}
                </p>
              </div>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                <input
                  type="checkbox"
                  checked={m.allowDownload}
                  onChange={(e) => onPatch(m.id, { allowDownload: e.target.checked })}
                />
                Downloadable
              </label>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                <input
                  type="checkbox"
                  checked={m.isPublished}
                  onChange={(e) => onPatch(m.id, { isPublished: e.target.checked })}
                />
                Published
              </label>
              <button
                type="button"
                onClick={() => onRemove(m.id)}
                className="text-slate-400 hover:text-red-600 shrink-0"
                aria-label="Remove"
              >
                <span className="material-symbols-outlined text-xl">delete</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
