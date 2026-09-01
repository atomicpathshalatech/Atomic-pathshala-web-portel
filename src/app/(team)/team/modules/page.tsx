import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Module Studio" };

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-surface-container-high text-on-surface-variant",
  PROCESSING: "bg-primary/10 text-primary",
  REVIEW_REQUIRED: "bg-amber-500/10 text-amber-600",
  READY: "bg-green-500/10 text-green-600",
  PUBLISHED: "bg-secondary/10 text-secondary",
  ARCHIVED: "bg-surface-container-high text-on-surface-variant",
  FAILED: "bg-red-500/10 text-red-600",
};

export default async function ModuleStudioListPage() {
  const modules = await prisma.module.findMany({
    include: { brandProfile: { select: { name: true } }, _count: { select: { pages: true, exportHistory: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Module Studio</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Upload a source PDF, extract and structure its content, apply a brand, export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/team/brand-profiles"
            className="text-label-md text-label-md text-primary hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">palette</span>
            Brand Profiles
          </Link>
          <Link
            href="/team/modules/new"
            className="bg-primary text-on-primary rounded-full px-5 py-2.5 font-label-md text-label-md flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Upload Module
          </Link>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No modules yet. Upload a source PDF to get started.
        </div>
      ) : (
        <ul className="space-y-2">
          {modules.map((m) => (
            <li key={m.id}>
              <Link
                href={`/team/modules/${m.id}`}
                className="glass-card rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all block"
              >
                <span className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined">picture_as_pdf</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface truncate">{m.title}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {m.code} · {m._count.pages} page{m._count.pages === 1 ? "" : "s"}
                    {m.brandProfile ? ` · ${m.brandProfile.name}` : ""} · {m._count.exportHistory} export
                    {m._count.exportHistory === 1 ? "" : "s"}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_STYLE[m.status] ?? ""}`}>
                  {m.status.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
