"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";

/** Test Series isn't in the platform resource registry (only TEST/DPP/
 * QUESTION/LECTURE are), so this points the shared confirm-delete modal at
 * its own dedicated endpoint instead of the registry default. Previously
 * had no delete UI anywhere despite a working DELETE route existing. */
export function TestSeriesDeleteButton({
  seriesId,
  seriesCode,
  seriesName,
}: {
  seriesId: string;
  seriesCode: string | null;
  seriesName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
        Delete
      </button>
      {open && (
        <SecureDeleteResourceModal
          isOpen={open}
          onClose={() => setOpen(false)}
          resourceId={seriesCode || seriesId}
          resourceTitle={seriesName}
          resourceType="TEST SERIES"
          deleteEndpoint={`/api/team/test-series/${seriesId}`}
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
