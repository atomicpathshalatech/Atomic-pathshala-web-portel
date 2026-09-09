"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudyMaterialType } from "@prisma/client";
import { STUDY_MATERIAL_TYPES, formatBytes } from "@/lib/study-material";

type SubjectOpt = {
  id: string;
  title: string;
  courseTitle: string | null;
  chapters: { id: string; title: string }[];
};

type Material = {
  id: string;
  type: StudyMaterialType;
  title: string;
  fileName: string;
  sizeBytes: number;
  allowDownload: boolean;
  isPublished: boolean;
  order: number;
};

export function StudyMaterialManager({ subjects }: { subjects: SubjectOpt[] }) {
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);
  const [chapterId, setChapterId] = useState<string>("");

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // reset chapter when subject changes
    setChapterId(subject?.chapters[0]?.id ?? "");
  }, [subject]);

  const load = useCallback(async () => {
    if (!chapterId) {
      setMaterials([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/team/study-material?chapterId=${chapterId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load.");
      setMaterials(json.data.materials);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load study material.");
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, data: Partial<Pick<Material, "allowDownload" | "isPublished" | "title">>) {
    // optimistic
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

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Study Material</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Pick a subject and chapter, then upload PDFs under each category. Students browse them under
          Study Material and can view or download each file.
        </p>
      </header>

      {/* Subject + chapter pickers */}
      <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Subject</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-semibold"
          >
            {subjects.length === 0 && <option value="">No subjects yet</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.courseTitle ? ` — ${s.courseTitle}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chapter</span>
          <select
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            disabled={!subject || subject.chapters.length === 0}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {(!subject || subject.chapters.length === 0) && <option value="">No chapters</option>}
            {subject?.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Category sections */}
      {!chapterId ? (
        <p className="text-sm text-slate-500">Select a chapter to manage its study material.</p>
      ) : (
        <div className="space-y-4">
          {STUDY_MATERIAL_TYPES.map((t) => (
            <TypeSection
              key={t.value}
              type={t.value}
              label={t.label}
              icon={t.icon}
              chapterId={chapterId}
              items={materials.filter((m) => m.type === t.value)}
              loading={loading}
              onAdded={load}
              onPatch={patch}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TypeSection({
  type,
  label,
  icon,
  chapterId,
  items,
  loading,
  onAdded,
  onPatch,
  onRemove,
}: {
  type: StudyMaterialType;
  label: string;
  icon: string;
  chapterId: string;
  items: Material[];
  loading: boolean;
  onAdded: () => void;
  onPatch: (id: string, data: Partial<Pick<Material, "allowDownload" | "isPublished" | "title">>) => void;
  onRemove: (id: string) => void;
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
    setBusy(true);
    setProgress(5);
    try {
      const { uploadFileToR2 } = await import("@/lib/storage/upload-client");
      const up = await uploadFileToR2(file, {
        prefix: "documents",
        fileType: "PDF",
        subPath: `study-material/${chapterId}`,
        visibility: "PROTECTED",
        onProgress: setProgress,
      });
      const res = await fetch("/api/team/study-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId,
          type,
          title: title.trim() || file.name.replace(/\.pdf$/i, ""),
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
              <label className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0" title="Students can save the file">
                <input
                  type="checkbox"
                  checked={m.allowDownload}
                  onChange={(e) => onPatch(m.id, { allowDownload: e.target.checked })}
                />
                Downloadable
              </label>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0" title="Visible to students">
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
