"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";

/** Delete action for a row on the main Tests list — previously missing
 * entirely from this page (delete only existed inside the per-chapter
 * Tests tab). Goes through the same registry-backed endpoint as that tab. */
export function TestDeleteButton({ testId, testCode, testName }: { testId: string; testCode: string | null; testName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 transition"
        title="Delete test"
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
      {open && (
        <SecureDeleteResourceModal
          isOpen={open}
          onClose={() => setOpen(false)}
          resourceId={testCode || `TST-${testId.slice(0, 6).toUpperCase()}`}
          resourceTitle={testName}
          resourceType="TEST"
          onDeleted={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
