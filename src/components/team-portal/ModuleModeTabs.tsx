"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The three ways to work on a module, one tab each:
 *  - Original PDF: edit on top of the uploaded PDF (text, covers, pictures, pages).
 *  - Rebuild as blocks: import the PDF's content into editable blocks, fix it.
 *  - Design & export: lay the blocks out with a template and theme, export the PDF.
 */
export function ModuleModeTabs({ moduleId, title }: { moduleId: string; title: string }) {
  const path = usePathname() ?? "";
  const base = `/team/modules/${moduleId}`;
  const tabs = [
    { href: base, label: "Original PDF editing", icon: "picture_as_pdf", active: path === base },
    { href: `${base}/blocks`, label: "Rebuild as blocks", icon: "view_agenda", active: path.startsWith(`${base}/blocks`) },
    { href: `${base}/design`, label: "Design & export", icon: "palette", active: path.startsWith(`${base}/design`) },
  ];
  return (
    <nav aria-label="Module mode" className="flex flex-wrap items-center gap-2 mb-3">
      <Link href="/team/modules" className="text-label-sm text-primary hover:underline flex items-center gap-1 mr-1">
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        Modules
      </Link>
      <span className="text-label-sm font-semibold text-on-surface truncate max-w-[32ch]" title={title}>
        {title}
      </span>
      <div className="flex rounded-full border border-outline-variant/50 p-0.5 bg-surface-container-lowest ml-auto" role="tablist">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={t.active}
            aria-current={t.active ? "page" : undefined}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-label-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${t.active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
