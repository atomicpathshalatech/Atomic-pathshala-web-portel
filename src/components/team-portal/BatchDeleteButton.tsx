"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";

/** Batch isn't in the platform resource registry, so this points the
 * shared confirm-delete modal at its own dedicated endpoint. Previously
 * had a working DELETE route with no UI anywhere to trigger it — the most
 * destructive of the five entities (cascades through enrollments, orders,
 * schedules, and their tests/attempts), so it gets the same strong
 * type-the-ID confirmation as everything else, not a lighter one. */
export function BatchDeleteButton({ batchId, batchCode, batchName }: { batchId: string; batchCode: string; batchName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="relative z-10 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 transition shrink-0"
        title="Delete batch"
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
      {open && (
        <SecureDeleteResourceModal
          isOpen={open}
          onClose={() => setOpen(false)}
          resourceId={batchCode}
          resourceTitle={batchName}
          resourceType="BATCH"
          deleteEndpoint={`/api/team/batches/${batchId}`}
          method="DELETE"
          onDeleted={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
