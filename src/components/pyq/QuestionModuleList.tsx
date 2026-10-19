"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "./api-client";
import { PyqStyles } from "./PyqStyles";

type Row = { id: string; title: string; subtitle: string | null; displayFormat: string; updatedAt: string; sections: { id: string; title: string; _count: { items: number } }[] };

export function QuestionModuleList({ canCreate, canDelete }: { canCreate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [title, setTitle] = useState("");

  const load = () => api<{ modules: Row[] }>("/api/team/pyq/modules").then((d) => setRows(d.modules)).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create() {
    try {
      const { module } = await api<{ module: { id: string } }>("/api/team/pyq/modules", { method: "POST", json: { title: title.trim() } });
      router.push(`/team/pyq-modules/${module.id}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <PyqStyles />
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-slate-900 dark:text-white">Question Modules</h1>
          <p className="text-xs text-slate-500">Printable practice modules built from the PYQ Library — exercises, answer keys and solutions, exported as PDF.</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New module title" className="pyq-input w-64" />
            <button type="button" disabled={title.trim().length < 2} onClick={create} className="pyq-btn-primary">
              Create
            </button>
          </div>
        )}
      </div>
      {rows === null ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">No modules yet. Create one here, or select questions in the PYQ Library and choose “Add to Module”.</p>
      ) : (
        <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
              <Link href={`/team/pyq-modules/${r.id}`} className="font-black text-slate-900 dark:text-white hover:text-blue-600">
                {r.title}
              </Link>
              {r.subtitle && <p className="text-xs text-slate-500">{r.subtitle}</p>}
              <p className="text-xs text-slate-500">
                {r.sections.length} exercise(s) · {r.sections.reduce((n, s) => n + s._count.items, 0)} item(s) · updated {new Date(r.updatedAt).toLocaleDateString()}
              </p>
              {canDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete module "${r.title}"? The questions stay in the library.`)) return;
                    try {
                      await api(`/api/team/pyq/modules/${r.id}`, { method: "DELETE" });
                      load();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                  className="text-[11px] font-bold text-red-600"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
