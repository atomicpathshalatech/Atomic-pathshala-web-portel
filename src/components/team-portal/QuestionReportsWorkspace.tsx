"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Report = {
  id: string;
  reasonTags: string;
  comment: string | null;
  screenshotUrl: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "NEW" | "CLAIMED" | "RESOLVED" | "REJECTED";
  teacherNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  question: { id: string; subject: string; chapter: string | null; questionCode: string | null };
  reportedBy: { id: string; name: string | null; email: string };
  claimedBy: { id: string; name: string | null; email: string } | null;
};

const STATUS_TABS = [
  { key: "NEW", label: "New" },
  { key: "CLAIMED", label: "Claimed" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "REJECTED", label: "Rejected" },
] as const;

export function QuestionReportsWorkspace({
  canResolve,
  currentUserId,
}: {
  canResolve: boolean;
  currentUserId: string;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]["key"]>("NEW");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/questions/reports?status=${status}`);
      const body = await res.json();
      if (body.success) setReports(body.data.reports);
      else toast.error(body.error || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter, load]);

  async function act(id: string, action: "CLAIM" | "UNCLAIM" | "RESOLVE" | "REJECT") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/questions/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!body.success) {
        toast.error(body.error || "Action failed");
        return;
      }
      toast.success(
        action === "CLAIM"
          ? "Claimed — you're now working this report."
          : action === "UNCLAIM"
            ? "Released back to the queue."
            : action === "RESOLVE"
              ? "Marked resolved."
              : "Marked rejected."
      );
      load(statusFilter);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md font-headline-md text-on-surface">Question Reports</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Issues students have flagged on questions — claim one to lock it while you review, then resolve or reject.
        </p>
      </header>

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`text-label-md font-semibold px-3 py-1.5 rounded-full transition-colors ${
              statusFilter === tab.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-body-md text-on-surface-variant">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-on-surface-variant font-body-md">
          No {statusFilter.toLowerCase()} reports.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const mine = r.claimedBy?.id === currentUserId;
            return (
              <div key={r.id} className="glass-card rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                    <span>{r.question.subject}</span>
                    {r.question.chapter && <span>· {r.question.chapter}</span>}
                    {r.question.questionCode && <span className="font-mono">· {r.question.questionCode}</span>}
                  </div>
                  <span className="text-label-sm font-semibold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                    {r.priority}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {r.reasonTags.split(",").map((tag) => (
                    <span
                      key={tag}
                      className="text-label-sm px-2 py-0.5 rounded-full bg-error/10 text-error"
                    >
                      {tag.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>

                {r.comment && <p className="text-body-sm text-on-surface">{r.comment}</p>}

                <p className="text-label-sm text-on-surface-variant">
                  Reported by {r.reportedBy.name || r.reportedBy.email} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {r.claimedBy && <> · Claimed by {r.claimedBy.name || r.claimedBy.email}</>}
                </p>

                {canResolve && (
                  <div className="flex items-center gap-2 mt-1">
                    {r.status === "NEW" && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, "CLAIM")}
                        className="text-label-sm font-semibold px-3 py-1.5 rounded-full bg-primary text-on-primary disabled:opacity-50"
                      >
                        Claim
                      </button>
                    )}
                    {r.status === "CLAIMED" && mine && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, "RESOLVE")}
                          className="text-label-sm font-semibold px-3 py-1.5 rounded-full bg-primary text-on-primary disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, "REJECT")}
                          className="text-label-sm font-semibold px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, "UNCLAIM")}
                          className="text-label-sm font-semibold text-on-surface-variant hover:underline disabled:opacity-50"
                        >
                          Release
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
