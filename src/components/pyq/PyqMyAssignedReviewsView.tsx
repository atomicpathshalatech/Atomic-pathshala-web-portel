"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PyqQuestionReviewModal } from "./PyqQuestionReviewModal";
import { PyqAssignmentDialog } from "./PyqAssignmentDialog";

interface AssignmentSummary {
  id: string;
  title: string | null;
  subject: string;
  chapter: string;
  examName: string;
  assignmentType: string;
  priority: string;
  deadline: string | null;
  instructions: string | null;
  status: string;
  totalQuestions: number;
  pendingCount: number;
  inReviewCount: number;
  verifiedCount: number;
  assignedTo: { id: string; name: string | null; email: string; photoUrl: string | null };
  assignedBy: { id: string; name: string | null; email: string };
  assignedAt: string;
  completedAt: string | null;
}

interface ReviewerStat {
  id: string;
  name: string;
  email: string;
  role: string;
  totalAssigned: number;
  pendingCount: number;
  inProgressCount: number;
  verifiedCount: number;
  correctionsCount: number;
}

interface PyqMyAssignedReviewsViewProps {
  onSelectChapter?: (subject: string, chapter: string) => void;
}

export function PyqMyAssignedReviewsView({ onSelectChapter }: PyqMyAssignedReviewsViewProps) {
  const [filterView, setFilterView] = useState<"mine" | "all">("mine");
  const [isSuperOrAdmin, setIsSuperOrAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Summary Metrics
  const [summary, setSummary] = useState({
    totalAssigned: 0,
    pendingReview: 0,
    inProgress: 0,
    completedReviews: 0,
  });

  // Assignments
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerStat[]>([]);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [searchChapter, setSearchChapter] = useState<string>("");

  // Review Modal state
  const [reviewModalQuestionId, setReviewModalQuestionId] = useState<string | null>(null);

  // Status Override Modal for Super Admin
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideQuestionId, setOverrideQuestionId] = useState("");
  const [overrideNewStatus, setOverrideNewStatus] = useState("VERIFIED");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);

  // Reassign Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignAssignment, setReassignAssignment] = useState<AssignmentSummary | null>(null);

  const fetchAssignments = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("filter", filterView);
    if (selectedSubject !== "ALL") params.set("subject", selectedSubject);
    if (selectedPriority !== "ALL") params.set("priority", selectedPriority);
    if (searchChapter.trim()) params.set("chapter", searchChapter.trim());

    fetch(`/api/team/pyq/assignments?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          setSummary(j.data.summary);
          setAssignments(j.data.assignments);
          setIsSuperOrAdmin(Boolean(j.data.isSuperOrAdmin));
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  const fetchReviewers = () => {
    fetch("/api/team/pyq/assignments/reviewers")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data?.reviewers) {
          setReviewers(j.data.reviewers);
        }
      })
      .catch((e) => toast.error(e.message));
  };

  useEffect(() => {
    fetchAssignments();
  }, [filterView, selectedSubject, selectedPriority]);

  useEffect(() => {
    if (isSuperOrAdmin) {
      fetchReviewers();
    }
  }, [isSuperOrAdmin]);

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideQuestionId.trim() || !overrideReason.trim()) {
      toast.error("Question ID and mandatory reason are required");
      return;
    }
    setOverrideLoading(true);
    try {
      const res = await fetch("/api/team/pyq/assignments/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: overrideQuestionId.trim(),
          newStatus: overrideNewStatus,
          reason: overrideReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to override");
      toast.success(json.data?.message || "Status overridden successfully!");
      setOverrideModalOpen(false);
      setOverrideReason("");
      fetchAssignments();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOverrideLoading(false);
    }
  };

  const subjects = ["ALL", "Biology", "Physics", "Chemistry", "Mathematics"];

  return (
    <div className="space-y-6">
      {/* 1. Header with Mode Switcher (My Reviews vs Admin Control Panel) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-blue-600 text-2xl">fact_check</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {filterView === "mine" ? "My Assigned Reviews" : "Super Admin Review Operations & Control Panel"}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {filterView === "mine"
              ? "Your personal review queue. Inspect bilingual questions, verify diagrams & official answer keys."
              : "Complete control over all team assignments, reviewer performance & status overrides."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperOrAdmin && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFilterView("mine")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterView === "mine"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                My Reviews
              </button>
              <button
                type="button"
                onClick={() => setFilterView("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  filterView === "all"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
                <span>All Assignments</span>
              </button>
            </div>
          )}

          {isSuperOrAdmin && (
            <button
              type="button"
              onClick={() => setOverrideModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Override Status</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchAssignments}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Four Dashboard Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Assigned</span>
            <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">assignment</span>
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {summary.totalAssigned}
          </p>
          <span className="text-[10px] text-slate-400">Questions in active queue</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Pending Review</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </span>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 font-mono">
            {summary.pendingReview}
          </p>
          <span className="text-[10px] text-blue-500/80">Awaiting reviewer inspection</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">In Progress</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
            </span>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {summary.inProgress}
          </p>
          <span className="text-[10px] text-amber-500/80">Checklist started &amp; draft saved</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed Reviews</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {summary.completedReviews}
          </p>
          <span className="text-[10px] text-emerald-500/80">Successfully approved &amp; verified</span>
        </div>
      </div>

      {/* 3. Super Admin Reviewer Performance Dashboard Table (when filterView === "all") */}
      {filterView === "all" && isSuperOrAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Reviewer Performance &amp; Workload Matrix
              </h3>
              <p className="text-xs text-slate-400">
                Calculated in real-time from active question assignments and verification decisions.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                  <th className="py-2.5 px-3">Reviewer</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-right">Assigned</th>
                  <th className="py-2.5 px-3 text-right">Pending</th>
                  <th className="py-2.5 px-3 text-right">In Review</th>
                  <th className="py-2.5 px-3 text-right">Verified</th>
                  <th className="py-2.5 px-3 text-right">Corrections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {reviewers.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{r.name}</div>
                      <div className="text-[10px] text-slate-400">{r.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                        {r.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                      {r.totalAssigned}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">
                      {r.pendingCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-600 dark:text-amber-400 font-bold">
                      {r.inProgressCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {r.verifiedCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400 font-bold">
                      {r.correctionsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-xs">
        {/* Subject Pills */}
        <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
          {subjects.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSelectedSubject(sub)}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                selectedSubject === sub
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* Priority Filter & Chapter Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="ALL">All Priorities</option>
            <option value="NORMAL">Normal Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="URGENT">Urgent Priority</option>
          </select>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchAssignments();
            }}
            className="flex items-center"
          >
            <input
              type="text"
              placeholder="Filter by chapter..."
              value={searchChapter}
              onChange={(e) => setSearchChapter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs w-44"
            />
          </form>
        </div>
      </div>

      {/* 5. Assigned Chapters & Questions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs animate-pulse">
            Loading assigned reviews…
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">assignment_turned_in</span>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Assigned Reviews Matching Filters
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {filterView === "mine"
                ? "You currently have no questions awaiting review. You can self-assign questions from any Chapter-Wise PYQ page!"
                : "No active assignments found in the system matching the selected filters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map((a) => {
              const percentDone =
                a.totalQuestions > 0 ? Math.round((a.verifiedCount / a.totalQuestions) * 100) : 0;

              return (
                <div
                  key={a.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Subject, Chapter & Priority */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {a.subject}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{a.examName}</span>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              a.priority === "URGENT"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : a.priority === "HIGH"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {a.priority}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-slate-900 dark:text-white">
                          {a.chapter}
                        </h4>
                      </div>

                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-xl ${
                          a.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500 font-medium">Verification Progress</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {a.verifiedCount} / {a.totalQuestions} ({percentDone}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${percentDone}%` }}
                        />
                      </div>
                    </div>

                    {/* Counts Grid */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                        <span className="text-[10px] text-slate-400 block font-bold">TOTAL</span>
                        <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm">
                          {a.totalQuestions}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/30">
                        <span className="text-[10px] text-blue-500 block font-bold">PENDING</span>
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                          {a.pendingCount}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/30">
                        <span className="text-[10px] text-amber-500 block font-bold">IN REVIEW</span>
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                          {a.inReviewCount}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30">
                        <span className="text-[10px] text-emerald-500 block font-bold">VERIFIED</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {a.verifiedCount}
                        </span>
                      </div>
                    </div>

                    {/* Deadline & Reviewer Meta */}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2">
                      <div>
                        {a.deadline && (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[14px]">event</span>
                            Due {new Date(a.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Assigned to: <strong className="text-slate-700 dark:text-slate-300">{a.assignedTo.name || a.assignedTo.email}</strong>
                      </span>
                    </div>

                    {a.instructions && (
                      <p className="mt-2 text-[11px] italic text-slate-500 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        &ldquo;{a.instructions}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {onSelectChapter ? (
                      <button
                        type="button"
                        onClick={() => onSelectChapter(a.subject, a.chapter)}
                        className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <span>Open Chapter View</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    ) : <span />}

                    <button
                      type="button"
                      onClick={() => {
                        // Open first unverified question or chapter in chapter view
                        if (onSelectChapter) {
                          onSelectChapter(a.subject, a.chapter);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">rate_review</span>
                      <span>{a.verifiedCount > 0 ? "Continue Review" : "Start Review"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Super Admin Status Override Modal */}
      {overrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">tune</span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Super Admin Status Override
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Question ID or Code
                </label>
                <input
                  type="text"
                  value={overrideQuestionId}
                  onChange={(e) => setOverrideQuestionId(e.target.value)}
                  placeholder="Paste question ID or code..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  New Verification Status
                </label>
                <select
                  value={overrideNewStatus}
                  onChange={(e) => setOverrideNewStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                >
                  <option value="VERIFIED">VERIFIED (Force Approve)</option>
                  <option value="IN_REVIEW">IN_REVIEW (Reopen Review)</option>
                  <option value="NEEDS_CORRECTION">NEEDS_CORRECTION (Flag for Rework)</option>
                  <option value="UNVERIFIED">UNVERIFIED (Reset Status)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Mandatory Audit Reason (Saved to History)
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Detailed justification for overriding verification status..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-xs"
                >
                  {overrideLoading ? "Saving…" : "Apply Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModalQuestionId && (
        <PyqQuestionReviewModal
          questionId={reviewModalQuestionId}
          open={Boolean(reviewModalQuestionId)}
          onClose={() => setReviewModalQuestionId(null)}
          onRefresh={fetchAssignments}
        />
      )}
    </div>
  );
}
