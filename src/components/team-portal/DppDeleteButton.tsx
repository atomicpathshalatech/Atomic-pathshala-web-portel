"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";

/** Delete action for a row on the main DPP list — previously missing
 * entirely from this page (delete only existed inside the per-chapter
 * DPPs tab). Goes through the same registry-backed endpoint as that tab. */
export function DppDeleteButton({ dppId, dppCode, dppName }: { dppId: string; dppCode: string | null; dppName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
        title="Delete DPP"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      {open && (
        <SecureDeleteResourceModal
          isOpen={open}
          onClose={() => setOpen(false)}
          resourceId={dppCode || `DPP-${dppId.slice(0, 6).toUpperCase()}`}
          resourceTitle={dppName}
          resourceType="DPP"
          onDeleted={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
