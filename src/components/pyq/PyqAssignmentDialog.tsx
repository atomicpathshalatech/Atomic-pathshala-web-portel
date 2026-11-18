"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Reviewer {
  id: string;
  name: string;
  email: string;
  role: string;
  totalAssigned: number;
  pendingCount: number;
  verifiedCount: number;
}

interface PyqAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  subject: string;
  chapter: string;
  examId?: string | null;
  mode: "CHAPTER" | "SELECTED_QUESTIONS" | "SELF";
  selectedQuestionIds?: string[];
  totalQuestionsCount: number;
  currentUserId?: string;
}

export function PyqAssignmentDialog({
  open,
  onClose,
  onSuccess,
  subject,
  chapter,
  examId,
  mode: initialMode,
  selectedQuestionIds = [],
  totalQuestionsCount,
  currentUserId,
}: PyqAssignmentDialogProps) {
  const [assignmentType, setAssignmentType] = useState<"CHAPTER" | "SELECTED_QUESTIONS" | "SELF">(initialMode);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [deadline, setDeadline] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingReviewers, setFetchingReviewers] = useState(false);

  useEffect(() => {
    if (open) {
      setAssignmentType(initialMode);
      setFetchingReviewers(true);
      fetch("/api/team/pyq/assignments/reviewers")
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.reviewers) {
            setReviewers(res.data.reviewers);
            // Default reviewer: current user if SELF or first available
            if (initialMode === "SELF" && currentUserId) {
              setSelectedReviewerId(currentUserId);
            } else if (res.data.reviewers.length > 0) {
              setSelectedReviewerId(res.data.reviewers[0].id);
            }
          }
        })
        .catch((err) => toast.error(err.message))
        .finally(() => setFetchingReviewers(false));
    }
  }, [open, initialMode, currentUserId]);

  if (!open) return null;

  const targetCount =
    assignmentType === "SELECTED_QUESTIONS"
      ? selectedQuestionIds.length
      : totalQuestionsCount;

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (assignmentType !== "SELF" && !selectedReviewerId) {
      toast.error("Please select a reviewer");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/team/pyq/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentType,
          subject,
          chapter,
          examId: examId || undefined,
          questionIds: assignmentType === "SELECTED_QUESTIONS" ? selectedQuestionIds : undefined,
          assignedToId: assignmentType === "SELF" ? currentUserId : selectedReviewerId,
          priority,
          deadline: deadline || undefined,
          instructions: instructions || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to assign questions");
      }

      toast.success(json.data?.message || "Questions assigned successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign questions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Assign PYQ Review
              </h3>
              <p className="text-xs text-slate-500">
                {subject} • {chapter}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleAssign} className="p-5 space-y-4 text-xs">
          {/* Assignment Type Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Assignment Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentType("CHAPTER")}
                className={`p-2.5 rounded-xl border text-center transition ${
                  assignmentType === "CHAPTER"
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300 font-bold"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                }`}
              >
                <span className="block text-xs">Complete Chapter</span>
                <span className="text-[10px] text-slate-400">All {totalQuestionsCount} Qs</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignmentType("SELECTED_QUESTIONS")}
                disabled={selectedQuestionIds.length === 0}
                className={`p-2.5 rounded-xl border text-center transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  assignmentType === "SELECTED_QUESTIONS"
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300 font-bold"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                }`}
              >
                <span className="block text-xs">Selected Questions</span>
                <span className="text-[10px] text-slate-400">{selectedQuestionIds.length} chosen</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignmentType("SELF")}
                className={`p-2.5 rounded-xl border text-center transition ${
                  assignmentType === "SELF"
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300 font-bold"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                }`}
              >
                <span className="block text-xs">Self Assignment</span>
                <span className="text-[10px] text-slate-400">Assign to me</span>
              </button>
            </div>
          </div>

          {/* Scope Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Questions to Assign:</span>
            <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
              {targetCount} Question(s)
            </span>
          </div>

          {/* Reviewer Dropdown (if not Self) */}
          {assignmentType !== "SELF" ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Assign To Team Member
              </label>
              {fetchingReviewers ? (
                <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <select
                  value={selectedReviewerId}
                  onChange={(e) => setSelectedReviewerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {reviewers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.role}) • {r.pendingCount} pending / {r.verifiedCount} verified
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-xl border border-blue-200/40">
              Assigned to you directly. These questions will appear in your <strong>&quot;My Assigned Reviews&quot;</strong> folder.
            </div>
          )}

          {/* Priority & Deadline Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent (Deadline Critical)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Deadline (Optional)
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Internal Instructions */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Internal Instructions / Review Notes
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Please carefully verify the Hindi translation of technical terms and confirm diagram labels..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || targetCount === 0}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
              <span>Confirm & Assign</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
