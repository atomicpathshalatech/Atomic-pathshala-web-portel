"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        className="p-1 hover:text-rose-600 transition"
        title="Delete DPP"
      >
        <span className="material-symbols-outlined">delete</span>
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
