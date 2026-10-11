"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Deletes a module and its files from storage (source PDF, images, exports). */
export function ModuleDeleteButton({ moduleId, title, published }: { moduleId: string; title: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (published) {
      toast.error("This module is published. Unpublish it first, then delete it.");
      return;
    }
    if (!window.confirm(`Delete "${title}"?\n\nThe module, its pages, images and exported PDFs are removed from storage. This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/team/modules/${moduleId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || "Could not delete this module.");
        return;
      }
      const n = json.data?.filesDeleted ?? 0;
      toast.success(`Module deleted${n ? ` · ${n} file${n === 1 ? "" : "s"} removed from storage` : ""}.`);
      router.refresh();
    } catch {
      toast.error("Network error while deleting the module.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      title={published ? "Unpublish this module before deleting it" : "Delete this module and free its storage"}
      className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-600 hover:bg-red-500/10 transition disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-xl">{busy ? "hourglass_top" : "delete"}</span>
    </button>
  );
}
