"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "./api-client";

type ModuleRow = { id: string; title: string; sections: { id: string; title: string; _count: { items: number } }[] };
type Target = { id: string; name: string; code?: string | null; status?: string | null };

/**
 * Sends the selected library questions to a Question Module (new or
 * existing exercise), a Test, or a DPP — through the same endpoints those
 * screens use, so their rules (publish state, locks, access) still apply.
 */
export function AddToTargetDialog({
  target,
  questionIds,
  prefer,
  onClose,
  onDone,
}: {
  target: "MODULE" | "TEST" | "DPP";
  questionIds: string[];
  prefer: { examIds: string[]; years: number[] };
  onClose: () => void;
  onDone: () => void;
}) {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [search, setSearch] = useState("");
  const [moduleId, setModuleId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; link?: string } | null>(null);

  useEffect(() => {
    if (target === "MODULE") {
      api<{ modules: ModuleRow[] }>("/api/team/pyq/modules").then((d) => setModules(d.modules)).catch((e) => toast.error(e.message));
    }
  }, [target]);

  useEffect(() => {
    if (target === "MODULE") return;
    const t = setTimeout(() => {
      const url = target === "TEST" ? `/api/team/tests` : `/api/team/dpp?search=${encodeURIComponent(search)}`;
      api<{ tests?: Target[]; dpps?: Target[] }>(url)
        .then((d) => {
          const list = (target === "TEST" ? d.tests : d.dpps) ?? [];
          const q = search.trim().toLowerCase();
          setTargets(q ? list.filter((x) => `${x.name} ${x.code ?? ""}`.toLowerCase().includes(q)).slice(0, 50) : list.slice(0, 50));
        })
        .catch((e) => toast.error(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [target, search]);

  const qm = modules.find((m) => m.id === moduleId);
  const filterQuery = new URLSearchParams({
    ...(prefer.examIds.length ? { exam: prefer.examIds.join(",") } : {}),
    ...(prefer.years.length ? { years: prefer.years.join(",") } : {}),
  }).toString();

  async function submit() {
    setBusy(true);
    try {
      if (target === "MODULE") {
        let mId = moduleId;
        let sId = sectionId;
        if (!mId) {
          if (newModuleTitle.trim().length < 2) throw new Error("Give the new module a title.");
          const created = await api<{ module: { id: string; sections: { id: string }[] } }>("/api/team/pyq/modules", {
            method: "POST",
            json: { title: newModuleTitle.trim(), firstSectionTitle: newSectionTitle.trim() || "Exercise 1: PYQs" },
          });
          mId = created.module.id;
          sId = created.module.sections[0]!.id;
        } else if (!sId) {
          if (!newSectionTitle.trim()) throw new Error("Choose an exercise or name a new one.");
          const s = await api<{ section: { id: string } }>(`/api/team/pyq/modules/${mId}/sections`, { method: "POST", json: { title: newSectionTitle.trim() } });
          sId = s.section.id;
        }
        const res = await api<{ added: number; skipped: number }>(`/api/team/pyq/modules/${mId}/items`, {
          method: "POST",
          json: { kind: "QUESTIONS", sectionId: sId, questionIds, filterQuery },
        });
        setResult({ text: `Added ${res.added} question(s)${res.skipped ? `; ${res.skipped} were already in the module` : ""}.`, link: `/team/pyq-modules/${mId}` });
      } else {
        if (!targetId) throw new Error(`Choose a ${target === "TEST" ? "test" : "DPP"}.`);
        const url = target === "TEST" ? `/api/team/tests/${targetId}/questions` : `/api/team/dpp/${targetId}/questions`;
        const res = await api<{ added: number; rejected?: { missing: string[]; alreadyAdded: string[] } }>(url, { method: "POST", json: { questionIds } });
        const already = res.rejected?.alreadyAdded?.length ?? 0;
        setResult({
          text: `Added ${res.added} question(s)${already ? `; ${already} were already there` : ""}.`,
          link: target === "TEST" ? `/team/tests/${targetId}` : `/team/dpp/${targetId}`,
        });
      }
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900 dark:text-white">
            Add {questionIds.length} question{questionIds.length === 1 ? "" : "s"} to {target === "MODULE" ? "a module" : target === "TEST" ? "a test" : "a DPP"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <p className="text-emerald-700 font-bold">{result.text}</p>
            <div className="flex gap-2">
              {result.link && (
                <Link href={result.link} className="pyq-btn-primary">
                  Open
                </Link>
              )}
              <button type="button" onClick={onClose} className="pyq-btn">
                Done
              </button>
            </div>
          </div>
        ) : target === "MODULE" ? (
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="font-bold text-slate-500 text-xs">Module</span>
              <select value={moduleId} onChange={(e) => (setModuleId(e.target.value), setSectionId(""))} className="pyq-input">
                <option value="">+ New module</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            {!moduleId && <input value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="Module title, e.g. Organic Chemistry — PYQ Practice" className="pyq-input w-full" />}
            {qm && (
              <label className="flex flex-col gap-1">
                <span className="font-bold text-slate-500 text-xs">Exercise</span>
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="pyq-input">
                  <option value="">+ New exercise</option>
                  {qm.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s._count.items})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(!moduleId || !sectionId) && <input value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} placeholder="Exercise title, e.g. Exercise 1: NEET PYQs" className="pyq-input w-full" />}
            <p className="text-[11px] text-slate-500">Questions are linked, not copied — removing one from the module never deletes it from the library.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${target === "TEST" ? "tests" : "DPPs"} by name or code`} className="pyq-input w-full" />
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
              {targets.length === 0 && <p className="p-3 text-xs text-slate-500">Nothing found.</p>}
              {targets.map((t) => (
                <label key={t.id} className="flex items-center gap-2 p-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="radio" name="target" checked={targetId === t.id} onChange={() => setTargetId(t.id)} />
                  <span className="font-bold">{t.name}</span>
                  {t.code && <span className="font-mono text-slate-400">{t.code}</span>}
                  {t.status && <span className="ml-auto text-slate-400">{t.status}</span>}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              {target === "DPP" ? "A DPP only accepts published questions — approve drafts in the Question Bank first." : "Tests can be changed until their scheduled time."}
            </p>
          </div>
        )}

        {!result && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="pyq-btn">
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={submit} className="pyq-btn-primary">
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
