import Link from "next/link";

/**
 * Course-page teaser for the dedicated Study Material browser. The real,
 * Class/Exam → Subject → Chapter → Language → Type library lives at
 * /study-material.
 */
const TEASER_TYPES = [
  { label: "Modules", icon: "menu_book" },
  { label: "Short Notes", icon: "sticky_note_2" },
  { label: "Mind Maps", icon: "account_tree" },
  { label: "Formula Sheets", icon: "functions" },
  { label: "NCERT Highlights", icon: "auto_stories" },
  { label: "NCERT Exemplar", icon: "library_books" },
  { label: "NEET / JEE PYQ", icon: "history_edu" },
];

export function StudyMaterialSection() {
  return (
    <section id="material" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-5">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600">folder_open</span>
          <span>Study Material &amp; Digital Notes</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Chapter-wise PDFs in Hindi &amp; English — read in the app or download to your device.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {TEASER_TYPES.map((t) => (
          <div
            key={t.label}
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
