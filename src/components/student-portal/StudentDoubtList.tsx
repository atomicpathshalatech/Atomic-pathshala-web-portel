"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface StudentDoubtItem {
  id: string;
  subject: string | null;
  body: string;
  attachmentUrl: string | null;
  priority: string;
  status: string;
  createdAt: string | Date;
  resolvedBy?: { name: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Pending",
  RESOLVED: "Resolved",
  FLAGGED: "Flagged for Review",
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-secondary-container text-on-secondary-container",
  RESOLVED: "bg-primary-container text-on-primary",
  FLAGGED: "bg-error/10 text-error",
};

interface StudentDoubtListProps {
  initialDoubts: StudentDoubtItem[];
}

export function StudentDoubtList({ initialDoubts }: StudentDoubtListProps) {
  const router = useRouter();
  const [doubts, setDoubts] = useState<StudentDoubtItem[]>(initialDoubts);
  const [deletingDoubt, setDeletingDoubt] = useState<StudentDoubtItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleDeleteConfirm() {
    if (!deletingDoubt) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/doubts/${deletingDoubt.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeleteError(data.error || "Could not delete doubt. Please try again.");
        return;
      }

      setDoubts((prev) => prev.filter((d) => d.id !== deletingDoubt.id));
      setSuccessMessage("Doubt deleted successfully.");
      setDeletingDoubt(null);
      router.refresh();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setDeleteError("Network error while deleting doubt. Please check your connection.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (doubts.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
        You haven&apos;t asked any doubts yet. Use the form to ask your first one.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {successMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {doubts.map((doubt) => {
          const createdDate =
            typeof doubt.createdAt === "string" ? new Date(doubt.createdAt) : doubt.createdAt;

          return (
            <div
              key={doubt.id}
              className="glass-card rounded-xl p-4 flex flex-col gap-2 hover:bg-surface-container-high transition-colors relative group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {doubt.subject && (
                    <span className="text-label-sm text-on-surface-variant shrink-0">
                      {doubt.subject}
                    </span>
                  )}
                  {doubt.priority === "HIGH" && (
                    <span className="text-label-sm text-error font-semibold shrink-0">Urgent</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 text-label-sm font-semibold px-2.5 py-1 rounded-full ${
                      STATUS_CLASS[doubt.status] ?? "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {STATUS_LABEL[doubt.status] ?? doubt.status}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteError(null);
                      setDeletingDoubt(doubt);
                    }}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                    title="Delete doubt (डाउट डिलीट करें)"
                    aria-label="Delete doubt"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>

              <Link href={`/doubts/${doubt.id}`} className="block">
                <p className="font-body-md text-body-md text-on-surface line-clamp-2">
                  {doubt.body}
                </p>
                <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5 mt-2">
                  {createdDate.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {doubt.attachmentUrl && (
                    <span
                      className="material-symbols-outlined text-sm"
                      title="Has an attached photo"
                    >
                      photo
                    </span>
                  )}
                </p>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {deletingDoubt && (
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
              If you submitted this doubt by mistake, it will be permanently removed. Faculty and
              mentors will no longer see it in the resolution queue.
            </p>

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 text-xs text-on-surface">
              <p className="font-semibold text-primary mb-1">
                {deletingDoubt.subject || "General Doubt"}
              </p>
              <p className="line-clamp-2 text-on-surface-variant">{deletingDoubt.body}</p>
            </div>

            {deleteError && (
              <div className="rounded-xl border border-error/20 bg-error/10 p-2.5 text-xs text-error font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingDoubt(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-outline-variant/40 hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
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
    </div>
  );
}
