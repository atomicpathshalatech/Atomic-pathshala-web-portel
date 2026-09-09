"use client";

import { useMemo, useState } from "react";
import type { StudyMaterialType } from "@prisma/client";
import { STUDY_MATERIAL_TYPES, formatBytes } from "@/lib/study-material";
import { PdfViewerModal } from "./PdfViewerModal";

type MaterialRow = {
  id: string;
  type: StudyMaterialType;
  title: string;
  fileName: string;
  sizeBytes: number;
  allowDownload: boolean;
};
type ChapterRow = { id: string; title: string; studyMaterials: MaterialRow[] };
type SubjectRow = { id: string; title: string; chapters: ChapterRow[] };

export function StudyMaterialBrowser({ subjects }: { subjects: SubjectRow[] }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);
  const [chapterId, setChapterId] = useState(subjects[0]?.chapters[0]?.id ?? "");
  const chapter = useMemo(
    () => subject?.chapters.find((c) => c.id === chapterId) ?? subject?.chapters[0],
    [subject, chapterId]
  );
  const [viewing, setViewing] = useState<MaterialRow | null>(null);

  if (subjects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-300">folder_open</span>
        <h1 className="mt-3 text-lg font-bold text-slate-900">Study Material</h1>
        <p className="mt-1 text-sm text-slate-500">
          No study material has been published for your batches yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 p-1">
      <header>
        <h1 className="text-xl font-black text-slate-900">Study Material</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Modules, short notes, mind maps, formula sheets and NCERT resources — chapter by chapter.
        </p>
      </header>

      {/* Subject pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSubjectId(s.id);
              setChapterId(s.chapters[0]?.id ?? "");
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              s.id === subjectId
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Chapter select */}
      <select
        value={chapter?.id ?? ""}
        onChange={(e) => setChapterId(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold"
      >
        {subject?.chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      {/* Category sections */}
      <div className="space-y-3">
        {STUDY_MATERIAL_TYPES.map((t) => {
          const items = chapter?.studyMaterials.filter((m) => m.type === t.value) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={t.value} className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
              <h2 className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 text-sm font-bold text-slate-900">
                <span className="material-symbols-outlined text-blue-600 text-xl">{t.icon}</span>
                {t.label}
                <span className="ml-1 text-xs font-mono text-slate-400">{items.length}</span>
              </h2>
              <ul className="divide-y divide-slate-100">
                {items.map((m) => (
                  <li key={m.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-500 text-xl shrink-0">picture_as_pdf</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{m.title}</p>
                      <p className="text-[11px] text-slate-400">{formatBytes(m.sizeBytes)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewing(m)}
                      className="flex items-center gap-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 shrink-0 transition"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      View
                    </button>
                    {m.allowDownload && (
                      <a
                        href={`/api/study-material/${m.id}/file?download=1`}
                        className="flex items-center gap-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold px-3 py-1.5 shrink-0 transition"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Download
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {viewing && (
        <PdfViewerModal
          materialId={viewing.id}
          title={viewing.title}
          allowDownload={viewing.allowDownload}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
