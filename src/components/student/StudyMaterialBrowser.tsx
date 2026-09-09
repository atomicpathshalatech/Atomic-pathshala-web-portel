"use client";

import { useMemo, useState } from "react";
import type {
  StudyMaterialType,
  StudyMaterialClassExam,
  StudyMaterialLanguage,
} from "@prisma/client";
import {
  CLASS_EXAM_LABEL,
  LANGUAGES,
  moduleTypesForClassExam,
  formatBytes,
} from "@/lib/study-material";
import { PdfViewerModal } from "./PdfViewerModal";

type MaterialRow = {
  id: string;
  classExam: StudyMaterialClassExam;
  subject: string;
  chapterTitle: string;
  chapterClass: number | null;
  language: StudyMaterialLanguage;
  type: StudyMaterialType;
  title: string;
  fileName: string;
  sizeBytes: number;
  allowDownload: boolean;
};

export function StudyMaterialBrowser({
  classExams,
  materials,
}: {
  classExams: StudyMaterialClassExam[];
  materials: MaterialRow[];
}) {
  const [classExam, setClassExam] = useState<StudyMaterialClassExam>(classExams[0] ?? "NEET");
  const [language, setLanguage] = useState<StudyMaterialLanguage>("ENGLISH");
  const [viewing, setViewing] = useState<MaterialRow | null>(null);

  const scoped = useMemo(
    () => materials.filter((m) => m.classExam === classExam && m.language === language),
    [materials, classExam, language]
  );

  const subjects = useMemo(
    () => Array.from(new Set(scoped.map((m) => m.subject))).sort(),
    [scoped]
  );
  const [subject, setSubject] = useState<string>("");
  const activeSubject = subject && subjects.includes(subject) ? subject : subjects[0] ?? "";

  const chapters = useMemo(
    () =>
      Array.from(
        new Map(
          scoped
            .filter((m) => m.subject === activeSubject)
            .map((m) => [m.chapterTitle, { title: m.chapterTitle, cls: m.chapterClass }])
        ).values()
      ),
    [scoped, activeSubject]
  );
  const [chapterTitle, setChapterTitle] = useState<string>("");
  const activeChapter =
    chapterTitle && chapters.some((c) => c.title === chapterTitle)
      ? chapterTitle
      : chapters[0]?.title ?? "";

  const types = moduleTypesForClassExam(classExam);
  const rows = scoped.filter((m) => m.subject === activeSubject && m.chapterTitle === activeChapter);

  const totalForLangEmpty = materials.some((m) => m.classExam === classExam) && scoped.length === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-5 p-1">
      <header className="text-center">
        <h1 className="text-xl font-black text-slate-900">Modules</h1>
        <div className="mt-2 inline-flex rounded-full bg-slate-100 p-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLanguage(l.value)}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition ${
                language === l.value ? "bg-blue-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      {/* Class/Exam tabs (only if the student has more than one) */}
      {classExams.length > 1 && (
        <div className="flex gap-2 justify-center flex-wrap">
          {classExams.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setClassExam(c);
                setSubject("");
                setChapterTitle("");
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                c === classExam ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {CLASS_EXAM_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300">folder_open</span>
          <p className="mt-2 text-sm text-slate-500">
            {totalForLangEmpty
              ? `No ${LANGUAGES.find((l) => l.value === language)?.label} modules for ${CLASS_EXAM_LABEL[classExam]} yet — try the other language.`
              : "No modules published for you yet. Check back soon."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {subjects.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSubject(s);
                  setChapterTitle("");
                }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  s === activeSubject ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <select
            value={activeChapter}
            onChange={(e) => setChapterTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold"
          >
            {chapters.map((c) => (
              <option key={c.title} value={c.title}>
                {c.title}
              </option>
            ))}
          </select>

          <div className="space-y-3">
            {types.map((t) => {
              const items = rows.filter((m) => m.type === t.value);
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
            {rows.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6">
                No modules in this chapter for the selected language.
              </p>
            )}
          </div>
        </>
      )}

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
