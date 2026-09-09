import Link from "next/link";
import { STUDY_MATERIAL_TYPES } from "@/lib/study-material";

/**
 * Course-page teaser for the dedicated Study Material browser. The real,
 * chapter-wise library (modules, short notes, mind maps, formula sheets,
 * highlighted NCERT, NCERT exemplar) lives at /study-material.
 */
export function StudyMaterialSection() {
  return (
    <section id="material" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-5">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600">folder_open</span>
          <span>Study Material &amp; Digital Notes</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Chapter-wise PDFs you can read in the app or download to your device.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {STUDY_MATERIAL_TYPES.map((t) => (
          <div
            key={t.value}
            className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200/80 px-3 py-2.5"
          >
            <span className="material-symbols-outlined text-blue-600 text-lg">{t.icon}</span>
            <span className="text-xs font-bold text-slate-700">{t.label}</span>
          </div>
        ))}
      </div>

      <Link
        href="/study-material"
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 transition"
      >
        <span className="material-symbols-outlined text-sm">open_in_new</span>
        Open Study Material
      </Link>
    </section>
  );
}
