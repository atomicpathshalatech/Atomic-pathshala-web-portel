"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteDoubtButtonProps {
  doubtId: string;
}

export function DeleteDoubtButton({ doubtId }: DeleteDoubtButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/doubts/${doubtId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not delete doubt.");
        return;
      }

      setShowConfirm(false);
      router.push("/doubts");
      router.refresh();
    } catch {
      setError("Network error while deleting doubt. Please check your connection.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setShowConfirm(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-error/30 text-error hover:bg-error/10 text-xs font-semibold transition-colors"
        title="Delete doubt (डाउट डिलीट करें)"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
        <span>Delete Doubt</span>
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface border border-outline-variant/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-error">
              <div className="p-2.5 rounded-xl bg-error/10">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Delete Doubt?</h3>
                <p className="text-xs text-on-surface-variant">
                  क्या आप इस डाउट को डिलीट करना चाहते हैं?
                </p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to delete this doubt? If you sent this by mistake, it will be
              permanently removed from your account and faculty queue.
            </p>

            {error && (
              <div className="rounded-xl border border-error/20 bg-error/10 p-2.5 text-xs text-error font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-outline-variant/40 hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-error text-white hover:bg-error/90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">
                      progress_activity
                    </span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
